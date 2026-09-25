/**
 * RW-132 — The account fixture store.
 *
 * WHY THIS EXISTS: §10 keeps guest checkout on and offers an account AFTER
 * purchase, which means the account area is reviewable long before anyone has
 * signed up. The drops repository already lets the storefront run with no
 * database; this does the same for one customer's records — orders,
 * reservations, addresses, notify-me and the waitlist.
 *
 * THREE RULES kept it honest:
 *
 *  1. The catalogue is NOT duplicated. Every record points at a variant id
 *     that `drops.listDrops()` actually returns, so a fixture can never
 *     describe a garment the storefront does not have. Add a drop and the
 *     records below attach to it.
 *
 *  2. Nothing here is presented as real. The account chrome renders a standing
 *     notice whenever the area is running on fixtures, so a reviewer cannot
 *     mistake these for a live customer's orders. That notice is the reason
 *     this file may generate an order for a drop that has not launched yet:
 *     the screens have to be reviewable, and the label removes the only harm.
 *
 *  3. No Math.random(). Two page loads of /account must agree, or the area is
 *     untestable and every screenshot is a different story.
 *
 * Emails use the reserved .invalid TLD (RFC 2606) so a fixture address can
 * never be mistaken for, or accidentally mailed to, a real person.
 */
import { drops } from '$lib/server/drops';
import type { Drop, Variant } from '$lib/domain/drop';
import { depositAndBalance, LAUNCH_PRICE, PRELAUNCH_PRICE } from '$lib/config/commerce';
import { addPaise, fromRupees, multiplyPaise, paise, ZERO, type Paise } from '$lib/money';
import type { OrderState, ReservationState } from './types';

const DAY = 86_400_000;

/**
 * §15 open item RW-007 — the cancellation rule attached to a deposit is a
 * consumer-law exposure and has not been answered. A fixture must not invent
 * one. `app.reservations.cancellation_rule` is a per-row column precisely so
 * each customer's record carries the wording THEY were shown; making one up
 * here would put words in the owner's mouth, so the fixture records the open
 * item instead and the screen prints exactly that.
 */
export const CANCELLATION_RULE_UNSETTLED =
	'Deposit cancellation terms were not settled when this record was created ' +
	'(open item RW-007). A live reservation stores the exact wording shown to that customer.';

/* -------------------------------------------------------------------------- */
/* Stored shapes — one per table these fixtures stand in for.                   */
/* -------------------------------------------------------------------------- */

export type StoredCustomer = {
	id: string;
	userId: string | null;
	email: string;
	phone: string | null;
	createdAt: number;
};

export type StoredAddress = {
	id: string;
	customerId: string;
	label: string;
	name: string;
	line1: string;
	line2: string | null;
	city: string;
	state: string;
	pincode: string;
	phone: string;
	country: string;
	isDefault: boolean;
	createdAt: number;
	updatedAt: number;
};

/** Mirrors app.reservations. State is STORED, never inferred from payments. */
export type StoredReservation = {
	id: string;
	dropId: string;
	variantId: string;
	customerId: string;
	state: ReservationState;
	pieceNumber: number | null;
	lockedPrice: Paise;
	deposit: Paise;
	balance: Paise;
	dispatchDate: string | null;
	balanceDueBy: number | null;
	cancellationRule: string;
	createdAt: number;
};

/** Mirrors app.order_lines, price snapshot and all. */
export type StoredOrderLine = {
	id: string;
	orderId: string;
	variantId: string;
	reservationId: string | null;
	quantity: number;
	unitPrice: Paise;
	priceSource: 'prelaunch_locked' | 'launch';
	pieceNumber: number | null;
	skuSnapshot: string;
	nameSnapshot: string;
};

export type StoredOrder = {
	id: string;
	orderNumber: string;
	customerId: string;
	state: OrderState;
	subtotal: Paise;
	shipping: Paise;
	discount: Paise;
	tax: Paise;
	total: Paise;
	shipName: string;
	shipLine1: string;
	shipLine2: string | null;
	shipCity: string;
	shipState: string;
	shipPincode: string;
	shipPhone: string;
	shipCountry: string;
	notes: string | null;
	courierName: string | null;
	trackingRef: string | null;
	dispatchedAt: number | null;
	deliveredAt: number | null;
	publicToken: string;
	createdAt: number;
};

