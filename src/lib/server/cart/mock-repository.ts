/**
 * In-memory CartRepository — the whole cart, checkout, order and webhook flow
 * running with NO DATABASE, which is what CATALOGUE_SOURCE=mock buys.
 *
 * Every rule the SQL enforces is re-implemented here deliberately, not
 * approximated, because a mock that is easier than production teaches the
 * wrong lesson:
 *
 *   app.carts            unique (token)
 *   app.cart_lines       unique (cart_id, variant_id), no price column
 *   app.commit_order     one transaction, price resolved server-side, an
 *                        idempotency key that REPLAYS rather than duplicates
 *   app.apply_coupon     refuses outright on a deposit or a balance (§10)
 *   app.webhook_events   event_id is the primary key, so a redelivery is a
 *                        no-op (§04)
 *
 * These Maps live for the lifetime of the dev process. This is a fixture, not
 * storage, and it says so rather than pretending to persist.
 */
import type { CartRepository, CommitInput } from './repository';
import type {
	CommitOutcome,
	CouponOutcome,
	CouponStatus,
	OrderLineRecord,
	OrderRecord,
	PaymentIntentRecord,
	PaymentKind,
	ReservationRecord,
	SavedAddress,
	ShippingEstimate,
	StoredCart,
	StoredCartLine
} from './types';
import { ZERO, addPaise, fromRupees, multiplyPaise, paise, subPaise, type Paise } from '$lib/money';
import { depositAndBalance, PRELAUNCH_PRICE } from '$lib/config/commerce';
import { catalogueIndex, resolvePrice } from './pricing';
import { sellableStock } from '$lib/domain/drop';

/** §10: a flat India-wide rate, matching the row seeded in 0011. */
/**
 * `crypto` is global on every runtime SvelteKit targets, so there is no
 * `node:crypto` import here — and therefore nothing that breaks on an edge
 * deployment or needs @types/node to typecheck.
 */
const randomUUID = () => crypto.randomUUID();

const FLAT_RATE: ShippingEstimate = { label: 'India — standard', rate: ZERO };

/**
 * Fixture coupons. These mirror app.coupons columns exactly so the statuses
 * exercised here are the statuses Postgres returns.
 */
type MockCoupon = {
	readonly code: string;
	readonly kind: 'percent' | 'fixed';
	readonly value: number;
	readonly minSubtotal: Paise;
	readonly maxDiscount: Paise | null;
	readonly validFromMs: number;
	readonly validUntilMs: number | null;
	readonly maxUses: number | null;
	usedCount: number;
	readonly active: boolean;
};

const COUPONS = new Map<string, MockCoupon>([
	[
		'ROOTS10',
		{
			code: 'ROOTS10',
			kind: 'percent',
			value: 10,
			minSubtotal: ZERO,
			maxDiscount: fromRupees(500),
			validFromMs: 0,
			validUntilMs: null,
			maxUses: null,
			usedCount: 0,
			active: true
		}
	],
	[
		'FIRSTGROWTH',
		{
			code: 'FIRSTGROWTH',
			kind: 'fixed',
			value: fromRupees(300),
			minSubtotal: fromRupees(3000),
			maxDiscount: null,
			validFromMs: 0,
			validUntilMs: null,
			maxUses: 25,
			usedCount: 0,
			active: true
		}
	],
	[
		'LASTSEASON',
		{
			code: 'LASTSEASON',
			kind: 'percent',
			value: 20,
			minSubtotal: ZERO,
			maxDiscount: null,
			validFromMs: 0,
			// Expired on purpose: the cart must have something real to refuse.
			validUntilMs: Date.parse('2026-01-31T23:59:59+05:30'),
			maxUses: null,
			usedCount: 0,
			active: true
		}
	]
]);

type MockCartRow = {
	id: string;
	token: string;
	customerId: string | null;
	couponCode: string | null;
	expiresAtMs: number;
};

const carts = new Map<string, MockCartRow>();
const cartLines = new Map<string, Map<string, StoredCartLine>>();
const orders = new Map<string, OrderRecord>();
const ordersByToken = new Map<string, string>();
const idempotency = new Map<string, string>();
/** Units this process has committed to orders, since the fixture cannot move. */
const sold = new Map<string, number>();

type MockPayment = {
	id: string;
	orderId: string | null;
	reservationId: string | null;
	kind: PaymentKind;
	gateway: string;
	gatewayOrderId: string;
	gatewayPaymentId: string | null;
	amount: Paise;
	state: 'created' | 'captured' | 'refunded';
};

