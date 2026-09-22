/**
 * RW-096 / RW-098 — the Razorpay provider.
 *
 * ⚠ BLOCKED ON RW-005. §15: "Razorpay account confirmed in writing, KYC
 * cleared" is an open blocking item. Nothing here runs until
 * PAYMENT_PROVIDER=razorpay is set AND the keys exist. It is written now so
 * that turning it on is a configuration change and not a build.
 *
 * Every credential is read at the POINT OF USE, never at import, so importing
 * this module with no keys configured is harmless — the app boots, the
 * checkout surfaces say payment is not wired up yet, and `npm run check` and
 * `npm run build` pass with an empty .env.
 *
 * THE TWO SECRETS ARE NOT INTERCHANGEABLE:
 *   KEY_SECRET      -> HMAC over "order_id|payment_id", the browser redirect
 *   WEBHOOK_SECRET  -> HMAC over the RAW webhook body
 * Using one for the other is the single most common Razorpay bug, and it fails
 * open: signatures never match, so every webhook is rejected and no order is
 * ever marked paid.
 */
import { env } from '$env/dynamic/private';
import { paise, type Paise } from '$lib/money';
import { base64, constantTimeEqual, hmacSha256Hex } from './crypto';
import type {
	CaptureResult,
	CreateGatewayOrderInput,
	GatewayOrder,
	PaymentProvider,
	RedirectSignatureInput,
	RefundInput,
	RefundResult,
	WebhookFacts
} from './types';

const API = 'https://api.razorpay.com/v1';

function credential(name: string): string {
	const value = env[name];
	if (!value) {
		throw new Error(
			`${name} is not set. Razorpay is blocked on RW-005 (account confirmed ` +
				`in writing, KYC cleared). Leave PAYMENT_PROVIDER unset to use the ` +
				`mock gateway.`
		);
	}
	return value;
}

const keyId = () => credential('RAZORPAY_KEY_ID');
const keySecret = () => credential('RAZORPAY_KEY_SECRET');
const webhookSecret = () => credential('RAZORPAY_WEBHOOK_SECRET');

function authHeader(): string {
	return `Basic ${base64(`${keyId()}:${keySecret()}`)}`;
}

async function call<T>(path: string, init: RequestInit): Promise<T> {
	const response = await fetch(`${API}${path}`, {
		...init,
		headers: {
			'content-type': 'application/json',
			authorization: authHeader(),
			...(init.headers ?? {})
		}
	});

	const text = await response.text();
	if (!response.ok) {
		// The gateway's own message is the useful part; it is logged, never
		// shown to the customer.
		throw new Error(`Razorpay ${path} failed (${response.status}): ${text.slice(0, 400)}`);
	}
	return JSON.parse(text) as T;
}

export const razorpayPaymentProvider: PaymentProvider = {
	name: 'razorpay',
	requiresLiveKeys: true,

	get isConfigured(): boolean {
		return Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET && env.RAZORPAY_WEBHOOK_SECRET);
	},

	async createOrder(input: CreateGatewayOrderInput): Promise<GatewayOrder> {
		// Razorpay amounts are in paise, which is what this codebase stores
		// everywhere anyway — there is no conversion, and that is the point of
		// never letting a rupee float into the system.
		const order = await call<{ id: string; amount: number }>('/orders', {
			method: 'POST',
			body: JSON.stringify({
				amount: input.amount,
				currency: 'INR',
				receipt: input.reference,
				notes: { kind: input.kind, email: input.email }
			})
		});

		return {
			gateway: 'razorpay',
			gatewayOrderId: order.id,
			amount: paise(Math.trunc(order.amount)),
			currency: 'INR',
			// The KEY ID is publishable; the SECRET never leaves this module.
			publicKeyId: keyId()
		};
	},

	async verifySignature(input: RedirectSignatureInput): Promise<boolean> {
		// The CHECKOUT secret, over "order_id|payment_id".
		const expected = await hmacSha256Hex(
			keySecret(),
			`${input.gatewayOrderId}|${input.gatewayPaymentId}`
		);
		return constantTimeEqual(expected, input.signature);
	},

	async verifyWebhookSignature(rawBody: string, signature: string | null): Promise<boolean> {
		if (!signature) return false;
		// RAW body, WEBHOOK secret. Parsing first and re-serialising would
		// change whitespace and key order, and the HMAC would never match.
		const expected = await hmacSha256Hex(webhookSecret(), rawBody);
		return constantTimeEqual(expected, signature);
	},

	readWebhook(rawBody: string, headers: Headers): WebhookFacts | null {
		let body: unknown;
		try {
			body = JSON.parse(rawBody);
		} catch {
			return null;
		}

		const parsed = body as {
			event?: string;
			payload?: { payment?: { entity?: { id?: string; order_id?: string; amount?: number } } };
		};

		const entity = parsed.payload?.payment?.entity;
		if (!entity) return null;

		const eventId = headers.get('x-razorpay-event-id');
		// No event id means no idempotency key, and §04 requires one. Refuse
		// rather than invent one: an invented key makes every redelivery look
		// new, which is exactly the duplicate-order bug the ledger prevents.
		if (!eventId) return null;

		return {
			eventId,
			eventType: parsed.event ?? 'unknown',
			gatewayOrderId: entity.order_id ?? null,
			gatewayPaymentId: entity.id ?? null,
			amount: paise(Math.trunc(entity.amount ?? 0))
		};
	},

	async capture(gatewayPaymentId: string, amount: Paise): Promise<CaptureResult> {
		const payment = await call<{ id: string; amount: number; status: string }>(
			`/payments/${gatewayPaymentId}/capture`,
			{ method: 'POST', body: JSON.stringify({ amount, currency: 'INR' }) }
		);

		return {
			gatewayPaymentId: payment.id,
			amount: paise(Math.trunc(payment.amount)),
			captured: payment.status === 'captured'
		};
	},

	async refund(input: RefundInput): Promise<RefundResult> {
		const refund = await call<{ id: string; amount: number; status: string }>(
			`/payments/${input.gatewayPaymentId}/refund`,
			{
				method: 'POST',
				body: JSON.stringify({ amount: input.amount, notes: { reason: input.reason } })
			}
		);

		return {
			gatewayRefundId: refund.id,
			amount: paise(Math.trunc(refund.amount)),
			state: refund.status === 'processed' ? 'processed' : 'initiated'
		};
	}
};
