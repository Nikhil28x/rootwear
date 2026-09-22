/**
 * RW-130 — §03 template 08 "Account": login, order history, pre-order queue
 * with balance status, saved addresses, notify-me subscriptions, tracking link.
 *
 * These types are the account area's whole vocabulary. Rules encoded here:
 *
 * - §04: every money value is integer `Paise`. Nothing in this file is a
 *   formatted string; `formatInr()` runs at the render edge and nowhere else.
 * - §08: a reservation, its deposit, its balance payment and its final order
 *   are ONE CONTINUOUS RECORD. `PreOrder` is that record — one object, one row
 *   on screen, carrying the piece number, both halves of the money and the
 *   state, rather than three joined things the customer has to reassemble.
 * - §08/§06: reservation and order state are READ from the stored column.
 *   Never inferred from whether a payment row happens to exist.
 * - §06: an order line carries a PRICE SNAPSHOT. The archive keeps price
 *   history, so a historical order never re-derives from a live product price.
 * - §10: India only. Addresses carry a locked country and validated pincode
 *   and phone.
 */
import type { Paise } from '$lib/money';
import type { Size } from '$lib/drop/sizes';

/** Mirrors `app.reservation_state` (0001_foundations.sql). Stored, never inferred. */
export const RESERVATION_STATES = [
	'pending_payment',
	'reserved',
	'refunded_cap_race',
	'cancelled',
	'balance_due',
	'balance_paid',
	'dispatched',
	'released_to_waitlist'
] as const;

export type ReservationState = (typeof RESERVATION_STATES)[number];

/** Mirrors `app.order_state`. */
export const ORDER_STATES = [
	'pending_payment',
	'paid',
	'packed',
	'dispatched',
	'delivered',
	'cancelled',
	'refunded'
] as const;

export type OrderState = (typeof ORDER_STATES)[number];

/**
 * §10: guest checkout is on and an account is offered AFTER purchase. So the
 * auth user and the customer record are two different things, joined late —
 * by `user_id` once linked, and by email before that.
 */
export type AccountCustomer = {
	readonly id: string;
	readonly userId: string | null;
	readonly email: string;
	readonly phone: string | null;
	readonly createdAt: number;
};

/** §10: the shipping address as it was written onto the order. */
export type ShippingAddress = {
	readonly name: string;
	readonly line1: string;
	readonly line2: string | null;
	readonly city: string;
	readonly state: string;
	readonly pincode: string;
	readonly phone: string;
	readonly country: string;
};

export type OrderLine = {
	readonly id: string;
	readonly variantId: string;
	/** Denormalised at order time so an invoice survives a catalogue edit. */
	readonly sku: string;
	readonly name: string;
	/** Derived from the SKU snapshot, not from a live variant lookup. */
	readonly size: Size | null;
	readonly quantity: number;
	/** §06 PRICE SNAPSHOT — `order_lines.unit_price_paise`, never re-derived. */
	readonly unitPrice: Paise;
	readonly lineTotal: Paise;
	readonly priceSource: 'prelaunch_locked' | 'launch';
	readonly pieceNumber: number | null;
	/** §08: set when this line fulfils a pre-order, closing the one record. */
	readonly reservationId: string | null;
};

export type OrderSummary = {
	readonly id: string;
	readonly orderNumber: string;
	readonly state: OrderState;
	readonly placedAt: number;
	readonly total: Paise;
	readonly itemCount: number;
	readonly publicToken: string;
	/** §11: no carrier API in this phase — the stored reference is what we show. */
	readonly courierName: string | null;
	readonly trackingRef: string | null;
};

export type OrderDetail = OrderSummary & {
	readonly subtotal: Paise;
	readonly shipping: Paise;
	readonly discount: Paise;
	readonly tax: Paise;
	readonly notes: string | null;
	readonly dispatchedAt: number | null;
	readonly deliveredAt: number | null;
	readonly shipTo: ShippingAddress;
	readonly lines: readonly OrderLine[];
};

/**
 * §08 — THE one continuous record.
 *
 * Deposit, balance and dispatch all hang off the reservation row, and the
 * terms shown here (`lockedPrice`, `cancellationRule`, `dispatchDate`) are the
 * ones copied onto the row when it was created — a later config change cannot
 * rewrite what this customer agreed to.
 */
export type PreOrder = {
	readonly id: string;
	readonly state: ReservationState;
	readonly dropSlug: string;
	readonly dropName: string;
	readonly dropNumber: number;
	readonly productName: string;
	readonly sku: string | null;
	readonly size: Size | null;
	/** §08: allocated ON PAYMENT CONFIRMATION. Null before that, and shown as such. */
	readonly pieceNumber: number | null;
	readonly editionSize: number;
	readonly lockedPrice: Paise;
	readonly deposit: Paise;
	readonly balance: Paise;
	/** Captured payments only. Reporting, never the source of `state`. */
	readonly depositPaid: Paise;
	readonly balancePaid: Paise;
	readonly dispatchDate: string | null;
	readonly balanceDueBy: number | null;
	/** §15 RW-007: the exact wording this customer was shown, stored with them. */
	readonly cancellationRule: string;
	readonly createdAt: number;
	/** Set once the reservation has become an order — the record stays one thing. */
	readonly orderNumber: string | null;
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
	readonly country: string;
	readonly isDefault: boolean;
	readonly updatedAt: number;
};

/** What the address form yields once validated. Country is locked to IN (§10). */
export type AddressInput = {
	readonly label: string;
	readonly name: string;
	readonly line1: string;
	readonly line2: string | null;
	readonly city: string;
	readonly state: string;
	readonly pincode: string;
	readonly phone: string;
	readonly country: 'IN';
	readonly isDefault: boolean;
};

export type AddressWriteResult =
	| { readonly ok: true; readonly address: SavedAddress }
	| { readonly ok: false; readonly reason: 'not_found' | 'conflict' | 'limit' };

/** §07/§13 — notify-me, keyed by email because guests sign up without an account. */
export type NotifySubscription = {
	readonly id: string;
	readonly variantId: string;
	readonly sku: string | null;
	readonly size: Size | null;
	readonly dropSlug: string | null;
	readonly dropName: string | null;
	readonly productName: string | null;
	readonly consentedAt: number;
	readonly notifiedAt: number | null;
};

/** §08 — the waitlist is ORDERED, and the position is the customer's place in it. */
export type WaitlistSubscription = {
	readonly id: string;
	readonly variantId: string;
	readonly size: Size | null;
	readonly dropSlug: string | null;
	readonly dropName: string | null;
	readonly productName: string | null;
	readonly position: number;
	readonly state: 'waiting' | 'offered' | 'converted' | 'expired' | 'withdrawn';
	readonly joinedAt: number;
	readonly offeredAt: number | null;
};