const payments = new Map<string, MockPayment>();
const webhookEvents = new Map<string, { processedAtMs: number | null; error: string | null }>();

/**
 * §08 — one fixture reservation so the balance-payment surface is reachable
 * without a database. Deposit and balance are derived by splitByPercent(), so
 * they sum back to the locked price to the exact paise.
 */
const RESERVATION_ID = '11111111-1111-4111-8111-111111111111';
const split = depositAndBalance(PRELAUNCH_PRICE);
const reservations = new Map<string, ReservationRecord>([
	[
		RESERVATION_ID,
		{
			id: RESERVATION_ID,
			dropSlug: '01-pineapple-haze',
			dropName: 'Pineapple Haze',
			productName: 'Pineapple Haze Tee',
			size: 'M',
			state: 'balance_due',
			pieceNumber: 7,
			lockedPrice: PRELAUNCH_PRICE,
			deposit: split.deposit,
			balance: split.balance,
			balanceDueByMs: null,
			dispatchDate: null,
			cancellationRule:
				'The deposit is refundable in full until the drop opens. After the drop opens the ' +
				'piece is cut for you and the deposit is held against it.',
			email: 'fixture@rootwear.in'
		}
	]
]);

const linesOf = (cartId: string) => {
	let map = cartLines.get(cartId);
	if (!map) {
		map = new Map();
		cartLines.set(cartId, map);
	}
	return map;
};

function couponOutcome(
	status: CouponStatus,
	discount: Paise = ZERO,
	couponId: string | null = null
): CouponOutcome {
	return { status, couponId, discount };
}

