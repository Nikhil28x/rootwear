/**
 * The mock gateway. The default, and the reason the whole checkout runs with
 * no Razorpay account (RW-005 is blocking, §15).
 *
 * It is a real implementation of the interface, not a stub: it mints a gateway
 * order id, signs a webhook body with an HMAC, and refuses a body whose
 * signature does not match. So the webhook route exercises the same code path
 * it will run in production — read raw body, verify HMAC, dedupe on event id,
 * capture — and only the secret and the HTTP origin differ.
 *
 * IT IS NOT A PRODUCTION PROVIDER. It never talks to a bank and never moves
 * money. `PAYMENT_PROVIDER=razorpay` selects the real one.
 */
import { paise, type Paise } from '$lib/money';
import { env } from '$env/dynamic/private';
import { constantTimeEqual, hmacSha256Hex, randomHex } from './crypto';
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

/**
 * A fixed development secret so the flow works out of the box. Overridable, so
 * a shared staging environment can set its own. This is precisely why the mock
 * must never be selected in production — and why the razorpay provider reads
 * `required()`-style env instead of defaulting anything.
 */
const MOCK_SECRET = () => env.PAYMENT_MOCK_SECRET || 'rootwear-mock-gateway';

export function signMockWebhook(rawBody: string): Promise<string> {
	return hmacSha256Hex(MOCK_SECRET(), rawBody);
}

export const mockPaymentProvider: PaymentProvider = {
	name: 'mock',
	requiresLiveKeys: false,
	isConfigured: true,

	async createOrder(input: CreateGatewayOrderInput): Promise<GatewayOrder> {
		return {
			gateway: 'mock',
			gatewayOrderId: `mock_order_${randomHex(16)}`,
			amount: input.amount,
			currency: 'INR',
			publicKeyId: null
		};
	},

	async verifySignature(input: RedirectSignatureInput): Promise<boolean> {
		const expected = await hmacSha256Hex(
			MOCK_SECRET(),
			`${input.gatewayOrderId}|${input.gatewayPaymentId}`
		);
		return constantTimeEqual(expected, input.signature);
	},

	async verifyWebhookSignature(rawBody: string, signature: string | null): Promise<boolean> {
		if (!signature) return false;
		return constantTimeEqual(await signMockWebhook(rawBody), signature);
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

		return {
			// Same header contract as Razorpay, so the route is identical.
			eventId: headers.get('x-razorpay-event-id') ?? `mock_evt_${randomHex(16)}`,
			eventType: parsed.event ?? 'payment.captured',
			gatewayOrderId: entity.order_id ?? null,
			gatewayPaymentId: entity.id ?? null,
			amount: paise(Math.trunc(entity.amount ?? 0))
		};
	},

	async capture(gatewayPaymentId: string, amount: Paise): Promise<CaptureResult> {
		return { gatewayPaymentId, amount, captured: true };
	},

	async refund(input: RefundInput): Promise<RefundResult> {
		return {
			gatewayRefundId: `mock_rfnd_${randomHex(16)}`,
			amount: input.amount,
			state: 'processed'
		};
	}
};

/**
 * Builds the exact body and signature a gateway would post, so the mock
 * checkout surface can drive the REAL webhook route rather than a shortcut
 * around it. §04 says the webhook is the source of truth; a "mark it paid"
 * button that bypassed the webhook would be testing the wrong thing.
 */
export async function mockWebhookDelivery(input: {
	gatewayOrderId: string;
	amount: Paise;
}): Promise<{ body: string; signature: string; eventId: string; paymentId: string }> {
	const paymentId = `mock_pay_${randomHex(16)}`;
	const body = JSON.stringify({
		event: 'payment.captured',
		payload: {
			payment: {
				entity: {
					id: paymentId,
					order_id: input.gatewayOrderId,
					amount: input.amount,
					currency: 'INR',
					status: 'captured'
				}
			}
		}
	});

	return {
		body,
		signature: await signMockWebhook(body),
		eventId: `mock_evt_${randomHex(16)}`,
		paymentId
	};
}
