/**
 * RW-145 — Fixture-backed AdminRepository.
 *
 * Implements exactly the interface the Supabase repository implements, so
 * switching between them is one environment variable and no other change
 * (see ./index.ts). Deliberately async throughout for the same reason.
 *
 * Derivations worth stating once, because every report below depends on them:
 *
 *   reserved  = public.variants.reserved_count. Incremented ONLY by
 *               app.reserve_piece() and never decremented, so a pre-order that
 *               has already dispatched is still counted here — which matches
 *               the database exactly, and is the honest reading of "pieces
 *               claimed out of this cut".
 *   sold      = order lines on OPEN-SALE orders (no reservation attached).
 *               Pre-order lines are not counted again, because their piece is
 *               already inside `reserved`.
 *   remaining = stock_count - reserved_count, i.e. sellableStock(). What a
 *               visitor could actually buy this second.
 *   cut       = remaining + reserved + sold. The identity holds exactly, which
 *               is what makes the by-size table add up on screen.
 */
import { assertTransition, legalTransitionsFrom } from '$lib/domain/drop-state';
import type { DropState } from '$lib/domain/drop-state';
import { sellableStock, type Drop, type Product, type Variant } from '$lib/domain/drop';
import { addPaise, ZERO, type Paise } from '$lib/money';
import type { Size } from '$lib/drop/sizes';
import type { AdminRepository } from './repository';
import { fixtureStore, type FixtureStore, type StoredOrder, type StoredReservation } from './fixtures';
import type {
	AdminContactSubmission,
	AdminDropRow,
	AdminOrderDetail,
	AdminOrderSummary,
	AdminPayment,
	AdminRefund,
	AdminReservationDetail,
	AdminReservationSummary,
	AdminVariantRow,
	ContactStatus,
	DemandEntry,
	DemandEntryKind,
	DemandRow,
	DropPerformance,
	OrderState,
	PackingListEntry,
	PreOrderLedger,
	ReservationState,
	RevenueByDrop,
	SellOutPoint,
	SizePerformance
} from './types';

const MINUTE = 60_000;

function sum(values: Paise[]): Paise {
	return values.length === 0 ? ZERO : addPaise(...values);
}

/* -------------------------------------------------------------------------- */
/* Catalogue lookups, with the in-memory admin overrides applied               */
/* -------------------------------------------------------------------------- */

type VariantRef = { drop: Drop; product: Product; variant: Variant };

function variantIndex(store: FixtureStore): Map<string, VariantRef> {
	const index = new Map<string, VariantRef>();
	for (const drop of store.dropsIndex) {
		for (const product of drop.products) {
			for (const variant of product.variants) {
				index.set(variant.id, { drop, product, variant });
			}
		}
	}
	return index;
}

function dropStateOf(store: FixtureStore, drop: Drop): DropState {
	return store.dropOverrides.get(drop.id)?.state ?? drop.state;
}

function publishedOf(store: FixtureStore, drop: Drop): boolean {
	return store.dropOverrides.get(drop.id)?.published ?? true;
}

function launchInstantOf(store: FixtureStore, drop: Drop): number {
	return store.dropOverrides.get(drop.id)?.launchInstant ?? drop.launchInstant;
}

function stockOf(store: FixtureStore, variant: Variant): number {
	return store.variantOverrides.get(variant.id)?.stockCount ?? variant.stockCount;
}

/**
 * §08: the per-size reservation ceiling. The Drop domain type carries no
 * reserve_cap (it is a tease-time policy figure, not catalogue content), so
 * the fixture derives one: M sits AT its cap, which is what produced the
 * cap-race refund in the fixture ledger; every other size has headroom.
 */
function capOf(store: FixtureStore, variant: Variant): number {
	const override = store.variantOverrides.get(variant.id)?.reserveCap;
	if (override !== undefined) return override;
	return variant.size === 'M' ? variant.reservedCount : variant.stockCount;
}

