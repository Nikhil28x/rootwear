import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { cartRepository } from '$lib/server/cart';
import {
	checkoutKeyId,
	mockWebhookDelivery,
	paymentProvider,
	paymentProviderName,
	verifyRedirect
} from '$lib/server/payments';
import { DEPOSIT_PERCENT_CONFIRMED } from '$lib/config/commerce';

/**
 * §08 — the balance payment.
 *
 * "A reservation, its deposit, its balance payment and its final order are ONE
 *  CONTINUOUS RECORD."
 *
 * So this is a checkout surface reading a RESERVATION, not a cart. The figures
 * are the ones stored on the reservation row when it was created — its locked
 * price, its deposit, its balance, its cancellation rule — because §08 says
 * the terms in force at reservation time are what the customer agreed to, and
 * a later configuration change must not rewrite them.
 *
 * TWO RULES ARE ENFORCED BY ABSENCE HERE, and both are deliberate:
 *
 *   §10  No coupon field. "A coupon must NEVER be applicable to a deposit or a
 *        balance payment." app.apply_coupon() refuses those kinds outright, so
 *        rendering the field would only be a way to be told no.
 *   §08  No percentage is printed. DEPOSIT_PERCENT_CONFIRMED is false (RW-006
 *        is an open blocking item), so the screen says "your deposit" and
 *        shows the amount, never "your 50% deposit".
 *
 * The reservation id is the capability: it is a uuid, unguessable, and it is
 * what the customer's own reservation email links to.
 */

export const load: PageServerLoad = async ({ params, locals }) => {
	const reservation = await cartRepository.findReservation(params.reservation);
	if (!reservation) error(404, "We couldn't find that reservation.");

	const intent = await cartRepository.findPaymentIntent({ reservationId: reservation.id });
	const provider = paymentProvider();

	return {
		reservation,
		serverNow: locals.now,
		/** §08/RW-006: gates printing a percentage anywhere on this page. */
		depositPercentConfirmed: DEPOSIT_PERCENT_CONFIRMED,
		payment: {
			name: provider.name,
			configured: provider.isConfigured,
			gatewayOrderId: intent?.gatewayOrderId ?? null,
			amount: intent?.amount ?? reservation.balance,
			/** Publishable only; null under the mock. */
			keyId: checkoutKeyId()
		}
	};
};

export const actions: Actions = {
	/** Opens a gateway order for the BALANCE half and records the intent. */
	pay: async ({ params }) => {
		const reservation = await cartRepository.findReservation(params.reservation);
		if (!reservation) return fail(404, { problem: "We couldn't find that reservation." });

		if (reservation.balance <= 0) {
			return fail(409, { problem: 'Your balance is already paid.' });
		}

		const existing = await cartRepository.findPaymentIntent({ reservationId: reservation.id });
		// One live intent per reservation. Minting a second is how a customer
		// pays the same balance twice.
		if (existing) return { started: true };

		const provider = paymentProvider();
		if (!provider.isConfigured) {
			return fail(503, {
				problem:
					"Online payment isn't available right now. We'll email you a payment link."
			});
		}

		try {
			// The amount comes off the RESERVATION row, which stored it at
			// reservation time. Never recomputed from today's configuration (§08).
			const gatewayOrder = await provider.createOrder({
				amount: reservation.balance,
				reference: `balance-${reservation.id}`,
				kind: 'balance',
				email: reservation.email
			});

			await cartRepository.recordPaymentIntent({
				orderId: null,
				reservationId: reservation.id,
				kind: 'balance',
				gateway: gatewayOrder.gateway,
				gatewayOrderId: gatewayOrder.gatewayOrderId,
				amount: gatewayOrder.amount
			});
		} catch (cause) {
			console.error('[balance] gateway order failed', cause);
			return fail(502, {
				problem: "We couldn't start your payment. You haven't been charged — please try again."
			});
		}

		return { started: true };
	},

	/** The Razorpay modal's success payload. Never marks the balance paid. */
	verifyPayment: async ({ params, request }) => {
		const intent = await cartRepository.findPaymentIntent({ reservationId: params.reservation });
		const result = await verifyRedirect(await request.formData(), intent);
		if (!result.ok) return fail(result.status, { problem: result.problem });

		// Razorpay itself says captured: settle now, through the same idempotent
		// capture the webhook uses, so the customer is not left waiting on it.
		if (result.captured) {
			await cartRepository.capturePayment(result.captured).catch((cause) => {
				console.error('[checkout] capture after verify failed', cause);
			});
		}

		return { verified: true };
	},

	/**
	 * The stand-in gateway, settling through the REAL webhook route — the same
	 * signed body, the same HMAC, the same event-id de-duplication (§04).
	 */
	settleMock: async ({ params, fetch }) => {
		if (paymentProviderName() !== 'mock') {
			return fail(403, { problem: "Test payments aren't available here." });
		}

		const intent = await cartRepository.findPaymentIntent({ reservationId: params.reservation });
		if (!intent) return fail(409, { problem: "There's no payment to complete yet." });

		const delivery = await mockWebhookDelivery({
			gatewayOrderId: intent.gatewayOrderId,
			amount: intent.amount
		});

		const response = await fetch('/api/webhooks/razorpay', {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				'x-razorpay-signature': delivery.signature,
				'x-razorpay-event-id': delivery.eventId
			},
			body: delivery.body
		});

		if (!response.ok) {
			return fail(502, { problem: `The test payment didn't go through (${response.status}). Please try again.` });
		}

		return { settled: true };
	}
};