/** Mirrors app.payments. Reporting only — it never decides a reservation state. */
export type StoredPayment = {
	id: string;
	orderId: string | null;
	reservationId: string | null;
	kind: 'deposit' | 'balance' | 'order';
	amount: Paise;
	state: 'created' | 'authorized' | 'captured' | 'failed' | 'refunded';
	createdAt: number;
};

export type StoredNotify = {
	id: string;
	variantId: string;
	email: string;
	consentedAt: number;
	consentSource: string;
	notifiedAt: number | null;
};

export type StoredWaitlist = {
	id: string;
	dropId: string;
	variantId: string;
	customerId: string;
	position: number;
	state: 'waiting' | 'offered' | 'converted' | 'expired' | 'withdrawn';
	offeredAt: number | null;
	createdAt: number;
};

export type AccountFixtureStore = {
	customer: StoredCustomer;
	addresses: StoredAddress[];
	reservations: StoredReservation[];
	orders: StoredOrder[];
	orderLines: StoredOrderLine[];
	payments: StoredPayment[];
	notifies: StoredNotify[];
	waitlist: StoredWaitlist[];
	/** Monotonic id source for rows the reviewer adds through the forms. */
	nextId: number;
};

/* -------------------------------------------------------------------------- */
/* Generation                                                                   */
/* -------------------------------------------------------------------------- */

export const FIXTURE_CUSTOMER_ID = 'customer-fixture-01';
export const FIXTURE_EMAIL = 'preview@rootwear.invalid';

function variantBySize(drop: Drop, size: string): Variant | null {
	for (const product of drop.products) {
		const match = product.variants.find((variant) => variant.size === size);
		if (match) return match;
	}
	return null;
}

function productNameFor(drop: Drop, variantId: string): string {
	for (const product of drop.products) {
		if (product.variants.some((variant) => variant.id === variantId)) return product.name;
	}
	return drop.name;
}

function addresses(now: number): StoredAddress[] {
	return [
		{
			id: 'address-fixture-home',
			customerId: FIXTURE_CUSTOMER_ID,
			label: 'Home',
			name: 'A. Menon',
			line1: '14 Kasturba Road',
			line2: 'Flat 3B, Sunhaven',
			city: 'Bengaluru',
			state: 'Karnataka',
			pincode: '560001',
			phone: '9845012345',
			country: 'IN',
			isDefault: true,
			createdAt: now - 96 * DAY,
			updatedAt: now - 12 * DAY
		},
		{
			id: 'address-fixture-studio',
			customerId: FIXTURE_CUSTOMER_ID,
			label: 'Studio',
			name: 'A. Menon',
			line1: '221 Hill Road',
			line2: null,
			city: 'Mumbai',
			state: 'Maharashtra',
			pincode: '400050',
			phone: '9820011223',
			country: 'IN',
			isDefault: false,
			createdAt: now - 40 * DAY,
			updatedAt: now - 40 * DAY
		}
	];
}

/**
 * §08 — four reservations, deliberately spread across four different stored
 * states, because the pre-order screen has to be reviewable in each: one
 * awaiting its deposit (no piece number yet), one reserved, one whose balance
 * is due, and one already dispatched and therefore closed by an order.
 */
