/**
 * RW-144 — The admin fixture store.
 *
 * WHY THIS EXISTS: the whole admin area has to be reviewable before Supabase
 * is provisioned. The drops repository already solves that for the catalogue;
 * this does the same for the transactional side — reservations, payments,
 * orders, demand and contact — so every screen has something real-shaped to
 * render with CATALOGUE_SOURCE=mock and no database.
 *
 * TWO RULES kept it honest:
 *
 *  1. The catalogue is NOT duplicated here. Everything is generated against
 *     whatever `drops.listDrops()` returns, so admin and the storefront can
 *     never disagree about which drops exist, what state they are in, or how
 *     deep each size runs. Add a drop to the drops fixtures and it appears
 *     here automatically.
 *
 *  2. Nothing is generated that the drop's own timeline does not permit. A
 *     drop that has not reached its launch instant gets tease-phase records
 *     only — deposits, waitlist, notify-me — and no open sale. Fabricating
 *     sales for an unlaunched drop would make the one report §12 calls "the
 *     number that decides how big Drop 02 is cut" a lie.
 *
 * Emails use the reserved .invalid TLD (RFC 2606) so a fixture address can
 * never be mistaken for, or accidentally mailed to, a real person.
 */
import { drops } from '$lib/server/drops';
import { sellableStock, type Drop, type Variant } from '$lib/domain/drop';
import { isOnSale } from '$lib/domain/drop-state';
import type { DropState } from '$lib/domain/drop-state';
import { depositAndBalance, LAUNCH_PRICE, PRELAUNCH_PRICE } from '$lib/config/commerce';
import { addPaise, paise, ZERO, type Paise } from '$lib/money';
import type { Size } from '$lib/drop/sizes';
/**
 * §15 open item RW-007 — the cancellation rule for a deposit is a consumer-law
 * exposure and has not been answered. A fixture must not invent one: the
 * column is stored per reservation precisely so each customer's row carries
 * the wording THEY were shown, and making one up here would put words in
 * Aaron's mouth. So the fixture records the open item instead.
 */
const CANCELLATION_RULE_UNSETTLED =
	'Deposit cancellation terms were not settled when this record was created ' +
	'(open item RW-007). A live reservation stores the exact wording shown to that customer.';
import type { ContactStatus, OrderState, ReservationState, ShipTo } from './types';

const DAY = 86_400_000;
const HOUR = 3_600_000;
const MINUTE = 60_000;

/* -------------------------------------------------------------------------- */
/* Deterministic generation. No Math.random(): two page loads must agree.       */
/* -------------------------------------------------------------------------- */

