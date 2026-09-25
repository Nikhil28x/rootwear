/**
 * RW-140 — Admin read/write models.
 *
 * These are the shapes the admin screens render. They are DERIVED views, not
 * storage: every figure below is recomputed from the catalogue and the `app`
 * schema, never cached and never written back. Money is Paise everywhere, and
 * formatting happens only at the render edge (src/lib/money.ts).
 *
 * Under src/lib/server, so SvelteKit refuses to bundle any of it into client
 * code — which matters more here than anywhere else in the repo, because §12
 * says Trone has "NO ACCESS TO ORDERS, CUSTOMER RECORDS OR PAYOUTS" and these
 * types describe exactly that data.
 */
import type { Size } from '$lib/drop/sizes';
import type { DropState } from '$lib/domain/drop-state';
import type { Paise } from '$lib/money';

/** §12 — two people, two roles. Mirrors app.staff.role exactly. */
export type StaffRole = 'owner' | 'layout';

export type AdminActor = {
	readonly userId: string;
	readonly email: string;
	readonly role: StaffRole;
	/**
	 * True when the area is running on fixtures with no Supabase configured.
	 * Surfaced in the chrome so nobody mistakes fixture figures for real ones.
	 */
	readonly preview: boolean;
};

/** Mirrors app.order_state. */
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

/** Mirrors app.reservation_state. §08: the whole life of a reservation, explicit. */
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

export const CONTACT_STATUSES = ['new', 'in_progress', 'closed'] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

/* ------------------------------------------------------------------------ */
/* §12 report 1 — DROP PERFORMANCE                                           */
/* "Reserved, sold and remaining BY SIZE, and the sell-out curve against      */
/* time from launch. This is the number that decides how big Drop 02 is cut." */
/* ------------------------------------------------------------------------ */

export type SizePerformance = {
	readonly variantId: string;
	readonly sku: string;
	readonly size: Size;
	/** Pieces originally cut for this size = remaining + reserved + sold. */
	readonly cut: number;
	/** public.variants.reserved_count — pre-orders holding a numbered piece. */
	readonly reserved: number;
	/** Order lines against this variant on orders past payment. */
	readonly sold: number;
	/** stock_count - reserved_count: what is actually buyable right now. */
	readonly remaining: number;
	/** §08 policy ceiling on tease reservations for this size. */
	readonly reserveCap: number;
};

/** One point on the sell-out curve: cumulative pieces sold at an instant. */
export type SellOutPoint = {
	readonly atMs: number;
	/** Minutes since the drop's launch instant. Negative before launch. */
	readonly minutesFromLaunch: number;
	readonly cumulativeSold: number;
};

export type DropPerformance = {
	readonly dropId: string;
	readonly slug: string;
	readonly number: number;
	readonly name: string;
	readonly state: DropState;
	readonly launchInstant: number;
	readonly editionSize: number;
	readonly published: boolean;
	readonly bySize: readonly SizePerformance[];
	readonly curve: readonly SellOutPoint[];
	readonly totals: {
		readonly cut: number;
		readonly reserved: number;
		readonly sold: number;
		readonly remaining: number;
	};
};

/* ------------------------------------------------------------------------ */
/* §12 report 2 — PRE-ORDER LEDGER                                           */
/* ------------------------------------------------------------------------ */

export type PreOrderLedger = {
	readonly depositsTaken: Paise;
	readonly depositCount: number;
	readonly balancesOutstanding: Paise;
	readonly balancesOutstandingCount: number;
	/** balance_due_by already past, balance not cleared. The row that needs chasing. */
	readonly balancesOverdue: Paise;
	readonly balancesOverdueCount: number;
	readonly refundsIssued: Paise;
	readonly refundCount: number;
};

/* ------------------------------------------------------------------------ */
/* §12 report 3 — DEMAND BOARD (reads the existing app.demand_board view)     */
/* ------------------------------------------------------------------------ */

export type DemandRow = {
	readonly dropId: string;
	readonly dropSlug: string;
	readonly dropName: string;
	readonly dropState: DropState;
	readonly variantId: string;
	readonly size: Size;
	readonly requests: number;
	readonly notifyMe: number;
	readonly waitlist: number;
};

export type DemandEntryKind = 'request' | 'notify_me' | 'waitlist';

/** One named person behind a demand figure. §13: the list belongs to Rootwear. */
export type DemandEntry = {
	readonly id: string;
	readonly kind: DemandEntryKind;
	readonly dropId: string;
	readonly dropSlug: string;
	readonly dropName: string;
	readonly variantId: string | null;
	readonly size: Size | null;
	readonly email: string;
	readonly note: string | null;
	readonly createdAt: number;
	/** Waitlist position, or null for the other two kinds. */
	readonly position: number | null;
	readonly state: string;
};

/* ------------------------------------------------------------------------ */
/* §12 report 4 — REVENUE BY DROP, deposit-vs-balance split visible           */
/* ------------------------------------------------------------------------ */