function buildForDrop(drop: Drop, now: number, store: AccountFixtureStore): void {
	const split = depositAndBalance(PRELAUNCH_PRICE);
	const dispatchDate = new Date(drop.launchInstant + 14 * DAY).toISOString().slice(0, 10);

	const plan: Array<{
		size: string;
		state: ReservationState;
		piece: number | null;
		createdAt: number;
		balanceDueBy: number | null;
		depositCaptured: boolean;
		balanceCaptured: boolean;
	}> = [
		{
			size: 'M',
			state: 'reserved',
			piece: 7,
			createdAt: now - 6 * DAY,
			balanceDueBy: drop.launchInstant + 5 * DAY,
			depositCaptured: true,
			balanceCaptured: false
		},
		{
			size: 'L',
			state: 'balance_due',
			piece: 12,
			createdAt: now - 5 * DAY,
			balanceDueBy: now + 3 * DAY,
			depositCaptured: true,
			balanceCaptured: false
		},
		{
			size: 'S',
			state: 'pending_payment',
			piece: null,
			createdAt: now - 40 * 60_000,
			balanceDueBy: null,
			depositCaptured: false,
			balanceCaptured: false
		},
		{
			size: 'XL',
			state: 'dispatched',
			piece: 3,
			createdAt: now - 9 * DAY,
			balanceDueBy: now - 4 * DAY,
			depositCaptured: true,
			balanceCaptured: true
		}
	];

	for (const row of plan) {
		const variant = variantBySize(drop, row.size);
		if (!variant) continue;

		const id = `reservation-${drop.id}-${row.size.toLowerCase()}`;
		store.reservations.push({
			id,
			dropId: drop.id,
			variantId: variant.id,
			customerId: FIXTURE_CUSTOMER_ID,
			state: row.state,
			pieceNumber: row.piece,
			lockedPrice: PRELAUNCH_PRICE,
			deposit: split.deposit,
			balance: split.balance,
			dispatchDate,
			balanceDueBy: row.balanceDueBy,
			cancellationRule: CANCELLATION_RULE_UNSETTLED,
			createdAt: row.createdAt
		});

		if (row.depositCaptured) {
			store.payments.push({
				id: `payment-${id}-deposit`,
				orderId: null,
				reservationId: id,
				kind: 'deposit',
				amount: split.deposit,
				state: 'captured',
				createdAt: row.createdAt + 60_000
			});
		}

		if (row.balanceCaptured) {
			store.payments.push({
				id: `payment-${id}-balance`,
				orderId: null,
				reservationId: id,
				kind: 'balance',
				amount: split.balance,
				state: 'captured',
				createdAt: row.createdAt + 3 * DAY
			});
		}

		// §08: the dispatched reservation is closed by an order, and that order
		// is the SAME record — the line carries reservation_id and the piece.
		if (row.state === 'dispatched' && row.piece !== null) {
			const orderId = `order-${drop.id}-preorder`;
			store.orders.push({
				id: orderId,
				orderNumber: `RW-${drop.number.toString().padStart(2, '0')}0148`,
				customerId: FIXTURE_CUSTOMER_ID,
				state: 'dispatched',
				subtotal: PRELAUNCH_PRICE,
				shipping: ZERO,
				discount: ZERO,
				tax: ZERO,
				total: PRELAUNCH_PRICE,
				shipName: 'A. Menon',
				shipLine1: '14 Kasturba Road',
				shipLine2: 'Flat 3B, Sunhaven',
				shipCity: 'Bengaluru',
				shipState: 'Karnataka',
				shipPincode: '560001',
				shipPhone: '9845012345',
				shipCountry: 'IN',
				notes: 'Leave with building security if nobody answers.',
				courierName: 'Delhivery',
				trackingRef: 'DL4821770915IN',
				dispatchedAt: now - 2 * DAY,
				deliveredAt: null,
				publicToken: 'fixture-token-preorder',
				createdAt: row.createdAt + 3 * DAY
			});

			store.orderLines.push({
				id: `${orderId}-line-1`,
				orderId,
				variantId: variant.id,
				reservationId: id,
				quantity: 1,
				// §06 PRICE SNAPSHOT: the tease price this customer locked in,
				// which is NOT what the same garment costs on the site today.
				unitPrice: PRELAUNCH_PRICE,
				priceSource: 'prelaunch_locked',
				pieceNumber: row.piece,
				skuSnapshot: variant.sku,
				nameSnapshot: productNameFor(drop, variant.id)
			});
		}
	}

	// An open-sale order, so the archive holds both price sources side by side.
	const openVariant = variantBySize(drop, 'M');
	if (openVariant) {
		const orderId = `order-${drop.id}-open`;
		const shipping = fromRupees(120);
		const subtotal = multiplyPaise(LAUNCH_PRICE, 1);
		store.orders.push({
			id: orderId,
			orderNumber: `RW-${drop.number.toString().padStart(2, '0')}0273`,
			customerId: FIXTURE_CUSTOMER_ID,
			state: 'paid',
			subtotal,
			shipping,
			discount: ZERO,
			tax: ZERO,
			total: addPaise(subtotal, shipping),
			shipName: 'A. Menon',
			shipLine1: '221 Hill Road',
			shipLine2: null,
			shipCity: 'Mumbai',
			shipState: 'Maharashtra',
			shipPincode: '400050',
			shipPhone: '9820011223',
			shipCountry: 'IN',
			notes: null,
			courierName: null,
			trackingRef: null,
			dispatchedAt: null,
			deliveredAt: null,
			publicToken: 'fixture-token-open',
			createdAt: now - 1 * DAY
		});

		store.orderLines.push({
			id: `${orderId}-line-1`,
			orderId,
			variantId: openVariant.id,
			reservationId: null,
			quantity: 1,
			unitPrice: LAUNCH_PRICE,
			priceSource: 'launch',
			pieceNumber: null,
			skuSnapshot: openVariant.sku,
			nameSnapshot: productNameFor(drop, openVariant.id)
		});

		store.payments.push({
			id: `payment-${orderId}`,
			orderId,
			reservationId: null,
			kind: 'order',
			amount: addPaise(subtotal, shipping),
			state: 'captured',
			createdAt: now - 1 * DAY + 90_000
		});
	}

	// §07/§13 notify-me is keyed by email, not by account.
	const xs = variantBySize(drop, 'XS');
	if (xs) {
		store.notifies.push({
			id: `notify-${xs.id}`,
			variantId: xs.id,
			email: FIXTURE_EMAIL,
			consentedAt: now - 11 * DAY,
			consentSource: 'product_page',
			notifiedAt: null
		});
	}

	const large = variantBySize(drop, 'L');
	if (large) {
		store.notifies.push({
			id: `notify-${large.id}`,
			variantId: large.id,
			email: FIXTURE_EMAIL,
			consentedAt: now - 20 * DAY,
			consentSource: 'product_page',
			notifiedAt: now - 3 * DAY
		});
	}

	// §08 overflow: a place in the ORDERED queue, with no money taken.
	const medium = variantBySize(drop, 'M');
	if (medium) {
		store.waitlist.push({
			id: `waitlist-${medium.id}`,
			dropId: drop.id,
			variantId: medium.id,
			customerId: FIXTURE_CUSTOMER_ID,
			position: 3,
			state: 'waiting',
			offeredAt: null,
			createdAt: now - 8 * DAY
		});
	}
}