function seedOf(text: string): number {
	let h = 2166136261;
	for (let i = 0; i < text.length; i++) {
		h ^= text.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}

/** Stable pseudo-random in [0,1) from a string key and an index. */
function jitter(key: string, index: number): number {
	const x = Math.imul(seedOf(key) ^ Math.imul(index + 1, 2654435761), 1597334677) >>> 0;
	return x / 4294967296;
}

function pick<T>(items: readonly T[], key: string, index: number): T {
	return items[Math.floor(jitter(key, index) * items.length) % items.length];
}

/* -------------------------------------------------------------------------- */
/* Stored shapes — one per table these fixtures stand in for.                   */
/* -------------------------------------------------------------------------- */

export type StoredEvent = { at: number; label: string; detail: string | null };

export type StoredReservation = {
	id: string;
	dropId: string;
	variantId: string;
	email: string;
	state: ReservationState;
	pieceNumber: number | null;
	lockedPrice: Paise;
	deposit: Paise;
	balance: Paise;
	balanceDueBy: number | null;
	dispatchDate: string | null;
	cancellationRule: string;
	createdAt: number;
	orderId: string | null;
	events: StoredEvent[];
};

export type StoredPayment = {
	id: string;
	orderId: string | null;
	reservationId: string | null;
	kind: 'deposit' | 'balance' | 'order';
	gateway: string;
	state: 'created' | 'authorized' | 'captured' | 'failed' | 'refunded';
	amount: Paise;
	createdAt: number;
	gatewayPaymentId: string | null;
};

export type StoredRefund = {
	id: string;
	paymentId: string;
	reservationId: string | null;
	amount: Paise;
	reason: 'cap_race' | 'cancellation' | 'defect' | 'admin';
	state: 'initiated' | 'processed' | 'failed';
	createdAt: number;
};

export type StoredOrderLine = {
	id: string;
	variantId: string;
	sku: string;
	name: string;
	size: Size;
	quantity: number;
	unitPrice: Paise;
	priceSource: 'prelaunch_locked' | 'launch';
	pieceNumber: number | null;
	reservationId: string | null;
};

export type StoredOrder = {
	id: string;
	orderNumber: string;
	dropId: string;
	email: string;
	state: OrderState;
	subtotal: Paise;
	shipping: Paise;
	discount: Paise;
	tax: Paise;
	total: Paise;
	shipTo: ShipTo;
	notes: string | null;
	courierName: string | null;
	trackingRef: string | null;
	dispatchedAt: number | null;
	createdAt: number;
	lines: StoredOrderLine[];
};

export type StoredRequest = {
	id: string;
	dropId: string;
	variantId: string;
	email: string;
	note: string | null;
	createdAt: number;
	fulfilledAt: number | null;
};

export type StoredNotify = {
	id: string;
	variantId: string;
	email: string;
	createdAt: number;
	notifiedAt: number | null;
};

export type StoredWaitlist = {
	id: string;
	dropId: string;
	variantId: string;
	email: string;
	position: number;
	state: 'waiting' | 'offered' | 'converted' | 'expired' | 'withdrawn';
	createdAt: number;
};

export type StoredContact = {
	id: string;
	name: string;
	email: string;
	subject: string;
	message: string;
	status: ContactStatus;
	isSpam: boolean;
	createdAt: number;
};

/**
 * Admin edits land here. A fixture run is in-memory: it does not survive a restart.
 *
 * `launchInstant` moves the schedule MARKER only. The reservations, orders and
 * payments below were generated against the drop's original launch instant and
 * are deliberately not regenerated when it is edited — a fixture rewriting its
 * own history on every edit would make the sell-out curve unreadable. Against
 * Postgres the same edit moves only the column, and the recorded timestamps are
 * likewise untouched, so the two implementations behave alike.
 */
export type DropOverride = { state?: DropState; published?: boolean; launchInstant?: number };
export type VariantOverride = { stockCount?: number; reserveCap?: number };

export type FixtureStore = {
	generatedFor: number;
	dropsIndex: Drop[];
	reservations: StoredReservation[];
	payments: StoredPayment[];
	refunds: StoredRefund[];
	orders: StoredOrder[];
	requests: StoredRequest[];
	notifies: StoredNotify[];
	waitlist: StoredWaitlist[];
	contact: StoredContact[];
	dropOverrides: Map<string, DropOverride>;
	variantOverrides: Map<string, VariantOverride>;
	audit: Array<{ at: number; actor: string; action: string; entity: string; entityId: string }>;
};

/* -------------------------------------------------------------------------- */
/* Address pool — §10 India only, valid pincode and phone shapes.               */
/* -------------------------------------------------------------------------- */

const PLACES = [
	{ city: 'Mumbai', state: 'Maharashtra', pincode: '400001' },
	{ city: 'Bengaluru', state: 'Karnataka', pincode: '560001' },
	{ city: 'New Delhi', state: 'Delhi', pincode: '110001' },
	{ city: 'Chennai', state: 'Tamil Nadu', pincode: '600001' },
	{ city: 'Kolkata', state: 'West Bengal', pincode: '700001' },
	{ city: 'Ahmedabad', state: 'Gujarat', pincode: '380001' },
	{ city: 'Hyderabad', state: 'Telangana', pincode: '500001' },
	{ city: 'Kochi', state: 'Kerala', pincode: '682001' }
] as const;

function fixtureEmail(n: number): string {
	return `fixture.${String(n).padStart(2, '0')}@example.invalid`;
}

function fixtureName(n: number): string {
	return `Fixture Customer ${String(n).padStart(2, '0')}`;
}

function shipTo(n: number, key: string): ShipTo {
	const place = pick(PLACES, key, n);
	return {
		name: fixtureName(n),
		line1: `${10 + (n % 80)} Sample Street`,
		line2: n % 3 === 0 ? `Flat ${1 + (n % 9)}0${1 + (n % 5)}` : null,
		city: place.city,
		state: place.state,
		pincode: place.pincode,
		// §10 phone shape ^[6-9][0-9]{9}$.
		phone: `9${String(800000000 + n * 7919).slice(0, 9)}`,
		country: 'IN'
	};
}

/* -------------------------------------------------------------------------- */
/* Generation                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * A reservation's life, as §08 describes it, spread over the states that can
 * legitimately exist at `now`. The order of this list is the order the
 * generator walks, so the earliest pieces are the furthest along.
 */
function reservationStateFor(index: number, launched: boolean): ReservationState {
	if (!launched) {
		// Pre-launch: deposits confirmed, one balance cleared early, one chased.
		if (index === 0) return 'balance_paid';
		if (index === 1) return 'balance_due';
		if (index === 4) return 'balance_due';
		return 'reserved';
	}
	if (index === 0) return 'dispatched';
	if (index === 1) return 'balance_paid';
	if (index === 2) return 'balance_due';
	return 'reserved';
}

function buildForDrop(drop: Drop, now: number, store: FixtureStore, counter: { n: number }): void {
	const launched = now >= drop.launchInstant;
	const teaseStart = drop.launchInstant - 10 * DAY;
	const { deposit, balance } = depositAndBalance(PRELAUNCH_PRICE);

	let piece = 0;

	for (const product of drop.products) {
		for (const variant of product.variants) {
			/* ---- reservations: exactly variant.reservedCount allocated pieces ---- */
			for (let i = 0; i < variant.reservedCount; i++) {
				piece += 1;
				counter.n += 1;
				const n = counter.n;
				const key = `${variant.id}:res`;
				const createdAt = Math.min(
					now - HOUR,
					teaseStart + Math.floor(jitter(key, i) * 9 * DAY)
				);
				const state = reservationStateFor(piece - 1, launched);
				/* Nothing is dated after `now`. A fixture that reports an order
				   placed tomorrow makes every report downstream of it a lie. */
				const balanceAt = Math.min(createdAt + 5 * DAY, now - 2 * HOUR);
				const orderAt = Math.min(balanceAt + HOUR, now - HOUR);
				const dispatchAt = Math.min(createdAt + 7 * DAY, now - 30 * MINUTE);
				const events: StoredEvent[] = [
					{ at: createdAt, label: 'Reservation opened', detail: `${variant.sku} · deposit initiated` },
					{
						at: createdAt + 4 * MINUTE,
						label: 'Deposit confirmed',
						detail: `Piece ${piece} of ${drop.editionSize} allocated on payment confirmation`
					}
				];

				let balanceDueBy: number | null = null;
				let orderId: string | null = null;

				if (state === 'balance_due') {
					// One overdue, one still in window — the ledger needs both.
					const overdue = i % 2 === 0;
					balanceDueBy = overdue ? now - 2 * DAY : now + 5 * DAY;
					events.push({
						at: Math.min(createdAt + 3 * DAY, now - 3 * HOUR),
						label: 'Balance link sent',
						detail: overdue ? 'Due date has passed' : 'Awaiting payment'
					});
				}

				if (state === 'balance_paid' || state === 'dispatched') {
					balanceDueBy = createdAt + 6 * DAY;
					events.push({
						at: balanceAt,
						label: 'Balance cleared',
						detail: 'Reservation is dispatchable'
					});
				}

				const reservation: StoredReservation = {
					id: `res-${drop.slug}-${String(piece).padStart(2, '0')}`,
					dropId: drop.id,
					variantId: variant.id,
					email: fixtureEmail(n),
					state,
					pieceNumber: piece,
					lockedPrice: PRELAUNCH_PRICE,
					deposit,
					balance,
					balanceDueBy,
					dispatchDate: null,
					// §15 RW-007: the wording in force is copied onto the row.
					cancellationRule: CANCELLATION_RULE_UNSETTLED,
					createdAt,
					orderId,
					events
				};

				store.payments.push({
					id: `pay-${reservation.id}-d`,
					orderId: null,
					reservationId: reservation.id,
					kind: 'deposit',
					gateway: 'fixture',
					state: 'captured',
					amount: deposit,
					createdAt: createdAt + 3 * MINUTE,
					gatewayPaymentId: `fixture_${reservation.id}_d`
				});

				if (state === 'balance_paid' || state === 'dispatched') {
					store.payments.push({
						id: `pay-${reservation.id}-b`,
						orderId: null,
						reservationId: reservation.id,
						kind: 'balance',
						gateway: 'fixture',
						state: 'captured',
						amount: balance,
						createdAt: balanceAt,
						gatewayPaymentId: `fixture_${reservation.id}_b`
					});

					/* §08: deposit, balance and the final order are ONE record. The
					   order row is created when the balance clears, and its line
					   carries the reservation id and the piece number. */
					orderId = `ord-${reservation.id}`;
					const ship = shipTo(n, `${variant.id}:ship`);
					const line: StoredOrderLine = {
						id: `line-${orderId}`,
						variantId: variant.id,
						sku: variant.sku,
						name: product.name,
						size: variant.size,
						quantity: 1,
						unitPrice: PRELAUNCH_PRICE,
						priceSource: 'prelaunch_locked',
						pieceNumber: piece,
						reservationId: reservation.id
					};
					store.orders.push({
						id: orderId,
						orderNumber: `RW${String(drop.number).padStart(2, '0')}P-${String(piece).padStart(3, '0')}`,
						dropId: drop.id,
						email: reservation.email,
						state: state === 'dispatched' ? 'dispatched' : 'paid',
						subtotal: PRELAUNCH_PRICE,
						shipping: ZERO,
						discount: ZERO,
						tax: ZERO,
						total: PRELAUNCH_PRICE,
						shipTo: ship,
						// §10 order-notes field, and §08's pre-order dispatch note.
						notes: i === 0 ? 'Please leave with the building security desk.' : null,
						courierName: state === 'dispatched' ? 'Porter' : null,
						trackingRef: state === 'dispatched' ? `PTR${String(n).padStart(7, '0')}` : null,
						dispatchedAt: state === 'dispatched' ? dispatchAt : null,
						createdAt: orderAt,
						lines: [line]
					});
					reservation.orderId = orderId;
					events.push({
						at: orderAt,
						label: 'Order created',
						detail: `Piece ${piece} · pre-order, dispatches with the drop`
					});
					if (state === 'dispatched') {
						events.push({
							at: dispatchAt,
							label: 'Dispatched',
							detail: 'Porter · handed over'
						});
					}
				}

				store.reservations.push(reservation);
			}

			/* ---- one cap-race loser per drop, refunded automatically (§08) ---- */
			if (variant.size === 'M') {
				counter.n += 1;
				const n = counter.n;
				const createdAt = Math.min(now - 2 * HOUR, teaseStart + 8 * DAY);
				const lost: StoredReservation = {
					id: `res-${drop.slug}-cap`,
					dropId: drop.id,
					variantId: variant.id,
					email: fixtureEmail(n),
					state: 'refunded_cap_race',
					pieceNumber: null,
					lockedPrice: PRELAUNCH_PRICE,
					deposit,
					balance,
					balanceDueBy: null,
					dispatchDate: null,
					cancellationRule: CANCELLATION_RULE_UNSETTLED,
					createdAt,
					orderId: null,
					events: [
						{ at: createdAt, label: 'Reservation opened', detail: `${variant.sku} · deposit initiated` },
						{
							at: createdAt + 2 * MINUTE,
							label: 'Cap full',
							detail: 'Lost the allocation race — no piece number issued'
						},
						{
							at: createdAt + 3 * MINUTE,
							label: 'Refunded automatically',
							detail: 'Deposit returned in full and the customer told immediately'
						}
					]
				};
				const payment: StoredPayment = {
					id: `pay-${lost.id}-d`,
					orderId: null,
					reservationId: lost.id,
					kind: 'deposit',
					gateway: 'fixture',
					state: 'refunded',
					amount: deposit,
					createdAt: createdAt + MINUTE,
					gatewayPaymentId: `fixture_${lost.id}_d`
				};
				store.payments.push(payment);
				store.refunds.push({
					id: `ref-${lost.id}`,
					paymentId: payment.id,
					reservationId: lost.id,
					amount: deposit,
					reason: 'cap_race',
					state: 'processed',
					createdAt: createdAt + 3 * MINUTE
				});
				store.reservations.push(lost);
			}

			/* ---- open sale: only once the drop has actually launched ---- */
			if (launched && isOnSale(drop.state)) {
				const sellable = sellableStock(variant);
				const soldHere = Math.min(sellable, Math.floor(jitter(`${variant.id}:sold`, 1) * 3));
				for (let i = 0; i < soldHere; i++) {
					counter.n += 1;
					const n = counter.n;
					const createdAt =
						drop.launchInstant + Math.floor(jitter(`${variant.id}:ord`, i) * 6 * HOUR);
					if (createdAt > now) continue;
					const id = `ord-${variant.id}-${i}`;
					store.orders.push({
						id,
						orderNumber: `RW${String(drop.number).padStart(2, '0')}-${String(n).padStart(3, '0')}`,
						dropId: drop.id,
						email: fixtureEmail(n),
						state: 'paid',
						subtotal: LAUNCH_PRICE,
						shipping: ZERO,
						discount: ZERO,
						tax: ZERO,
						total: LAUNCH_PRICE,
						shipTo: shipTo(n, `${variant.id}:oship`),
						notes: null,
						courierName: null,
						trackingRef: null,
						dispatchedAt: null,
						createdAt,
						lines: [
							{
								id: `line-${id}`,
								variantId: variant.id,
								sku: variant.sku,
								name: product.name,
								size: variant.size,
								quantity: 1,
								unitPrice: LAUNCH_PRICE,
								priceSource: 'launch',
								pieceNumber: null,
								reservationId: null
							}
						]
					});
					store.payments.push({
						id: `pay-${id}`,
						orderId: id,
						reservationId: null,
						kind: 'order',
						gateway: 'fixture',
						state: 'captured',
						amount: LAUNCH_PRICE,
						createdAt: createdAt + MINUTE,
						gatewayPaymentId: `fixture_${id}`
					});
				}
			}

			/* ---- demand: notify-me, waitlist and drop requests, by size ---- */
			buildDemandForVariant(drop, variant, now, store, counter);
		}
	}
}

function buildDemandForVariant(
	drop: Drop,
	variant: Variant,
	now: number,
	store: FixtureStore,
	counter: { n: number }
): void {
	const key = variant.id;
	// Deeper interest in the middle sizes, which is what the real curve looks like.
	const weight = variant.size === 'M' || variant.size === 'L' ? 3 : 1;

	const notifyCount = 1 + Math.floor(jitter(`${key}:n`, 1) * 3) * weight;
	for (let i = 0; i < notifyCount; i++) {
		counter.n += 1;
		store.notifies.push({
			id: `ntf-${key}-${i}`,
			variantId: variant.id,
			email: fixtureEmail(counter.n),
			createdAt: now - Math.floor(jitter(`${key}:nt`, i) * 12 * DAY) - HOUR,
			notifiedAt: null
		});
	}

	// §08 overflow: the waitlist only forms once a size is at its cap.
	if (variant.reservedCount >= variant.stockCount || variant.reservedCount >= 2) {
		const waitCount = 1 + Math.floor(jitter(`${key}:w`, 1) * 2);
		for (let i = 0; i < waitCount; i++) {
			counter.n += 1;
			store.waitlist.push({
				id: `wl-${key}-${i}`,
				dropId: drop.id,
				variantId: variant.id,
				email: fixtureEmail(counter.n),
				position: i + 1,
				state: 'waiting',
				createdAt: now - Math.floor(jitter(`${key}:wt`, i) * 8 * DAY) - HOUR
			});
		}
	}

	/* Drop requests are the archive signal: "bring this back, in my size".
	   Generated for exactly the states the storefront lets somebody request —
	   see acceptsDropRequest() in $lib/components/drop/marks. A drop still on
	   sale needs a cart, and one still teasing takes a deposit. */
	if (drop.state === 'SOLD_OUT' || drop.state === 'ARCHIVED') {
		const requestCount = 1 + Math.floor(jitter(`${key}:r`, 1) * 4) * weight;
		for (let i = 0; i < requestCount; i++) {
			counter.n += 1;
			store.requests.push({
				id: `req-${key}-${i}`,
				dropId: drop.id,
				variantId: variant.id,
				email: fixtureEmail(counter.n),
				note: i === 0 ? 'Missed this one. Would take it in the same colourway.' : null,
				createdAt: now - Math.floor(jitter(`${key}:rt`, i) * 20 * DAY) - HOUR,
				fulfilledAt: null
			});
		}
	}
}

function buildContact(now: number): StoredContact[] {
	const seeds: Array<[string, string, ContactStatus, boolean]> = [
		[
			'Where is my piece number?',
			'I reserved during the tease and I have the deposit receipt, but I cannot find my piece number anywhere in the email.',
			'new',
			false
		],
		[
			'Sizing between M and L',
			'I am 178cm and usually wear a medium. The fit note says oversized — should I size down?',
			'new',
			false
		],
		[
			'Defect on arrival',
			'There is a pulled thread along the left shoulder seam. Photographs attached in a follow-up.',
			'in_progress',
			false
		],
		[
			'Wholesale enquiry',
			'We run a small store and would like to stock the next drop. Who handles this?',
			'in_progress',
			false
		],
		[
			'Address change before dispatch',
			'I have moved. Can I update the delivery address on my pre-order before it ships?',
			'closed',
			false
		],
		['CHEAP BACKLINKS', 'Buy 5000 links for your store today', 'new', true]
	];

	return seeds.map(([subject, message, status, isSpam], i) => ({
		id: `cnt-${String(i + 1).padStart(2, '0')}`,
		name: fixtureName(90 + i),
		email: fixtureEmail(90 + i),
		subject,
		message,
		status,
		isSpam,
		createdAt: now - (i + 1) * 11 * HOUR
	}));
}

/* -------------------------------------------------------------------------- */
/* Store lifecycle                                                              */
/* -------------------------------------------------------------------------- */

let cached: FixtureStore | null = null;

/**
 * Built once per process and then MUTATED by admin writes, so a state change
 * or a dispatch made on one screen is visible on the next. In-memory only: a
 * dev-server restart resets it, which is the correct behaviour for fixtures —
 * they are a rehearsal of the database, not a replacement for it.
 */
export async function fixtureStore(now: number): Promise<FixtureStore> {
	if (cached) return cached;

	const list = await drops.listDrops();
	const store: FixtureStore = {
		generatedFor: now,
		dropsIndex: list,
		reservations: [],
		payments: [],
		refunds: [],
		orders: [],
		requests: [],
		notifies: [],
		waitlist: [],
		contact: buildContact(now),
		dropOverrides: new Map(),
		variantOverrides: new Map(),
		audit: []
	};

	const counter = { n: 0 };
	for (const drop of list) buildForDrop(drop, now, store, counter);

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
