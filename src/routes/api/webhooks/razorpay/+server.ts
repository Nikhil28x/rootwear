import type { RequestHandler } from './$types';
import { cartRepository } from '$lib/server/cart';
import { paymentProvider } from '$lib/server/payments';
import type { WebhookFacts } from '$lib/server/payments/types';
import { onOrderPaidByToken } from '$lib/server/orders/admin';
import { catalogueSource } from '$lib/server/env';

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
 *  4. CAPTURE BEFORE ANSWERING. The capture is one database call, well inside
 *     Razorpay's ~5 s timeout, and it runs before the reply so that a failure
 *     can be answered with a 500 — Razorpay only redelivers on a non-2xx. On a
 *     transient failure the event is removed from the ledger so the redelivery
 *     is processed afresh. Only the slow follow-up (invoice, confirmation
 *     message) runs after the response.
 *
 * A browser redirect NEVER reaches this file. /checkout/processing polls for
 * the order to become paid and proves nothing on its own.
 */

/** A refusal that a retry cannot change: answered 200, recorded, not retried. */
function isPermanent(cause: unknown): boolean {
	return cause instanceof Error && cause.message.startsWith('capturePayment refused');
}

/**
 * The capture itself. Returns the paid order's token when there is
 * after-payment work to do. Idempotent at the database level too
 * (app.capture_payment guards on state in its WHERE clause), so two
 * deliveries racing each other settle once. Throws on a transient failure.
 */
async function capture(facts: WebhookFacts): Promise<string | null> {
	if (facts.eventType !== 'payment.captured' && facts.eventType !== 'order.paid') {
		// Recorded and acknowledged, deliberately not acted on. Refunds and
		// disputes get their own handlers rather than a catch-all branch here.
		await cartRepository.markWebhookProcessed(facts.eventId, null);
		return null;
	}

	if (!facts.gatewayOrderId || !facts.gatewayPaymentId) {
		await cartRepository.markWebhookProcessed(
			facts.eventId,
			'Event carried no gateway order id or payment id.'
		);
		return null;
	}

	const result = await cartRepository.capturePayment({
		gatewayOrderId: facts.gatewayOrderId,
		gatewayPaymentId: facts.gatewayPaymentId,
		amount: facts.amount
	});

	if (result.refundRequired) {
		// The money landed after the order was cancelled (payment window
		// lapsed, or the cart placed a newer order). The order is not revived —
		// its stock may be in someone else's order now — and the capture is
		// not dropped: a cap_race refund is recorded for admin, and the event
		// row says so where admin will see it.
		const note =
			`Payment ${facts.gatewayPaymentId} captured against cancelled order ` +
			`${result.orderPublicToken ?? '(unknown)'}; cap_race refund recorded — refund it.`;
		console.error('[webhook] ' + note);
		await cartRepository.markWebhookProcessed(facts.eventId, note);
		return null;
	}

	await cartRepository.markWebhookProcessed(facts.eventId, null);
	if (result.alreadyCaptured) {
		// payment.captured and order.paid both arrive for one payment; the second
		// finds it captured. The follow-up already ran (or is running) for the first.
		console.info('[webhook] already captured', facts.eventId);
		return null;
	}
	return result.orderPublicToken;
}

export const POST: RequestHandler = async ({ request, platform }) => {
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
	// is the primary key; losing the insert means this is a redelivery of an
	// event already handled (a failed one is removed below, so it is not).
	const isNew = await cartRepository.recordWebhookEvent({
		eventId: facts.eventId,
		gateway: provider.name,
		eventType: facts.eventType,
		payload: JSON.parse(raw)
	});
	if (!isNew) return new Response('duplicate', { status: 200 });

	// 4 — capture now, so a failure can ask Razorpay to try again.
	let paidToken: string | null;
	try {
		paidToken = await capture(facts);
	} catch (cause) {
		const message = cause instanceof Error ? cause.message : String(cause);
		if (isPermanent(cause)) {
			// Retrying cannot fix a refused amount. Record it where admin sees it.
			console.error('[webhook] refused', message);
			await cartRepository.markWebhookProcessed(facts.eventId, message).catch(() => undefined);
			return new Response('refused', { status: 200 });
		}
		// Transient (database or network): forget the event so the redelivery
		// is processed, and answer 500 so Razorpay redelivers.
		console.error('[webhook] capture failed, asking for a retry', cause);
		await cartRepository.forgetWebhookEvent(facts.eventId).catch(() => undefined);
		return new Response('retry', { status: 500 });
	}

	// 5 — the invoice and the confirmation message, after the response. Both are
	// idempotent, and neither can fail the capture, which is already recorded.
	// On Cloudflare a floating promise is cancelled once the response is sent,
	// so the work is handed to waitUntil.
	if (paidToken && catalogueSource() === 'supabase') {
		const work = onOrderPaidByToken(paidToken).catch((error) =>
			console.error('[webhook] after-payment work failed', error)
		);
		platform?.context?.waitUntil(work);
	}

	return new Response('ok', { status: 200 });
};
