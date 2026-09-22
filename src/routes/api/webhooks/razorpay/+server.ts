import type { RequestHandler } from './$types';
import { cartRepository } from '$lib/server/cart';
import { paymentProvider } from '$lib/server/payments';
import type { WebhookFacts } from '$lib/server/payments/types';

/**
 * RW-098 / §04 — "THE WEBHOOK IS THE SOURCE OF TRUTH for payment success, not
 * the browser redirect, and webhook handling must be IDEMPOTENT."
 *
 * The order of operations is the whole design, and every step of it is load
 * bearing:
 *
 *  1. READ THE RAW BODY FIRST. The HMAC is over the exact bytes Razorpay sent.
 *     Parsing to JSON and re-serialising changes whitespace and key order and
 *     the signature will never match again.
 *  2. VERIFY WITH THE WEBHOOK SECRET — not the API key secret. They are
 *     different secrets for different payloads, and swapping them fails closed:
 *     every delivery is rejected and no order is ever marked paid.
 *  3. DEDUPE ON x-razorpay-event-id, which is the primary key of
 *     app.webhook_events. A redelivery loses the insert and returns 200
 *     immediately. That is the idempotency guarantee, and it lives in the
 *     database rather than in a flag somebody has to remember to check.
 *  4. RETURN 200 FAST. Razorpay times out at about five seconds and redelivers;
 *     a slow handler manufactures the duplicates step 3 then has to absorb.
 *     Processing continues after the response.
 *
 * A browser redirect NEVER reaches this file. /checkout/processing polls for
 * the order to become paid and proves nothing on its own.
 */

/**
 * The capture itself, after the 200 has gone out. Idempotent at the database
 * level too (app.capture_payment guards on state in its WHERE clause), so even
 * a race between two deliveries of the same event settles once.
 */
async function settle(facts: WebhookFacts): Promise<void> {
	try {
		if (facts.eventType !== 'payment.captured' && facts.eventType !== 'order.paid') {
			// Recorded and acknowledged, deliberately not acted on. Refunds and
			// disputes get their own handlers rather than a catch-all branch here.
			await cartRepository.markWebhookProcessed(facts.eventId, null);
			return;
		}

		if (!facts.gatewayOrderId || !facts.gatewayPaymentId) {
			await cartRepository.markWebhookProcessed(
				facts.eventId,
				'Event carried no gateway order id or payment id.'
			);
			return;
		}

		const result = await cartRepository.capturePayment({
			gatewayOrderId: facts.gatewayOrderId,
			gatewayPaymentId: facts.gatewayPaymentId,
			amount: facts.amount
		});

		await cartRepository.markWebhookProcessed(facts.eventId, null);

		if (result.alreadyCaptured) {
			console.info('[webhook] already captured', facts.eventId);
		}
	} catch (cause) {
		// The event row keeps the reason, so a failed capture is visible in
		// admin rather than lost in a log nobody reads.
		console.error('[webhook] processing failed', cause);
		await cartRepository
			.markWebhookProcessed(facts.eventId, cause instanceof Error ? cause.message : String(cause))
			.catch(() => undefined);
	}
}

export const POST: RequestHandler = async ({ request }) => {
	// 1 — RAW BYTES, before anything parses them.
	const raw = await request.text();
	const signature = request.headers.get('x-razorpay-signature');

	const provider = paymentProvider();

	// RW-005 is open: with the real gateway selected but no keys present there
	// is nothing to verify against. Refusing is correct — accepting unverified
	// payment notifications is how an order gets marked paid for free.
	if (provider.requiresLiveKeys && !provider.isConfigured) {
		return new Response('payment gateway is not configured', { status: 503 });
	}

	// 2 — WEBHOOK secret, over the raw body, constant-time compare.
	if (!(await provider.verifyWebhookSignature(raw, signature))) {
		return new Response('invalid signature', { status: 401 });
	}

	const facts = provider.readWebhook(raw, request.headers);
	if (!facts) {
		// 400 rather than 500: the body was authentic but carried nothing we
		// can act on, and a retry would carry the same nothing.
		return new Response('no payment in payload', { status: 400 });
	}

	// 3 — the ledger decides whether this is new. app.webhook_events.event_id
	// is the primary key; losing the insert means this is a redelivery.
	const isNew = await cartRepository.recordWebhookEvent({
		eventId: facts.eventId,
		gateway: provider.name,
		eventType: facts.eventType,
		payload: JSON.parse(raw)
	});

	if (!isNew) {
		return new Response('duplicate', { status: 200 });
	}

	// 4 — acknowledge now, process after. On a platform that offers one, this
	// is where `waitUntil` belongs; on a long-running Node server the floating
	// promise is the same thing without the ceremony. It carries its own catch.
	void settle(facts);

	return new Response('ok', { status: 200 });
};
