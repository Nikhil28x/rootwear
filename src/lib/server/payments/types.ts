/**
 * RW-096 — the payment seam.
 *
 * §15 open item RW-005: "Razorpay account confirmed in writing, KYC cleared"
 * is BLOCKING. So the gateway is built to an INTERFACE and selected by
 * environment: the app runs, typechecks and demonstrates the whole flow with
 * NO KEYS AT ALL, and turning Razorpay on is a configuration change rather
 * than a code change.
 *
 * §10 also asks for "a secondary gateway as a configurable option, hidden at
 * launch unless Razorpay wobbles". This interface is precisely what makes that
 * a config change: a second implementation, the same five methods, one
 * environment variable.
 *
 * TWO SECRETS, deliberately distinct, and conflating them is the classic
 * Razorpay integration bug:
 *
 *   RAZORPAY_KEY_SECRET      signs the CHECKOUT REDIRECT payload
 *                            (order_id|payment_id)
 *   RAZORPAY_WEBHOOK_SECRET  signs the WEBHOOK BODY
 *
 * §04: "THE WEBHOOK IS THE SOURCE OF TRUTH for payment success, not the
 * browser redirect." The redirect signature is enough to show the customer a
 * confirmation screen. It is never enough to mark an order paid.
 */
import type { Paise } from '$lib/money';

export type PaymentProviderName = 'mock' | 'razorpay';

export type PaymentKind = 'order' | 'deposit' | 'balance';

export type CreateGatewayOrderInput = {
	/** Integer paise. Recomputed server-side; never a figure the client sent. */
	readonly amount: Paise;
	/** Our own reference, so a gateway dashboard row maps back to an order. */
	readonly reference: string;
	readonly kind: PaymentKind;
	readonly email: string;
};

export type GatewayOrder = {
	readonly gateway: PaymentProviderName;
	readonly gatewayOrderId: string;
	readonly amount: Paise;
	readonly currency: 'INR';
	/**
	 * The PUBLISHABLE key id the browser checkout needs. Null for the mock
	 * provider, which has no browser handoff at all.
	 */
	readonly publicKeyId: string | null;
};

/** The payload Razorpay hands back on the browser redirect. */
export type RedirectSignatureInput = {
	readonly gatewayOrderId: string;
	readonly gatewayPaymentId: string;
	readonly signature: string;
};

export type CaptureResult = {
	readonly gatewayPaymentId: string;
	readonly amount: Paise;
	readonly captured: boolean;
};

export type RefundInput = {
	readonly gatewayPaymentId: string;
	readonly amount: Paise;
	/** Mirrors app.refunds.reason. */
	readonly reason: 'cap_race' | 'cancellation' | 'defect' | 'admin';
};

export type RefundResult = {
	readonly gatewayRefundId: string;
	readonly amount: Paise;
	readonly state: 'initiated' | 'processed' | 'failed';
};

/** What a webhook body must yield before anything is written. */
export type WebhookFacts = {
	readonly eventId: string;
	readonly eventType: string;
	readonly gatewayOrderId: string | null;
	readonly gatewayPaymentId: string | null;
	readonly amount: Paise;
};

export interface PaymentProvider {
	readonly name: PaymentProviderName;
	/**
	 * True when this provider cannot function without live credentials. The
	 * checkout surfaces read it to decide whether to offer a real handoff or
	 * to say plainly that payment is not wired up yet, rather than throwing at
	 * a visitor.
	 */
	readonly requiresLiveKeys: boolean;
	/** False until RW-005 lands: no live key material, so no real handoff. */
	readonly isConfigured: boolean;

	createOrder(input: CreateGatewayOrderInput): Promise<GatewayOrder>;

	/**
	 * The BROWSER REDIRECT signature. Never sufficient to mark an order paid.
	 *
	 * Asynchronous because it is computed with Web Crypto rather than
	 * `node:crypto`, so the same code verifies on an edge runtime.
	 */
	verifySignature(input: RedirectSignatureInput): Promise<boolean>;

	/**
	 * The WEBHOOK signature, over the RAW body, with the webhook secret.
	 * The raw bytes matter: re-serialising parsed JSON changes key order and
	 * whitespace, and the HMAC no longer matches.
	 */
	verifyWebhookSignature(rawBody: string, signature: string | null): Promise<boolean>;

	/** Reads the facts a webhook body carries, or null when it carries none. */
	readWebhook(rawBody: string, headers: Headers): WebhookFacts | null;

	capture(gatewayPaymentId: string, amount: Paise): Promise<CaptureResult>;

	refund(input: RefundInput): Promise<RefundResult>;
}