export type RevenueByDrop = {
	readonly dropId: string;
	readonly dropSlug: string;
	readonly dropName: string;
	readonly deposits: Paise;
	readonly balances: Paise;
	readonly orders: Paise;
	readonly total: Paise;
};

/* ------------------------------------------------------------------------ */
/* Drops editor                                                              */
/* ------------------------------------------------------------------------ */

export type AdminVariantRow = {
	readonly id: string;
	readonly sku: string;
	readonly size: Size;
	readonly stockCount: number;
	readonly reserveCap: number;
	readonly reservedCount: number;
};

export type AdminDropRow = {
	readonly id: string;
	readonly slug: string;
	readonly number: number;
	readonly name: string;
	readonly state: DropState;
	readonly launchInstant: number;
	readonly archivedAt: number | null;
	readonly editionSize: number;
	readonly published: boolean;
	readonly variants: readonly AdminVariantRow[];
	/** From $lib/domain/drop-state — the UI never offers anything outside this. */
	readonly legalTransitions: readonly DropState[];
};

/* ------------------------------------------------------------------------ */
/* Orders, reservations, payments                                            */
/* ------------------------------------------------------------------------ */

export type AdminPayment = {
	readonly id: string;
	readonly kind: 'deposit' | 'balance' | 'order';
	readonly gateway: string;
	readonly state: 'created' | 'authorized' | 'captured' | 'failed' | 'refunded';
	readonly amount: Paise;
	readonly createdAt: number;
	readonly gatewayPaymentId: string | null;
};

export type AdminRefund = {
	readonly id: string;
	readonly amount: Paise;
	readonly reason: 'cap_race' | 'cancellation' | 'defect' | 'admin';
	readonly state: 'initiated' | 'processed' | 'failed';
	readonly createdAt: number;
};

export type ShipTo = {
	readonly name: string;
	readonly line1: string;
	readonly line2: string | null;
	readonly city: string;
	readonly state: string;
	readonly pincode: string;
	readonly phone: string;
	/** §10: India only. Stored so the label view never has to assume it. */
	readonly country: string;
};

export type AdminOrderLine = {
	readonly id: string;
	readonly sku: string;
	readonly name: string;
	readonly size: Size | null;
	readonly quantity: number;
	readonly unitPrice: Paise;
	readonly priceSource: 'prelaunch_locked' | 'launch';
	readonly pieceNumber: number | null;
	readonly reservationId: string | null;
};

export type AdminOrderSummary = {
	readonly id: string;
	readonly orderNumber: string;
	readonly email: string;
	readonly state: OrderState;
	readonly total: Paise;
	readonly createdAt: number;
	readonly dispatchedAt: number | null;
	readonly courierName: string | null;
	readonly trackingRef: string | null;
	readonly pieceCount: number;
	/** True when any line fulfils a reservation — §08's one continuous record. */
	readonly isPreOrder: boolean;
	readonly shipTo: ShipTo;
};

export type AdminOrderDetail = AdminOrderSummary & {
	readonly subtotal: Paise;
	readonly shipping: Paise;
	readonly discount: Paise;
	readonly tax: Paise;
	readonly notes: string | null;
	readonly lines: readonly AdminOrderLine[];
	readonly payments: readonly AdminPayment[];
};

/** §08: "ONE CONTINUOUS RECORD … admin sees one row with a clear state." */
export type ReservationEvent = {
	readonly at: number;
	readonly label: string;
	readonly detail: string | null;
};

export type AdminReservationSummary = {
	readonly id: string;
	readonly dropId: string;
	readonly dropSlug: string;
	readonly dropName: string;
	readonly sku: string;
	readonly size: Size;
	readonly email: string;
	readonly state: ReservationState;
	readonly pieceNumber: number | null;
	readonly lockedPrice: Paise;
	readonly deposit: Paise;
	readonly balance: Paise;
	readonly balanceDueBy: number | null;
	readonly createdAt: number;
};

export type AdminReservationDetail = AdminReservationSummary & {
	readonly cancellationRule: string;
	readonly dispatchDate: string | null;
	readonly timeline: readonly ReservationEvent[];
	readonly orderId: string | null;
	readonly orderNumber: string | null;
	readonly payments: readonly AdminPayment[];
	readonly refunds: readonly AdminRefund[];
};

/* ------------------------------------------------------------------------ */
/* Fulfilment (§11)                                                          */
/* ------------------------------------------------------------------------ */

export type PackingListEntry = {
	readonly orderId: string;
	readonly orderNumber: string;
	readonly isPreOrder: boolean;
	readonly notes: string | null;
	readonly shipTo: ShipTo;
	readonly lines: readonly {
		readonly sku: string;
		readonly name: string;
		readonly size: Size | null;
		readonly quantity: number;
		readonly pieceNumber: number | null;
	}[];
};

/* ------------------------------------------------------------------------ */
/* Contact (§11)                                                             */
/* ------------------------------------------------------------------------ */

export type AdminContactSubmission = {
	readonly id: string;
	readonly name: string;
	readonly email: string;
	readonly subject: string;
	readonly message: string;
	readonly status: ContactStatus;
	readonly isSpam: boolean;
	readonly createdAt: number;
};
