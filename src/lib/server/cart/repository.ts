/**
 * The cart / checkout persistence seam, mirroring src/lib/server/drops/.
 *
 * Routes import ONLY this interface. One implementation talks to fixtures
 * (so the whole flow runs with no database), the other to Postgres. The
 * catalogue itself is NOT behind this interface — prices and stock are read
 * through the DropRepository in ./pricing.ts, which already has a mock and a
 * Supabase implementation, so there is exactly one catalogue seam, not two.
 */
import type { Paise } from '$lib/money';
import type {
	CommitOutcome,
	CouponOutcome,
	OrderRecord,
	PaymentIntentRecord,
	PaymentKind,
	ReservationRecord,
	SavedAddress,
	ShipTo,
	ShippingEstimate,
	StoredCart,
	StoredCartLine
} from './types';

export type CommitInput = {
	readonly idempotencyKey: string;
	readonly cartToken: string;
	readonly ship: ShipTo;
	readonly shipping: Paise;
	/** A CODE, never an amount. Re-validated server-side after the commit. */
	readonly couponCode: string | null;
};

export interface CartRepository {
	findCart(token: string): Promise<StoredCart | null>;
	createCart(token: string, nowMs: number): Promise<StoredCart>;

	listLines(cartId: string): Promise<StoredCartLine[]>;
	/** Adds `quantity` to an existing line or creates one, re-stamping the hold. */
	addLine(cartId: string, variantId: string, quantity: number, heldUntilMs: number): Promise<void>;
	setQuantity(
		cartId: string,
		variantId: string,
		quantity: number,
		heldUntilMs: number
	): Promise<void>;
	removeLine(cartId: string, variantId: string): Promise<void>;
	renewHold(cartId: string, heldUntilMs: number): Promise<void>;

	/**
	 * §10 — what makes the hold real rather than decorative: units currently
	 * held inside OTHER carts. Subtracted from sellable stock before an add is
	 * accepted, so a live hold genuinely removes a piece from open sale until
	 * it lapses, and lapses on its own with no sweeper.
	 */
	countHoldsElsewhere(variantId: string, nowMs: number, exceptCartId: string): Promise<number>;

	/**
	 * Units already committed to orders that the CATALOGUE source has not yet
	 * reflected.
	 *
	 * Under Postgres this is always 0: app.commit_order() decrements
	 * public.variants.stock_count inside the same transaction, so the catalogue
	 * read already accounts for it. The in-memory implementation cannot mutate
	 * a frozen fixture, so it reports its own sold ledger here instead. Without
	 * this the mock would happily sell the same piece twice and the two sources
	 * would behave differently — which is the one thing the seam exists to
	 * prevent.
	 */
	committedUnits(variantId: string): Promise<number>;

	setCoupon(cartId: string, code: string | null): Promise<void>;
	/**
	 * §10: validation is SERVER-SIDE. The client sends a code, gets an amount.
	 *
	 * `cartToken`, when given, names the cart asking: a redemption held by
	 * that cart's OWN unpaid (pending_payment) order does not count against a
	 * limited-use coupon, so a retained cart is not told its code was "already
	 * used" by the order it abandoned. Paid orders always count.
	 */
	validateCoupon(
		code: string,
		subtotal: Paise,
		kind: PaymentKind,
		cartToken?: string | null
	): Promise<CouponOutcome>;

	shippingFor(subtotal: Paise): Promise<ShippingEstimate>;
	/** Returns the exclusion reason, or null when the pincode is serviceable. */
	pincodeExclusion(pincode: string): Promise<string | null>;

	listAddresses(customerId: string): Promise<SavedAddress[]>;
	findCustomerIdForUser(userId: string): Promise<string | null>;
	attachCartToCustomer(cartId: string, customerId: string): Promise<void>;

	commitOrder(input: CommitInput): Promise<CommitOutcome>;
	findOrderByToken(token: string): Promise<OrderRecord | null>;

	/**
	 * Puts a committed cart's lines back in one write (the cart outlives an
	 * unpaid order). One write rather than a line-by-line loop, so a
	 * concurrent request never reads a half-restored cart and fingerprints it
	 * as a different basket.
	 */
	restoreLines(
		cartId: string,
		lines: readonly StoredCartLine[],
		heldUntilMs: number
	): Promise<void>;

	/**
	 * The newest order this cart placed (idempotency keys under `keyPrefix`)
	 * that is still pending_payment and was placed at or after `sinceMs`.
	 * Public token, or null. Used to resolve a double-submit that arrives
	 * while the first submit has the cart momentarily empty.
	 */
	findRecentPendingOrder(keyPrefix: string, sinceMs: number): Promise<string | null>;

	/**
	 * Cancels this cart's OTHER unpaid orders — placed under `keyPrefix` but
	 * not under `keepKey` — releasing their stock and coupon redemptions.
	 * Never touches an order that is paid or has a captured payment: the
	 * state guard is in the write, not in a read before it. Returns how many
	 * orders were cancelled.
	 */
	cancelSupersededOrders(input: { keyPrefix: string; keepKey: string }): Promise<number>;

	/**
	 * Cancels every pending_payment order older than `olderThanMs`, releasing
	 * stock and coupon redemptions. Idempotent, and a payment captured
	 * concurrently wins. Returns how many orders were cancelled.
	 */
	expireUnpaidOrders(olderThanMs: number): Promise<number>;

	/**
	 * Cancels ONE unpaid order now — the buyer closed the payment window.
	 * Same guards as expiry: a paid order, or one with a captured or authorised
	 * payment, is left alone. Returns whether it was cancelled.
	 */
	cancelUnpaidOrder(orderId: string): Promise<boolean>;

	/** Records the gateway order so the webhook can find its way back. */
	recordPaymentIntent(input: {
		orderId: string | null;
		reservationId: string | null;
		kind: PaymentKind;
		gateway: string;
		gatewayOrderId: string;
		amount: Paise;
	}): Promise<void>;

	/**
	 * §04: the WEBHOOK is the source of truth. Idempotent by construction —
	 * calling it twice for the same gateway payment is a no-op the second time.
	 * Returns the order's public token so the handler can log meaningfully.
	 */
	capturePayment(input: {
		gatewayOrderId: string;
		gatewayPaymentId: string;
		amount: Paise;
	}): Promise<{
		orderPublicToken: string | null;
		alreadyCaptured: boolean;
		/**
		 * The money landed but the order had already been cancelled (expired
		 * unpaid, or superseded by a newer order from the same cart). The
		 * order is NOT revived; a cap_race refund is recorded for admin to
		 * issue, and the caller must surface it.
		 */
		refundRequired: boolean;
	}>;

	/**
	 * The gateway order this order (or reservation) is waiting on.
	 *
	 * Needed by the browser handoff — Razorpay Checkout opens against a gateway
	 * ORDER id, not ours — and by /checkout/processing, which must not guess.
	 */
	findPaymentIntent(input: {
		orderId?: string;
		reservationId?: string;
	}): Promise<PaymentIntentRecord | null>;

	findReservation(id: string): Promise<ReservationRecord | null>;

	/**
	 * Webhook de-duplication ledger. Returns false when this event_id has been
	 * seen before, which is the whole idempotency guarantee (§04).
	 */
	recordWebhookEvent(input: {
		eventId: string;
		gateway: string;
		eventType: string;
		payload: unknown;
	}): Promise<boolean>;
	markWebhookProcessed(eventId: string, errorMessage: string | null): Promise<void>;
}