export const mockCartRepository: CartRepository = {
	async findCart(token: string): Promise<StoredCart | null> {
		const row = carts.get(token);
		return row ? { ...row } : null;
	},

	async createCart(token: string, nowMs: number): Promise<StoredCart> {
		const existing = carts.get(token);
		if (existing) return { ...existing };
		const row: MockCartRow = {
			id: randomUUID(),
			token,
			customerId: null,
			couponCode: null,
			// A cart outlives its holds; the hold is the stock claim, not the cart.
			expiresAtMs: nowMs + 30 * 24 * 60 * 60 * 1000
		};
		carts.set(token, row);
		return { ...row };
	},

	async listLines(cartId: string): Promise<StoredCartLine[]> {
		return [...linesOf(cartId).values()];
	},

	async addLine(cartId, variantId, quantity, heldUntilMs) {
		const map = linesOf(cartId);
		const existing = map.get(variantId);
		map.set(variantId, {
			variantId,
			quantity: (existing?.quantity ?? 0) + quantity,
			// Adding re-stamps the hold: the visitor just showed intent.
			heldUntilMs
		});
	},

	async setQuantity(cartId, variantId, quantity, heldUntilMs) {
		const map = linesOf(cartId);
		if (quantity <= 0) {
			map.delete(variantId);
			return;
		}
		map.set(variantId, { variantId, quantity, heldUntilMs });
	},

	async removeLine(cartId, variantId) {
		linesOf(cartId).delete(variantId);
	},

	async renewHold(cartId, heldUntilMs) {
		const map = linesOf(cartId);
		for (const [variantId, line] of map) {
			map.set(variantId, { ...line, heldUntilMs });
		}
	},

	async countHoldsElsewhere(variantId, nowMs, exceptCartId) {
		let held = 0;
		for (const [cartId, map] of cartLines) {
			if (cartId === exceptCartId) continue;
			const line = map.get(variantId);
			if (line && line.heldUntilMs > nowMs) held += line.quantity;
		}
		return held;
	},

	async committedUnits(variantId) {
		return sold.get(variantId) ?? 0;
	},

	async setCoupon(cartId, code) {
		for (const row of carts.values()) {
			if (row.id === cartId) row.couponCode = code;
		}
	},

	async validateCoupon(code: string, subtotal: Paise, kind: PaymentKind): Promise<CouponOutcome> {
		// §10, first and without exception: a coupon must NEVER be applicable to
		// a deposit or a balance payment. Checked before the code is even looked
		// up, exactly as app.apply_coupon() does it.
		if (kind === 'deposit' || kind === 'balance') {
			return couponOutcome('not_applicable_to_deposit');
		}

		const coupon = COUPONS.get(code.trim().toUpperCase());
		if (!coupon) return couponOutcome('not_found');
		if (!coupon.active) return couponOutcome('inactive', ZERO, coupon.code);

		const now = Date.now();
		if (coupon.validFromMs > now) return couponOutcome('not_yet_valid', ZERO, coupon.code);
		if (coupon.validUntilMs !== null && coupon.validUntilMs < now) {
			return couponOutcome('expired', ZERO, coupon.code);
		}
		if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
			return couponOutcome('exhausted', ZERO, coupon.code);
		}
		if (subtotal < coupon.minSubtotal) {
			return couponOutcome('below_minimum', ZERO, coupon.code);
		}

		// Integer paise throughout, floor division, exactly as the SQL does it.
		let amount =
			coupon.kind === 'percent'
				? Math.floor((subtotal * coupon.value) / 100)
				: (coupon.value as number);
		if (coupon.kind === 'percent' && coupon.maxDiscount !== null) {
			amount = Math.min(amount, coupon.maxDiscount);
		}
		amount = Math.min(amount, subtotal);

		return couponOutcome('ok', paise(amount), coupon.code);
	},

	async shippingFor(): Promise<ShippingEstimate> {
		return FLAT_RATE;
	},

	async pincodeExclusion(): Promise<string | null> {
		// public.pincode_exclusions ships empty: all of India is serviceable.
		return null;
	},

	async listAddresses(): Promise<SavedAddress[]> {
		// No fixture addresses: a guest cart is the norm (§10), and inventing a
		// saved address would make the signed-in path look tested when it is not.
		return [];
	},

	async findCustomerIdForUser(): Promise<string | null> {
		return null;
	},

	async attachCartToCustomer(cartId, customerId) {
		for (const row of carts.values()) {
			if (row.id === cartId) row.customerId = customerId;
		}
	},

	async commitOrder(input: CommitInput): Promise<CommitOutcome> {
		// Idempotent replay FIRST: a retried submit returns the SAME order.
		const replayed = idempotency.get(input.idempotencyKey);
		if (replayed) {
			const order = orders.get(replayed);
			return {
				status: 'replayed',
				orderId: replayed,
				publicToken: order?.publicToken ?? null,
				orderNumber: order?.orderNumber ?? null
			};
		}

		const cart = carts.get(input.cartToken);
		if (!cart) return { status: 'empty_cart', orderId: null, publicToken: null, orderNumber: null };

		const lines = [...linesOf(cart.id).values()];
		if (lines.length === 0) {
			return { status: 'empty_cart', orderId: null, publicToken: null, orderNumber: null };
		}

		const index = await catalogueIndex();
		const nowMs = Date.now();

		// Stock check across every line before anything is written, so a partial
		// commit is impossible — the same all-or-nothing the SQL gets from its
		// transaction.
		for (const line of lines) {
			const entry = index.get(line.variantId);
			if (!entry) {
				return { status: 'out_of_stock', orderId: null, publicToken: null, orderNumber: null };
			}
			const available = sellableStock(entry.variant) - (sold.get(line.variantId) ?? 0);
			if (available < line.quantity) {
				return { status: 'out_of_stock', orderId: null, publicToken: null, orderNumber: null };
			}
		}

		const orderId = randomUUID();
		const publicToken = randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', '');
		const orderNumber = `RW${new Date(nowMs).toISOString().slice(2, 10).replaceAll('-', '')}-${publicToken.slice(0, 5).toUpperCase()}`;

		const orderLines: OrderLineRecord[] = [];
		let subtotal: Paise = ZERO;
		let hasPreOrderLine = false;

		for (const line of lines) {
			const entry = index.get(line.variantId)!;
			// §04: the price is resolved HERE, server-side, from the drop's own
			// launch instant. Nothing the client posted influences it.
			const { unitPrice, priceSource, isPreOrder } = resolvePrice(entry.drop, entry.product, nowMs);
			hasPreOrderLine ||= isPreOrder;

			orderLines.push({
				sku: entry.variant.sku,
				name: entry.product.name,
				size: entry.variant.size,
				quantity: line.quantity,
				unitPrice,
				priceSource,
				// §08: the hand number is allocated ON PAYMENT CONFIRMATION.
				pieceNumber: null
			});

			subtotal = addPaise(subtotal, multiplyPaise(unitPrice, line.quantity));
			sold.set(line.variantId, (sold.get(line.variantId) ?? 0) + line.quantity);
		}

		// §10: the coupon is re-validated against the SERVER's subtotal after the
		// commit, never against a figure the browser sent.
		let discount: Paise = ZERO;
		if (input.couponCode) {
			const outcome = await this.validateCoupon(input.couponCode, subtotal, 'order');
			if (outcome.status === 'ok') {
				discount = outcome.discount;
				const coupon = COUPONS.get(input.couponCode.trim().toUpperCase());
				if (coupon) coupon.usedCount += 1;
			}
		}

		const total = paise(Math.max(0, subPaise(addPaise(subtotal, input.shipping), discount)));

		orders.set(orderId, {
			id: orderId,
			orderNumber,
			publicToken,
			state: 'pending_payment',
			email: input.ship.email,
			subtotal,
			shipping: input.shipping,
			discount,
			total,
			ship: input.ship,
			lines: orderLines,
			courierName: null,
			trackingRef: null,
			placedAtMs: nowMs,
			hasPreOrderLine
		});
		ordersByToken.set(publicToken, orderId);
		idempotency.set(input.idempotencyKey, orderId);

		cartLines.set(cart.id, new Map());
		cart.couponCode = null;

		return { status: 'committed', orderId, publicToken, orderNumber };
	},

	async findOrderByToken(token: string): Promise<OrderRecord | null> {
		const id = ordersByToken.get(token);
		return id ? (orders.get(id) ?? null) : null;
	},

	async recordPaymentIntent(input) {
		payments.set(input.gatewayOrderId, {
			id: randomUUID(),
			orderId: input.orderId,
			reservationId: input.reservationId,
			kind: input.kind,
			gateway: input.gateway,
			gatewayOrderId: input.gatewayOrderId,
			gatewayPaymentId: null,
			amount: input.amount,
			state: 'created'
		});
	},

	async capturePayment(input) {
		const payment = payments.get(input.gatewayOrderId);
		if (!payment) return { orderPublicToken: null, alreadyCaptured: false };

		// §04: idempotent by construction. A redelivered webhook lands here and
		// changes nothing the second time.
		if (payment.state === 'captured') {
			const order = payment.orderId ? orders.get(payment.orderId) : null;
			return { orderPublicToken: order?.publicToken ?? null, alreadyCaptured: true };
		}

		payment.state = 'captured';
		payment.gatewayPaymentId = input.gatewayPaymentId;

		let orderPublicToken: string | null = null;
		if (payment.orderId) {
			const order = orders.get(payment.orderId);
			if (order) {
				orders.set(order.id, { ...order, state: 'paid' });
				orderPublicToken = order.publicToken;
			}
		}
		if (payment.reservationId) {
			const reservation = reservations.get(payment.reservationId);
			if (reservation && payment.kind === 'balance') {
				reservations.set(reservation.id, { ...reservation, state: 'balance_paid' });
			}
		}

		return { orderPublicToken, alreadyCaptured: false };
	},

	async findPaymentIntent(input): Promise<PaymentIntentRecord | null> {
		for (const payment of payments.values()) {
			const matches =
				(input.orderId && payment.orderId === input.orderId) ||
				(input.reservationId && payment.reservationId === input.reservationId);
			if (!matches) continue;
			return {
				id: payment.id,
				gateway: payment.gateway,
				gatewayOrderId: payment.gatewayOrderId,
				amount: payment.amount,
				kind: payment.kind
			};
		}
		return null;
	},

	async findReservation(id: string): Promise<ReservationRecord | null> {
		return reservations.get(id) ?? null;
	},

	async recordWebhookEvent(input) {
		// app.webhook_events.event_id is the PRIMARY KEY. Insert-or-lose is the
		// whole idempotency guarantee (§04); a second delivery returns false.
		if (webhookEvents.has(input.eventId)) return false;
		webhookEvents.set(input.eventId, { processedAtMs: null, error: null });
		return true;
	},

	async markWebhookProcessed(eventId, errorMessage) {
		const row = webhookEvents.get(eventId);
		if (row) {
			row.processedAtMs = Date.now();
			row.error = errorMessage;
		}
	}
};

/**
 * The fixture reservation id, exported so the §08 balance surface can be
 * reached in a browser with no database: /checkout/balance/<this id>.
 */
export const MOCK_RESERVATION_ID = RESERVATION_ID;
