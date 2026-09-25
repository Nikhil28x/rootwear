/**
 * RW-143 — The admin repository seam.
 *
 * Same shape as src/lib/server/drops/: an interface here, a fixture
 * implementation and a Postgres implementation beside it, and one `index.ts`
 * that picks between them from the environment. Every admin route imports ONLY
 * this interface, which is what lets the whole area run today against
 * fixtures, with no database and no Supabase project.
 *
 * Writes take an `actor` label because §12/RW-141 require every privileged
 * write to be attributable (app.admin_audit_log). No write method takes a
 * money amount from the caller — money is derived server-side, always.
 */
import type { DropState } from '$lib/domain/drop-state';
import type {
	AdminContactSubmission,
	AdminDropRow,
	AdminOrderDetail,
	AdminOrderSummary,
	AdminReservationDetail,
	AdminReservationSummary,
	ContactStatus,
	DemandEntry,
	DemandEntryKind,
	DemandRow,
	DropPerformance,
	OrderState,
	PackingListEntry,
	PreOrderLedger,
	ReservationState,
	RevenueByDrop
} from './types';

export interface AdminRepository {
	/* --- §12 reports ------------------------------------------------------ */

	/** Reserved / sold / remaining by size, plus the sell-out curve. */
	listDropPerformance(now: number): Promise<DropPerformance[]>;
	/** Deposits taken, balances outstanding, balances overdue, refunds issued. */
	preOrderLedger(now: number): Promise<PreOrderLedger>;
	/** Revenue per drop with the deposit-vs-balance split kept visible. */
	revenueByDrop(): Promise<RevenueByDrop[]>;
	/** Reads app.demand_board — counts by drop and size. */
	listDemandRows(): Promise<DemandRow[]>;
	/** The individual people behind those counts, with dates. §13 export feeds off this. */
	listDemandEntries(filter?: {
		dropId?: string;
		kind?: DemandEntryKind;
	}): Promise<DemandEntry[]>;

	/* --- drops ------------------------------------------------------------ */

	listDropRows(): Promise<AdminDropRow[]>;
	findDropRow(slug: string): Promise<AdminDropRow | null>;
	/**
	 * §06: the transition is guarded by assertTransition() BEFORE this is
	 * called, and again inside the implementation. An illegal edge throws.
	 */
	setDropState(input: {
		dropId: string;
		from: DropState;
		to: DropState;
		actor: string;
	}): Promise<void>;
	setDropPublished(input: { dropId: string; published: boolean; actor: string }): Promise<void>;
	/**
	 * §07 — the launch instant, which is the whole schedule.
	 *
	 * The tease run is DERIVED from this one figure (src/lib/drop/schedule.ts:
	 * one stage per day, counted back from launch), so there is no separate
	 * stage calendar to edit and no second source of truth to drift. Move this
	 * and the countdown, the stage cadence and the tease start all move with it.
	 *
	 * Takes an epoch millisecond, never a wall-clock string: the caller parses
	 * the operator's IST input at the edge, so the zone is resolved once.
	 */
	setDropLaunchInstant(input: {
		dropId: string;
		launchInstant: number;
		actor: string;
	}): Promise<void>;
	/** §09: per-size stock and the §08 reservation cap. Never negative. */
	setVariantStock(input: {
		variantId: string;
		stockCount: number;
		reserveCap: number;
		actor: string;
	}): Promise<void>;

	/* --- orders and fulfilment -------------------------------------------- */

	listOrders(filter?: { state?: OrderState }): Promise<AdminOrderSummary[]>;
	findOrder(id: string): Promise<AdminOrderDetail | null>;
	/** §11: mark packed, record courier and tracking reference, mark dispatched. */
	updateFulfilment(input: {
		orderId: string;
		state: OrderState;
		courierName: string | null;
		trackingRef: string | null;
		actor: string;
	}): Promise<void>;
	/** §11: Aaron ships 25 pieces himself. A printable list, no label integration. */
	packingList(limit: number): Promise<PackingListEntry[]>;

	/* --- reservations ------------------------------------------------------ */

	listReservations(filter?: { state?: ReservationState }): Promise<AdminReservationSummary[]>;
	findReservation(id: string): Promise<AdminReservationDetail | null>;
	/**
	 * §08: moves a confirmed reservation to balance_due and records that the
	 * link was sent. Sending the email itself is the notifications area's job;
	 * this records the state change that triggers it.
	 */
	markBalanceRequested(input: {
		reservationId: string;
		dueBy: number;
		actor: string;
	}): Promise<void>;

	/* --- contact ----------------------------------------------------------- */

	listContact(filter?: { status?: ContactStatus }): Promise<AdminContactSubmission[]>;
	setContactStatus(input: { id: string; status: ContactStatus; actor: string }): Promise<void>;
}