let cached: AccountFixtureStore | null = null;

/**
 * Built once and then MUTATED by the address forms, so an add, an edit, a
 * delete and a change of default all behave the way they will against Postgres
 * for as long as the dev server is up. Module scope is safe here because the
 * store holds exactly one fixture customer and no request state.
 */
export async function accountFixtures(now: number): Promise<AccountFixtureStore> {
	if (cached) return cached;

	const store: AccountFixtureStore = {
		customer: {
			id: FIXTURE_CUSTOMER_ID,
			userId: null,
			email: FIXTURE_EMAIL,
			phone: '9845012345',
			createdAt: now - 96 * DAY
		},
		addresses: addresses(now),
		reservations: [],
		orders: [],
		orderLines: [],
		payments: [],
		notifies: [],
		waitlist: [],
		nextId: 1
	};

	for (const drop of await drops.listDrops()) buildForDrop(drop, now, store);

	store.reservations.sort((a, b) => b.createdAt - a.createdAt);
	store.orders.sort((a, b) => b.createdAt - a.createdAt);

	cached = store;
	return store;
}

/** Sum a money column without leaving the Paise type. */
export function sumPaise(values: Paise[]): Paise {
	return values.length === 0 ? ZERO : addPaise(...values);
}

export function toPaise(value: number): Paise {
	return paise(Math.round(value));
}
