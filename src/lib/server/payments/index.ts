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

export function paymentProviderName(): PaymentProviderName {
	return env.PAYMENT_PROVIDER === 'razorpay' ? 'razorpay' : 'mock';
}

/** Resolved per call so the switch works without a restart in dev. */
export function paymentProvider(): PaymentProvider {
	return paymentProviderName() === 'razorpay' ? razorpayPaymentProvider : mockPaymentProvider;
}

export { mockWebhookDelivery, signMockWebhook } from './mock';
export type * from './types';