function effectiveVariant(store: FixtureStore, variant: Variant): Variant {
	const stockCount = stockOf(store, variant);
	return stockCount === variant.stockCount ? variant : { ...variant, stockCount };
}

/* -------------------------------------------------------------------------- */
/* Mapping to the admin view models                                            */
/* -------------------------------------------------------------------------- */

function toPayment(p: FixtureStore['payments'][number]): AdminPayment {
	return {
		id: p.id,
		kind: p.kind,
		gateway: p.gateway,
		state: p.state,
		amount: p.amount,
		createdAt: p.createdAt,
		gatewayPaymentId: p.gatewayPaymentId
	};
}

function toRefund(r: FixtureStore['refunds'][number]): AdminRefund {
	return { id: r.id, amount: r.amount, reason: r.reason, state: r.state, createdAt: r.createdAt };
}

function toOrderSummary(order: StoredOrder): AdminOrderSummary {
	return {
		id: order.id,
		orderNumber: order.orderNumber,
		email: order.email,
		state: order.state,
		total: order.total,
		createdAt: order.createdAt,
		dispatchedAt: order.dispatchedAt,
		courierName: order.courierName,
		trackingRef: order.trackingRef,
		pieceCount: order.lines.reduce((n, l) => n + l.quantity, 0),
		isPreOrder: order.lines.some((l) => l.reservationId !== null),
		shipTo: order.shipTo
	};
}

function toReservationSummary(
	reservation: StoredReservation,
	ref: VariantRef | undefined
): AdminReservationSummary {
	return {
		id: reservation.id,
		dropId: reservation.dropId,
		dropSlug: ref?.drop.slug ?? reservation.dropId,
		dropName: ref?.drop.name ?? reservation.dropId,
		sku: ref?.variant.sku ?? reservation.variantId,
		size: (ref?.variant.size ?? 'M') as Size,
		email: reservation.email,
		state: reservation.state,
		pieceNumber: reservation.pieceNumber,
		lockedPrice: reservation.lockedPrice,
		deposit: reservation.deposit,
		balance: reservation.balance,
		balanceDueBy: reservation.balanceDueBy,
		createdAt: reservation.createdAt
	};
}

function audit(store: FixtureStore, actor: string, action: string, entity: string, entityId: string) {
	store.audit.unshift({ at: Date.now(), actor, action, entity, entityId });
}

/* -------------------------------------------------------------------------- */

