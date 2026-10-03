/**
 * The one place the payment gateway is chosen.
 *
 * PAYMENT_PROVIDER=razorpay switches to the real gateway; anything else (the
 * default) uses the mock, so the app runs, typechecks and builds with no keys
 * while RW-005 is open. §10's "secondary gateway as a configurable option,
 * hidden at launch unless Razorpay wobbles" is this switch plus one more
 * implementation of the same interface.
 */
import { env } from '$env/dynamic/private';
import { mockPaymentProvider } from './mock';
import { razorpayPaymentProvider } from './razorpay';
import type { PaymentProvider, PaymentProviderName } from './types';
import type { Paise } from '$lib/money';

export function paymentProviderName(): PaymentProviderName {
	return env.PAYMENT_PROVIDER === 'razorpay' ? 'razorpay' : 'mock';
}

/** Resolved per call so the switch works without a restart in dev. */
export function paymentProvider(): PaymentProvider {
	return paymentProviderName() === 'razorpay' ? razorpayPaymentProvider : mockPaymentProvider;
}

/**
 * The PUBLISHABLE key id the browser checkout opens with, or null when the
 * mock is selected or the key is missing. Never the secret.
 */
export function checkoutKeyId(): string | null {
	return paymentProviderName() === 'razorpay' ? env.RAZORPAY_KEY_ID || null : null;
}

/**
 * The browser redirect payload, checked against the gateway order this page
 * actually opened. Matching the order id matters as much as the HMAC: a
 * genuine signature from a DIFFERENT, cheaper order is still a genuine
 * signature.
 *
 * The signature only proves the customer finished the modal, so it never
 * settles anything by itself. What may settle the order is the follow-up:
 * the server asks the GATEWAY, with the secret key, whether that payment is
 * captured against this order for this amount. That is the gateway's word
 * exactly as the webhook is (§04) — it simply does not wait for a delivery
 * that can be late, retried, or unreachable on a dev machine. The webhook
 * stays the backstop, and capture is idempotent, so both arriving is fine.
 */
export async function verifyRedirect(
	form: FormData,
	intent: { gatewayOrderId: string; amount: Paise } | null
): Promise<
	| { ok: true; captured: { gatewayOrderId: string; gatewayPaymentId: string; amount: Paise } | null }
	| { ok: false; status: 400; problem: string }
> {
	const gatewayOrderId = (form.get('razorpay_order_id') ?? '').toString();
	const gatewayPaymentId = (form.get('razorpay_payment_id') ?? '').toString();
	const signature = (form.get('razorpay_signature') ?? '').toString();

	if (!gatewayOrderId || !gatewayPaymentId || !signature) {
		return { ok: false, status: 400, problem: 'Something went wrong with your payment. Please try again.' };
	}

	const provider = paymentProvider();
	const valid =
		intent !== null &&
		gatewayOrderId === intent.gatewayOrderId &&
		(await provider.verifySignature({ gatewayOrderId, gatewayPaymentId, signature }));

	if (!valid) {
		return { ok: false, status: 400, problem: "We couldn't verify your payment. If you were charged, contact us and we'll sort it out." };
	}

	try {
		const payment = await provider.fetchPayment(gatewayPaymentId);
		const settles =
			payment.captured &&
			payment.gatewayOrderId === intent.gatewayOrderId &&
			payment.amount === intent.amount;
		return { ok: true, captured: settles ? { gatewayOrderId, gatewayPaymentId, amount: payment.amount } : null };
	} catch (cause) {
		// Verified but unconfirmed: the webhook will settle it.
		console.error('[checkout] payment lookup failed', cause);
		return { ok: true, captured: null };
	}
}

export { mockWebhookDelivery, signMockWebhook } from './mock';
export type * from './types';
