/**
 * §03 template 06 / 07 — the cart and checkout data contract.
 *
 * Two shapes matter here and they are deliberately different:
 *
 *   StoredCartLine  — what persists. It carries NO price. app.cart_lines has
 *                     no price column by design: a price captured at
 *                     add-to-cart would charge a stale figure if the drop
 *                     crossed its launch instant while the item sat in the
 *                     cart. Price is resolved server-side on EVERY read.
 *
 *   PricedCartLine  — what a render gets. Built fresh each request by
 *                     ./pricing.ts from the catalogue repository and the
 *                     request-scoped server clock.
 *
 * Every money value below is integer paise (src/lib/money.ts). Formatting
 * happens at the render edge and nowhere else.
 */
import type { Paise } from '$lib/money';
import type { Size } from '$lib/drop/sizes';
import type { DropState } from '$lib/domain/drop-state';

/** Opaque cookie value. Never a customer id, never guessable. */
export type CartToken = string;

export type StoredCart = {
	readonly id: string;
	readonly token: CartToken;
	readonly customerId: string | null;
	/** §10: the cart sends a CODE. It can never send an amount. */
	readonly couponCode: string | null;
	readonly expiresAtMs: number;
};

/** Persisted line. Note the absence of a price field — that is the point. */
export type StoredCartLine = {
	readonly variantId: string;
	readonly quantity: number;
	/** §10: the cart-reservation window, released automatically on expiry. */
	readonly heldUntilMs: number;
};

export type PriceSource = 'prelaunch_locked' | 'launch';

/** A line as rendered: catalogue facts + a price resolved a moment ago. */
export type PricedCartLine = {
	readonly variantId: string;
	readonly sku: string;
	readonly size: Size;
	readonly quantity: number;
	readonly unitPrice: Paise;
	readonly lineTotal: Paise;

	readonly productName: string;
	readonly productSlug: string;
	readonly dropSlug: string;
	readonly dropName: string;
	readonly dropState: DropState;

	readonly image: string | null;
	readonly imageAlt: string;

	readonly priceSource: PriceSource;
	/** §07/§08: the drop has not launched, so this line dispatches later. */
	readonly isPreOrder: boolean;

	readonly heldUntilMs: number;
	readonly holdActive: boolean;
	/** Units this cart could hold right now, its own quantity included. */
	readonly availableNow: number;
	/** True when other carts or other buyers took the stock this line wanted. */
	readonly overSubscribed: boolean;
};

export type CouponStatus =
	| 'ok'
	| 'not_found'
	| 'inactive'
	| 'expired'
	| 'not_yet_valid'
	| 'exhausted'
	| 'below_minimum'
	| 'not_applicable_to_deposit';

export type CouponOutcome = {
	readonly status: CouponStatus;
	readonly couponId: string | null;
	readonly discount: Paise;
};

/** §10: a coupon must NEVER apply to a deposit or a balance payment. */
export type PaymentKind = 'order' | 'deposit' | 'balance';

export type ShippingEstimate = {
	readonly label: string;
	readonly rate: Paise;
};

export type CartTotals = {
	readonly subtotal: Paise;
	readonly discount: Paise;
	readonly shipping: Paise;
	readonly total: Paise;
};

export type CartView = {
	readonly token: CartToken | null;
	readonly lines: PricedCartLine[];
	readonly totals: CartTotals;
	readonly shipping: ShippingEstimate;
	readonly couponCode: string | null;
	/** Set when a previously applied coupon stopped validating server-side. */
	readonly couponProblem: CouponStatus | null;
	/** Earliest live hold across the cart, or null when nothing is held. */
	readonly soonestHoldMs: number | null;
	readonly holdMinutes: number;
	readonly hasPreOrderLine: boolean;
	/** The instant this view was priced, from the request-scoped server clock. */
	readonly pricedAtMs: number;
};

export type SavedAddress = {
	readonly id: string;
	readonly label: string;
	readonly name: string;
	readonly line1: string;
	readonly line2: string | null;
	readonly city: string;
	readonly state: string;
	readonly pincode: string;
	readonly phone: string;
};

export type ShipTo = {
	readonly email: string;
	readonly name: string;
	readonly line1: string;
	readonly line2: string | null;
	readonly city: string;
	readonly state: string;
	readonly pincode: string;
	readonly phone: string;
	readonly notes: string | null;
};

export type CommitStatus = 'committed' | 'replayed' | 'out_of_stock' | 'empty_cart';

export type CommitOutcome = {
	readonly status: CommitStatus;
	readonly orderId: string | null;
	readonly publicToken: string | null;
	readonly orderNumber: string | null;
};

export type OrderLineRecord = {
	readonly sku: string;
	readonly name: string;
	readonly size: Size | null;
	readonly quantity: number;
	readonly unitPrice: Paise;
	readonly priceSource: PriceSource;
	readonly pieceNumber: number | null;
};

export type OrderState =
	'pending_payment' | 'paid' | 'packed' | 'dispatched' | 'delivered' | 'cancelled' | 'refunded';

export type OrderRecord = {
	readonly id: string;
	readonly orderNumber: string;
	readonly publicToken: string;
	readonly state: OrderState;
	readonly email: string;
	readonly subtotal: Paise;
	readonly shipping: Paise;
	readonly discount: Paise;
	readonly total: Paise;
	readonly ship: ShipTo;
	readonly lines: OrderLineRecord[];
	readonly courierName: string | null;
	readonly trackingRef: string | null;
	readonly placedAtMs: number;
	readonly hasPreOrderLine: boolean;
};

/**
 * §08 — a reservation, its deposit, its balance and its order are ONE record.
 * Read here (not imported from the account module) because area 4 owns that
 * tree; the balance payment screen is a checkout surface.
 */
export type ReservationRecord = {
	readonly id: string;
	readonly dropSlug: string;
	readonly dropName: string;
	readonly productName: string;
	readonly size: Size;
	readonly state: string;
	readonly pieceNumber: number | null;
	readonly lockedPrice: Paise;
	readonly deposit: Paise;
	readonly balance: Paise;
	readonly balanceDueByMs: number | null;
	readonly dispatchDate: string | null;
	readonly cancellationRule: string;
	readonly email: string;
};

export type PaymentIntentRecord = {
	readonly id: string;
	readonly gateway: string;
	readonly gatewayOrderId: string;
	readonly amount: Paise;
	readonly kind: PaymentKind;
};