export const mockAdminRepository: AdminRepository = {
	async listDropPerformance(now: number): Promise<DropPerformance[]> {
		const store = await fixtureStore(now);

		return store.dropsIndex.map((drop) => {
			const bySize: SizePerformance[] = [];
			const claimEvents: number[] = [];

			for (const product of drop.products) {
				for (const raw of product.variants) {
					const variant = effectiveVariant(store, raw);
					const openSaleLines = store.orders
						.filter((o) => o.state !== 'cancelled')
						.flatMap((o) => o.lines.map((l) => ({ order: o, line: l })))
						.filter((x) => x.line.variantId === variant.id && x.line.reservationId === null);

					const sold = openSaleLines.reduce((n, x) => n + x.line.quantity, 0);
					const remaining = sellableStock(variant);
					const reserved = variant.reservedCount;

					bySize.push({
						variantId: variant.id,
						sku: variant.sku,
						size: variant.size,
						cut: remaining + reserved + sold,
						reserved,
						sold,
						remaining,
						reserveCap: capOf(store, raw)
					});

					for (const x of openSaleLines) {
						for (let i = 0; i < x.line.quantity; i++) claimEvents.push(x.order.createdAt);
					}
				}
			}

			// §07's "claimed" counter, plotted: every allocated piece, in order.
			for (const reservation of store.reservations) {
				if (reservation.dropId === drop.id && reservation.pieceNumber !== null) {
					claimEvents.push(reservation.createdAt);
				}
			}

			claimEvents.sort((a, b) => a - b);
			// Measured against the CURRENT launch instant, edits included, so the
			// curve and the marker drawn on it can never disagree.
			const launchInstant = launchInstantOf(store, drop);
			const curve: SellOutPoint[] = claimEvents.map((atMs, i) => ({
				atMs,
				minutesFromLaunch: Math.round((atMs - launchInstant) / MINUTE),
				cumulativeSold: i + 1
			}));

			return {
				dropId: drop.id,
				slug: drop.slug,
				number: drop.number,
				name: drop.name,
				state: dropStateOf(store, drop),
				launchInstant,
				editionSize: drop.editionSize,
				published: publishedOf(store, drop),
				bySize,
				curve,
				totals: {
					cut: bySize.reduce((n, s) => n + s.cut, 0),
					reserved: bySize.reduce((n, s) => n + s.reserved, 0),
					sold: bySize.reduce((n, s) => n + s.sold, 0),
					remaining: bySize.reduce((n, s) => n + s.remaining, 0)
				}
			};
		});
	},

	async preOrderLedger(now: number): Promise<PreOrderLedger> {
		const store = await fixtureStore(now);

		const deposits = store.payments.filter((p) => p.kind === 'deposit' && p.state === 'captured');

		// §08: a balance is outstanding while the piece is held and unpaid.
		const outstanding = store.reservations.filter(
			(r) => r.state === 'reserved' || r.state === 'balance_due'
		);
		const overdue = outstanding.filter(
			(r) => r.state === 'balance_due' && r.balanceDueBy !== null && r.balanceDueBy < now
		);
		const refunds = store.refunds.filter((r) => r.state === 'processed');

		return {
			depositsTaken: sum(deposits.map((p) => p.amount)),
			depositCount: deposits.length,
			balancesOutstanding: sum(outstanding.map((r) => r.balance)),
			balancesOutstandingCount: outstanding.length,
			balancesOverdue: sum(overdue.map((r) => r.balance)),
			balancesOverdueCount: overdue.length,
			refundsIssued: sum(refunds.map((r) => r.amount)),
			refundCount: refunds.length
		};
	},

	async revenueByDrop(): Promise<RevenueByDrop[]> {
		const store = await fixtureStore(Date.now());
		const reservationDrop = new Map(store.reservations.map((r) => [r.id, r.dropId]));
		const orderDrop = new Map(store.orders.map((o) => [o.id, o.dropId]));

		return store.dropsIndex.map((drop) => {
			const captured = store.payments.filter((p) => p.state === 'captured');
			const forDrop = captured.filter((p) =>
				p.reservationId
					? reservationDrop.get(p.reservationId) === drop.id
					: p.orderId
						? orderDrop.get(p.orderId) === drop.id
						: false
			);

			const deposits = sum(forDrop.filter((p) => p.kind === 'deposit').map((p) => p.amount));
			const balances = sum(forDrop.filter((p) => p.kind === 'balance').map((p) => p.amount));
			const orders = sum(forDrop.filter((p) => p.kind === 'order').map((p) => p.amount));

			return {
				dropId: drop.id,
				dropSlug: drop.slug,
				dropName: drop.name,
				deposits,
				balances,
				orders,
				total: addPaise(deposits, balances, orders)
			};
		});
	},

	async listDemandRows(): Promise<DemandRow[]> {
		const store = await fixtureStore(Date.now());
		const rows: DemandRow[] = [];

		for (const drop of store.dropsIndex) {
			for (const product of drop.products) {
				for (const variant of product.variants) {
					rows.push({
						dropId: drop.id,
						dropSlug: drop.slug,
						dropName: drop.name,
						dropState: dropStateOf(store, drop),
						variantId: variant.id,
						size: variant.size,
						requests: store.requests.filter(
							(r) => r.variantId === variant.id && r.fulfilledAt === null
						).length,
						notifyMe: store.notifies.filter(
							(n) => n.variantId === variant.id && n.notifiedAt === null
						).length,
						waitlist: store.waitlist.filter(
							(w) => w.variantId === variant.id && w.state === 'waiting'
						).length
					});
				}
			}
		}

		return rows;
	},

	async listDemandEntries(filter): Promise<DemandEntry[]> {
		const store = await fixtureStore(Date.now());
		const index = variantIndex(store);
		const entries: DemandEntry[] = [];

		const meta = (variantId: string) => index.get(variantId);

		for (const r of store.requests) {
			const ref = meta(r.variantId);
			entries.push({
				id: r.id,
				kind: 'request',
				dropId: r.dropId,
				dropSlug: ref?.drop.slug ?? r.dropId,
				dropName: ref?.drop.name ?? r.dropId,
				variantId: r.variantId,
				size: ref?.variant.size ?? null,
				email: r.email,
				note: r.note,
				createdAt: r.createdAt,
				position: null,
				state: r.fulfilledAt ? 'fulfilled' : 'open'
			});
		}

		for (const n of store.notifies) {
			const ref = meta(n.variantId);
			if (!ref) continue;
			entries.push({
				id: n.id,
				kind: 'notify_me',
				dropId: ref.drop.id,
				dropSlug: ref.drop.slug,
				dropName: ref.drop.name,
				variantId: n.variantId,
				size: ref.variant.size,
				email: n.email,
				note: null,
				createdAt: n.createdAt,
				position: null,
				state: n.notifiedAt ? 'notified' : 'open'
			});
		}

		for (const w of store.waitlist) {
			const ref = meta(w.variantId);
			entries.push({
				id: w.id,
				kind: 'waitlist',
				dropId: w.dropId,
				dropSlug: ref?.drop.slug ?? w.dropId,
				dropName: ref?.drop.name ?? w.dropId,
				variantId: w.variantId,
				size: ref?.variant.size ?? null,
				email: w.email,
				note: null,
				createdAt: w.createdAt,
				position: w.position,
				state: w.state
			});
		}

		return entries
			.filter((e) => (filter?.dropId ? e.dropId === filter.dropId : true))
			.filter((e) => (filter?.kind ? e.kind === filter.kind : true))
			.sort((a, b) => b.createdAt - a.createdAt);
	},

	async listDropRows(): Promise<AdminDropRow[]> {
		const store = await fixtureStore(Date.now());
		return store.dropsIndex.map((drop) => toDropRow(store, drop));
	},

	async findDropRow(slug: string): Promise<AdminDropRow | null> {
		const store = await fixtureStore(Date.now());
		const drop = store.dropsIndex.find((d) => d.slug === slug);
		return drop ? toDropRow(store, drop) : null;
	},

	async setDropState({ dropId, from, to, actor }) {
		// §06: guarded here as well as at the call site. An illegal edge throws.
		assertTransition(from, to);
		const store = await fixtureStore(Date.now());
		const current = store.dropOverrides.get(dropId) ?? {};
		store.dropOverrides.set(dropId, { ...current, state: to });
		audit(store, actor, `state ${from} -> ${to}`, 'drop', dropId);
	},

	async setDropPublished({ dropId, published, actor }) {
		const store = await fixtureStore(Date.now());
		const current = store.dropOverrides.get(dropId) ?? {};
		store.dropOverrides.set(dropId, { ...current, published });
		audit(store, actor, published ? 'published' : 'unpublished', 'drop', dropId);
	},

	async setDropLaunchInstant({ dropId, launchInstant, actor }) {
		if (!Number.isFinite(launchInstant)) {
			throw new Error('The launch instant must be a real date and time.');
		}
		const store = await fixtureStore(Date.now());
		const drop = store.dropsIndex.find((d) => d.id === dropId);
		if (!drop) throw new Error(`Unknown drop ${dropId}`);

		const previous = launchInstantOf(store, drop);
		const current = store.dropOverrides.get(dropId) ?? {};
		store.dropOverrides.set(dropId, { ...current, launchInstant });
		audit(
			store,
			actor,
			`launch ${new Date(previous).toISOString()} -> ${new Date(launchInstant).toISOString()}`,
			'drop',
			dropId
		);
	},

	async setVariantStock({ variantId, stockCount, reserveCap, actor }) {
		if (stockCount < 0 || reserveCap < 0) {
			throw new Error('Stock and cap must be zero or greater.');
		}
		const store = await fixtureStore(Date.now());
		const ref = variantIndex(store).get(variantId);
		if (!ref) throw new Error(`Unknown variant ${variantId}`);
		// Mirrors the variants_reserved_within_stock check constraint.
		if (stockCount < ref.variant.reservedCount) {
			throw new Error(
				`Stock cannot fall below the ${ref.variant.reservedCount} piece(s) already reserved in ${ref.variant.size}.`
			);
		}
		store.variantOverrides.set(variantId, { stockCount, reserveCap });
		audit(store, actor, `stock ${stockCount} / cap ${reserveCap}`, 'variant', variantId);
	},

	async listOrders(filter): Promise<AdminOrderSummary[]> {
		const store = await fixtureStore(Date.now());
		return store.orders
			.filter((o) => (filter?.state ? o.state === filter.state : true))
			.map(toOrderSummary);
	},

	async findOrder(id: string): Promise<AdminOrderDetail | null> {
		const store = await fixtureStore(Date.now());
		const order = store.orders.find((o) => o.id === id);
		if (!order) return null;

		return {
			...toOrderSummary(order),
			subtotal: order.subtotal,
			shipping: order.shipping,
			discount: order.discount,
			tax: order.tax,
			notes: order.notes,
			lines: order.lines.map((l) => ({
				id: l.id,
				sku: l.sku,
				name: l.name,
				size: l.size,
				quantity: l.quantity,
				unitPrice: l.unitPrice,
				priceSource: l.priceSource,
				pieceNumber: l.pieceNumber,
				reservationId: l.reservationId
			})),
			payments: store.payments
				.filter((p) => p.orderId === order.id)
				.map(toPayment)
				.sort((a, b) => a.createdAt - b.createdAt)
		};
	},

	async updateFulfilment({ orderId, state, courierName, trackingRef, actor }) {
		const store = await fixtureStore(Date.now());
		const order = store.orders.find((o) => o.id === orderId);
		if (!order) throw new Error(`Unknown order ${orderId}`);

		// §11: a dispatch is not a dispatch without a courier and a reference.
		if (state === 'dispatched' && (!courierName || !trackingRef)) {
			throw new Error('Enter the courier name and tracking reference before marking dispatched.');
		}

		order.state = state;
		order.courierName = courierName;
		order.trackingRef = trackingRef;
		order.dispatchedAt = state === 'dispatched' ? (order.dispatchedAt ?? Date.now()) : null;

		// §08: the reservation behind a pre-order moves with its order — one record.
		for (const line of order.lines) {
			if (!line.reservationId) continue;
			const reservation = store.reservations.find((r) => r.id === line.reservationId);
			if (reservation && state === 'dispatched') {
				reservation.state = 'dispatched';
				reservation.events.push({
					at: Date.now(),
					label: 'Dispatched',
					detail: `${courierName} · ${trackingRef}`
				});
			}
		}

		audit(store, actor, `fulfilment ${state}`, 'order', orderId);
	},

	async packingList(limit: number): Promise<PackingListEntry[]> {
		const store = await fixtureStore(Date.now());
		return store.orders
			.filter((o) => o.state === 'paid' || o.state === 'packed')
			.sort((a, b) => a.createdAt - b.createdAt)
			.slice(0, limit)
			.map((o) => ({
				orderId: o.id,
				orderNumber: o.orderNumber,
				isPreOrder: o.lines.some((l) => l.reservationId !== null),
				notes: o.notes,
				shipTo: o.shipTo,
				lines: o.lines.map((l) => ({
					sku: l.sku,
					name: l.name,
					size: l.size,
					quantity: l.quantity,
					pieceNumber: l.pieceNumber
				}))
			}));
	},

	async listReservations(filter): Promise<AdminReservationSummary[]> {
		const store = await fixtureStore(Date.now());
		const index = variantIndex(store);
		return store.reservations
			.filter((r) => (filter?.state ? r.state === filter.state : true))
			.map((r) => toReservationSummary(r, index.get(r.variantId)));
	},

	async findReservation(id: string): Promise<AdminReservationDetail | null> {
		const store = await fixtureStore(Date.now());
		const reservation = store.reservations.find((r) => r.id === id);
		if (!reservation) return null;

		const index = variantIndex(store);
		const order = reservation.orderId
			? (store.orders.find((o) => o.id === reservation.orderId) ?? null)
			: null;
		const payments = store.payments
			.filter((p) => p.reservationId === reservation.id)
			.map(toPayment)
			.sort((a, b) => a.createdAt - b.createdAt);

		return {
			...toReservationSummary(reservation, index.get(reservation.variantId)),
			cancellationRule: reservation.cancellationRule,
			dispatchDate: reservation.dispatchDate,
			timeline: [...reservation.events].sort((a, b) => a.at - b.at),
			orderId: order?.id ?? null,
			orderNumber: order?.orderNumber ?? null,
			payments,
			refunds: store.refunds
				.filter((r) => r.reservationId === reservation.id)
				.map(toRefund)
				.sort((a, b) => a.createdAt - b.createdAt)
		};
	},

	async markBalanceRequested({ reservationId, dueBy, actor }) {
		const store = await fixtureStore(Date.now());
		const reservation = store.reservations.find((r) => r.id === reservationId);
		if (!reservation) throw new Error(`Unknown reservation ${reservationId}`);
		if (reservation.state !== 'reserved' && reservation.state !== 'balance_due') {
			throw new Error(
				`A balance link only applies to a confirmed reservation. This one is ${reservation.state}.`
			);
		}
		reservation.state = 'balance_due';
		reservation.balanceDueBy = dueBy;
		reservation.events.push({
			at: Date.now(),
			label: 'Balance link sent',
			detail: `Due ${new Date(dueBy).toISOString().slice(0, 10)}`
		});
		audit(store, actor, 'balance link sent', 'reservation', reservationId);
	},

	async listContact(filter): Promise<AdminContactSubmission[]> {
		const store = await fixtureStore(Date.now());
		return store.contact
			.filter((c) => (filter?.status ? c.status === filter.status : true))
			.map((c) => ({ ...c }))
			.sort((a, b) => b.createdAt - a.createdAt);
	},

	async setContactStatus({ id, status, actor }) {
		const store = await fixtureStore(Date.now());
		const row = store.contact.find((c) => c.id === id);
		if (!row) throw new Error(`Unknown submission ${id}`);
		row.status = status;
		audit(store, actor, `status ${status}`, 'contact_submission', id);
	}
};

function toDropRow(store: FixtureStore, drop: Drop): AdminDropRow {
	const state = dropStateOf(store, drop);
	const variants: AdminVariantRow[] = drop.products.flatMap((product) =>
		product.variants.map((variant) => ({
			id: variant.id,
			sku: variant.sku,
			size: variant.size,
			stockCount: stockOf(store, variant),
			reserveCap: capOf(store, variant),
			reservedCount: variant.reservedCount
		}))
	);

	return {
		id: drop.id,
		slug: drop.slug,
		number: drop.number,
		name: drop.name,
		state,
		launchInstant: launchInstantOf(store, drop),
		archivedAt: drop.archivedAt,
		editionSize: drop.editionSize,
		published: publishedOf(store, drop),
		variants,
		legalTransitions: legalTransitionsFrom(state)
	};
}

/** Re-exported so callers do not need to know which states exist where. */
export type { OrderState, ReservationState, ContactStatus, DemandEntryKind };
