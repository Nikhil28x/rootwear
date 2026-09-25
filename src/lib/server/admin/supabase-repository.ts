/**
 * RW-146 — Postgres-backed AdminRepository.
 *
 * Implements exactly the interface the mock implements, so switching between
 * them is one environment variable and no other code change (./index.ts).
 *
 * TWO CLIENTS, and the split is not cosmetic:
 *   getCatalogueClient() — public schema: drops, products, variants,
 *                          drop_state_events. Service role, because admin must
 *                          also see UNPUBLISHED drops, which the anon policy
 *                          correctly hides.
 *   getServiceClient()   — app schema: reservations, payments, refunds,
 *                          orders, order_lines, demand, contact. RLS bypassed.
 *                          The `app` schema is not exposed through PostgREST
 *                          at all, so this is the only way to read it, and it
 *                          is legitimate: the server is acting as the system.
 *
 * WHY THE JOINS HAPPEN IN TYPESCRIPT: PostgREST cannot embed across schemas,
 * and every interesting admin figure spans public (catalogue) and app (money).
 * So each method reads the two sides and joins by id here. At 25 pieces a drop
 * that is a handful of rows; if a drop ever runs to thousands, these become
 * database views like app.demand_board already is.
 *
 * NOT EXERCISED in this phase — the app runs on fixtures until
 * CATALOGUE_SOURCE=supabase. Written now so the switch is a config change.
 */
import { assertTransition, legalTransitionsFrom } from '$lib/domain/drop-state';
import type { DropState } from '$lib/domain/drop-state';
import { addPaise, paise, ZERO, type Paise } from '$lib/money';
import type { Size } from '$lib/drop/sizes';
import { getCatalogueClient, getServiceClient } from '$lib/server/db/clients';
import type { AdminRepository } from './repository';
import type {
	AdminContactSubmission,
	AdminDropRow,
	AdminOrderDetail,
	AdminOrderSummary,
	AdminPayment,
	AdminReservationDetail,
	AdminReservationSummary,
	ContactStatus,
	DemandEntry,
	DemandRow,
	DropPerformance,
	OrderState,
	PackingListEntry,
	PreOrderLedger,
	ReservationState,
	RevenueByDrop,
	SellOutPoint,
	ShipTo,
	SizePerformance
} from './types';

const MINUTE = 60_000;

function money(value: number | string | null | undefined): Paise {
	return paise(Math.round(Number(value ?? 0)));
}

function sum(values: Paise[]): Paise {
	return values.length === 0 ? ZERO : addPaise(...values);
}

function ms(value: string | null | undefined): number | null {
	return value ? Date.parse(value) : null;
}

/* -------------------------------------------------------------------------- */
/* Row shapes, transcribed from the migrations                                 */
/* -------------------------------------------------------------------------- */

type DropRow = {
	id: string;
	slug: string;
	number: number;
	name: string;
	state: DropState;
	launch_instant: string;
	archived_at: string | null;
	edition_size: number;
	published_at: string | null;
};

type VariantRow = {
	id: string;
	product_id: string;
	sku: string;
	size: Size;
	stock_count: number;
	reserve_cap: number;
	reserved_count: number;
};

type ProductRow = { id: string; drop_id: string; name: string };

type OrderRow = {
	id: string;
	order_number: string;
	state: OrderState;
	subtotal_paise: number;
	shipping_paise: number;
	discount_paise: number;
	tax_paise: number;
	total_paise: number;
	ship_name: string;
	ship_line1: string;
	ship_line2: string | null;
	ship_city: string;
	ship_state: string;
	ship_pincode: string;
	ship_phone: string;
	ship_country: string;
	notes: string | null;
	courier_name: string | null;
	tracking_ref: string | null;
	dispatched_at: string | null;
	created_at: string;
	customer_id: string;
};

type OrderLineRow = {
	id: string;
	order_id: string;
	variant_id: string;
	reservation_id: string | null;
	quantity: number;
	unit_price_paise: number;
	price_source: 'prelaunch_locked' | 'launch';
	piece_number: number | null;
	sku_snapshot: string;
	name_snapshot: string;
};

type ReservationRow = {
	id: string;
	drop_id: string;
	variant_id: string;
	customer_id: string;
	state: ReservationState;
	piece_number: number | null;
	locked_price_paise: number;
	deposit_paise: number;
	balance_paise: number;
	dispatch_date: string | null;
	cancellation_rule: string;
	balance_due_by: string | null;
	created_at: string;
	updated_at: string;
};

type PaymentRow = {
	id: string;
	order_id: string | null;
	reservation_id: string | null;
	kind: 'deposit' | 'balance' | 'order';
	gateway: string;
	gateway_payment_id: string | null;
	amount_paise: number;
	state: AdminPayment['state'];
	created_at: string;
};

type CustomerRow = { id: string; email: string };

/* -------------------------------------------------------------------------- */
/* Shared loaders                                                              */
/* -------------------------------------------------------------------------- */

async function loadCatalogue(): Promise<{
	drops: DropRow[];
	products: ProductRow[];
	variants: VariantRow[];
	variantDrop: Map<string, string>;
	variantById: Map<string, VariantRow>;
	dropById: Map<string, DropRow>;
}> {
	const client = getCatalogueClient();
	const [dropsRes, productsRes, variantsRes] = await Promise.all([
		client
			.from('drops')
			.select('id, slug, number, name, state, launch_instant, archived_at, edition_size, published_at')
			.order('launch_instant', { ascending: false }),
		client.from('products').select('id, drop_id, name'),
		client.from('variants').select('id, product_id, sku, size, stock_count, reserve_cap, reserved_count')
	]);

	if (dropsRes.error) throw new Error(`admin drops read failed: ${dropsRes.error.message}`);
	if (productsRes.error) throw new Error(`admin products read failed: ${productsRes.error.message}`);
	if (variantsRes.error) throw new Error(`admin variants read failed: ${variantsRes.error.message}`);

	const drops = (dropsRes.data ?? []) as unknown as DropRow[];
	const products = (productsRes.data ?? []) as unknown as ProductRow[];
	const variants = (variantsRes.data ?? []) as unknown as VariantRow[];

	const productDrop = new Map(products.map((p) => [p.id, p.drop_id]));
	const variantDrop = new Map(
		variants.map((v) => [v.id, productDrop.get(v.product_id) ?? ''] as const)
	);

	return {
		drops,
		products,
		variants,
		variantDrop,
		variantById: new Map(variants.map((v) => [v.id, v])),
		dropById: new Map(drops.map((d) => [d.id, d]))
	};
}

/** Email lookup for orders and reservations. Customer records are owner-only (§12). */
async function loadCustomerEmails(ids: string[]): Promise<Map<string, string>> {
	const unique = [...new Set(ids)].filter(Boolean);
	if (unique.length === 0) return new Map();
	const { data, error } = await getServiceClient()
		.from('customers')
		.select('id, email')
		.in('id', unique);
	if (error) throw new Error(`admin customers read failed: ${error.message}`);
	return new Map(((data ?? []) as unknown as CustomerRow[]).map((c) => [c.id, c.email]));
}

function toShipTo(order: OrderRow): ShipTo {
	return {
		name: order.ship_name,
		line1: order.ship_line1,
		line2: order.ship_line2,
		city: order.ship_city,
		state: order.ship_state,
		pincode: order.ship_pincode,
		phone: order.ship_phone,
		country: order.ship_country ?? 'IN'
	};
}

async function writeAudit(
	actor: string,
	action: string,
	entity: string,
	entityId: string,
	detail: Record<string, unknown> = {}
): Promise<void> {
	// §12/RW-141: every privileged write is attributable after the fact.
	// A failed audit insert must not silently swallow the write it describes,
	// so it throws rather than logging quietly.
	const { error } = await getServiceClient()
		.from('admin_audit_log')
		.insert({ actor_email: actor, action, entity, entity_id: entityId, detail });
	if (error) throw new Error(`audit write failed: ${error.message}`);
}

/* -------------------------------------------------------------------------- */

export const supabaseAdminRepository: AdminRepository = {
	async listDropPerformance(): Promise<DropPerformance[]> {
		const catalogue = await loadCatalogue();
		const service = getServiceClient();

		const [linesRes, ordersRes, reservationsRes] = await Promise.all([
			service.from('order_lines').select('order_id, variant_id, reservation_id, quantity'),
			service.from('orders').select('id, state, created_at'),
			service.from('reservations').select('drop_id, piece_number, created_at')
		]);
		if (linesRes.error) throw new Error(`order_lines read failed: ${linesRes.error.message}`);
		if (ordersRes.error) throw new Error(`orders read failed: ${ordersRes.error.message}`);
		if (reservationsRes.error) {
			throw new Error(`reservations read failed: ${reservationsRes.error.message}`);
		}

		const orders = new Map(
			((ordersRes.data ?? []) as unknown as Array<{ id: string; state: OrderState; created_at: string }>).map(
				(o) => [o.id, o]
			)
		);
		const lines = (linesRes.data ?? []) as unknown as Array<{
			order_id: string;
			variant_id: string;
			reservation_id: string | null;
			quantity: number;
		}>;
		const reservations = (reservationsRes.data ?? []) as unknown as Array<{
			drop_id: string;
			piece_number: number | null;
			created_at: string;
		}>;

		return catalogue.drops.map((drop) => {
			const dropVariants = catalogue.variants.filter(
				(v) => catalogue.variantDrop.get(v.id) === drop.id
			);
			const claimEvents: number[] = [];

			const bySize: SizePerformance[] = dropVariants.map((variant) => {
				const openSale = lines.filter((l) => {
					if (l.variant_id !== variant.id || l.reservation_id !== null) return false;
					const order = orders.get(l.order_id);
					return Boolean(order) && order!.state !== 'cancelled';
				});
				const sold = openSale.reduce((n, l) => n + l.quantity, 0);
				for (const line of openSale) {
					const at = ms(orders.get(line.order_id)?.created_at ?? null);
					if (at !== null) for (let i = 0; i < line.quantity; i++) claimEvents.push(at);
				}

				const remaining = Math.max(0, variant.stock_count - variant.reserved_count);
				return {
					variantId: variant.id,
					sku: variant.sku,
					size: variant.size,
					cut: remaining + variant.reserved_count + sold,
					reserved: variant.reserved_count,
					sold,
					remaining,
					reserveCap: variant.reserve_cap
				};
			});

			for (const reservation of reservations) {
				if (reservation.drop_id !== drop.id || reservation.piece_number === null) continue;
				const at = ms(reservation.created_at);
				if (at !== null) claimEvents.push(at);
			}

			claimEvents.sort((a, b) => a - b);
			const launchInstant = Date.parse(drop.launch_instant);
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
				state: drop.state,
				launchInstant,
				editionSize: drop.edition_size,
				published: drop.published_at !== null,
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
		const service = getServiceClient();
		const [paymentsRes, reservationsRes, refundsRes] = await Promise.all([
			service.from('payments').select('kind, state, amount_paise'),
			service.from('reservations').select('state, balance_paise, balance_due_by'),
			service.from('refunds').select('state, amount_paise')
		]);
		if (paymentsRes.error) throw new Error(`payments read failed: ${paymentsRes.error.message}`);
		if (reservationsRes.error) {
			throw new Error(`reservations read failed: ${reservationsRes.error.message}`);
		}
		if (refundsRes.error) throw new Error(`refunds read failed: ${refundsRes.error.message}`);

		const payments = (paymentsRes.data ?? []) as unknown as Array<{
			kind: string;
			state: string;
			amount_paise: number;
		}>;
		const reservations = (reservationsRes.data ?? []) as unknown as Array<{
			state: ReservationState;
			balance_paise: number;
			balance_due_by: string | null;
		}>;
		const refunds = (refundsRes.data ?? []) as unknown as Array<{
			state: string;
			amount_paise: number;
		}>;

		const deposits = payments.filter((p) => p.kind === 'deposit' && p.state === 'captured');
		const outstanding = reservations.filter(
			(r) => r.state === 'reserved' || r.state === 'balance_due'
		);
		const overdue = outstanding.filter(
			(r) => r.state === 'balance_due' && r.balance_due_by !== null && Date.parse(r.balance_due_by) < now
		);
		const processed = refunds.filter((r) => r.state === 'processed');

		return {
			depositsTaken: sum(deposits.map((p) => money(p.amount_paise))),
			depositCount: deposits.length,
			balancesOutstanding: sum(outstanding.map((r) => money(r.balance_paise))),
			balancesOutstandingCount: outstanding.length,
			balancesOverdue: sum(overdue.map((r) => money(r.balance_paise))),
			balancesOverdueCount: overdue.length,
			refundsIssued: sum(processed.map((r) => money(r.amount_paise))),
			refundCount: processed.length
		};
	},

	async revenueByDrop(): Promise<RevenueByDrop[]> {
		const catalogue = await loadCatalogue();
		const service = getServiceClient();

		const [paymentsRes, reservationsRes, linesRes] = await Promise.all([
			service.from('payments').select('order_id, reservation_id, kind, state, amount_paise'),
			service.from('reservations').select('id, drop_id'),
			service.from('order_lines').select('order_id, variant_id')
		]);
		if (paymentsRes.error) throw new Error(`payments read failed: ${paymentsRes.error.message}`);
		if (reservationsRes.error) {
			throw new Error(`reservations read failed: ${reservationsRes.error.message}`);
		}
		if (linesRes.error) throw new Error(`order_lines read failed: ${linesRes.error.message}`);

		const reservationDrop = new Map(
			((reservationsRes.data ?? []) as unknown as Array<{ id: string; drop_id: string }>).map((r) => [
				r.id,
				r.drop_id
			])
		);
		// An order belongs to whichever drop its lines' variants belong to.
		const orderDrop = new Map<string, string>();
		for (const line of (linesRes.data ?? []) as unknown as Array<{
			order_id: string;
			variant_id: string;
		}>) {
			const dropId = catalogue.variantDrop.get(line.variant_id);
			if (dropId) orderDrop.set(line.order_id, dropId);
		}

		const captured = (
			(paymentsRes.data ?? []) as unknown as Array<{
				order_id: string | null;
				reservation_id: string | null;
				kind: 'deposit' | 'balance' | 'order';
				state: string;
				amount_paise: number;
			}>
		).filter((p) => p.state === 'captured');

		return catalogue.drops.map((drop) => {
			const mine = captured.filter((p) =>
				p.reservation_id
					? reservationDrop.get(p.reservation_id) === drop.id
					: p.order_id
						? orderDrop.get(p.order_id) === drop.id
						: false
			);
			const deposits = sum(
				mine.filter((p) => p.kind === 'deposit').map((p) => money(p.amount_paise))
			);
			const balances = sum(
				mine.filter((p) => p.kind === 'balance').map((p) => money(p.amount_paise))
			);
			const orders = sum(mine.filter((p) => p.kind === 'order').map((p) => money(p.amount_paise)));

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
		// The view already does the aggregation — §12's demand board, in SQL.
		const { data, error } = await getServiceClient()
			.from('demand_board')
			.select('drop_id, drop_slug, drop_name, drop_state, variant_id, size, requests, notify_me, waitlist');
		if (error) throw new Error(`demand_board read failed: ${error.message}`);

		return (
			(data ?? []) as unknown as Array<{
				drop_id: string;
				drop_slug: string;
				drop_name: string;
				drop_state: DropState;
				variant_id: string;
				size: Size;
				requests: number;
				notify_me: number;
				waitlist: number;
			}>
		).map((row) => ({
			dropId: row.drop_id,
			dropSlug: row.drop_slug,
			dropName: row.drop_name,
			dropState: row.drop_state,
			variantId: row.variant_id,
			size: row.size,
			requests: Number(row.requests ?? 0),
			notifyMe: Number(row.notify_me ?? 0),
			waitlist: Number(row.waitlist ?? 0)
		}));
	},

	async listDemandEntries(filter): Promise<DemandEntry[]> {
		const catalogue = await loadCatalogue();
		const service = getServiceClient();

		const [requestsRes, notifyRes, waitlistRes] = await Promise.all([
			service.from('drop_requests').select('id, drop_id, variant_id, email, note, created_at, fulfilled_at'),
			service.from('notify_requests').select('id, variant_id, email, created_at, notified_at'),
			service.from('waitlist_entries').select('id, drop_id, variant_id, email:customer_id, position, state, created_at')
		]);
		if (requestsRes.error) throw new Error(`drop_requests read failed: ${requestsRes.error.message}`);
		if (notifyRes.error) throw new Error(`notify_requests read failed: ${notifyRes.error.message}`);
		if (waitlistRes.error) {
			throw new Error(`waitlist_entries read failed: ${waitlistRes.error.message}`);
		}

		const meta = (variantId: string | null) => {
			if (!variantId) return null;
			const variant = catalogue.variantById.get(variantId);
			if (!variant) return null;
			const dropId = catalogue.variantDrop.get(variantId) ?? '';
			const drop = catalogue.dropById.get(dropId);
			return { variant, drop };
		};

		const entries: DemandEntry[] = [];

		for (const r of (requestsRes.data ?? []) as unknown as Array<{
			id: string;
			drop_id: string;
			variant_id: string | null;
			email: string;
			note: string | null;
			created_at: string;
			fulfilled_at: string | null;
		}>) {
			const m = meta(r.variant_id);
			entries.push({
				id: r.id,
				kind: 'request',
				dropId: r.drop_id,
				dropSlug: m?.drop?.slug ?? r.drop_id,
				dropName: m?.drop?.name ?? r.drop_id,
				variantId: r.variant_id,
				size: m?.variant.size ?? null,
				email: r.email,
				note: r.note,
				createdAt: Date.parse(r.created_at),
				position: null,
				state: r.fulfilled_at ? 'fulfilled' : 'open'
			});
		}

		for (const n of (notifyRes.data ?? []) as unknown as Array<{
			id: string;
			variant_id: string;
			email: string;
			created_at: string;
			notified_at: string | null;
		}>) {
			const m = meta(n.variant_id);
			if (!m?.drop) continue;
			entries.push({
				id: n.id,
				kind: 'notify_me',
				dropId: m.drop.id,
				dropSlug: m.drop.slug,
				dropName: m.drop.name,
				variantId: n.variant_id,
				size: m.variant.size,
				email: n.email,
				note: null,
				createdAt: Date.parse(n.created_at),
				position: null,
				state: n.notified_at ? 'notified' : 'open'
			});
		}

		const waitlistRows = (waitlistRes.data ?? []) as unknown as Array<{
			id: string;
			drop_id: string;
			variant_id: string;
			email: string;
			position: number;
			state: string;
			created_at: string;
		}>;
		// waitlist_entries stores a customer_id, not an email: resolve it.
		const emails = await loadCustomerEmails(waitlistRows.map((w) => w.email));
		for (const w of waitlistRows) {
			const m = meta(w.variant_id);
			entries.push({
				id: w.id,
				kind: 'waitlist',
				dropId: w.drop_id,
				dropSlug: m?.drop?.slug ?? w.drop_id,
				dropName: m?.drop?.name ?? w.drop_id,
				variantId: w.variant_id,
				size: m?.variant.size ?? null,
				email: emails.get(w.email) ?? 'unknown',
				note: null,
				createdAt: Date.parse(w.created_at),
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
		const catalogue = await loadCatalogue();
		return catalogue.drops.map((drop) => toDropRow(drop, catalogue.variants, catalogue.variantDrop));
	},

	async findDropRow(slug: string): Promise<AdminDropRow | null> {
		const catalogue = await loadCatalogue();
		const drop = catalogue.drops.find((d) => d.slug === slug);
		return drop ? toDropRow(drop, catalogue.variants, catalogue.variantDrop) : null;
	},

	async setDropState({ dropId, from, to, actor }) {
		// §06: the legality check runs before the write, every time.
		assertTransition(from, to);
		const client = getCatalogueClient();

		// Guarded update: the row must still be in `from`, or another admin
		// moved it while this form was open and this write is stale.
		const { data, error } = await client
			.from('drops')
			.update({ state: to, archived_at: to === 'ARCHIVED' ? new Date().toISOString() : null })
			.eq('id', dropId)
			.eq('state', from)
			.select('id');
		if (error) throw new Error(`drop state write failed: ${error.message}`);
		if (!data || data.length === 0) {
			throw new Error(`Drop is no longer in ${from}. Reload and try again.`);
		}

		const { error: eventError } = await client
			.from('drop_state_events')
			.insert({ drop_id: dropId, from_state: from, to_state: to, trigger: 'manual', actor });
		if (eventError) throw new Error(`state event write failed: ${eventError.message}`);

		await writeAudit(actor, `state ${from} -> ${to}`, 'drop', dropId, { from, to });
	},

	async setDropPublished({ dropId, published, actor }) {
		const { error } = await getCatalogueClient()
			.from('drops')
			.update({ published_at: published ? new Date().toISOString() : null })
			.eq('id', dropId);
		if (error) throw new Error(`publish write failed: ${error.message}`);
		await writeAudit(actor, published ? 'published' : 'unpublished', 'drop', dropId);
	},

	async setDropLaunchInstant({ dropId, launchInstant, actor }) {
		if (!Number.isFinite(launchInstant)) {
			throw new Error('The launch instant must be a real date and time.');
		}
		const client = getCatalogueClient();

		// Read the old value first so the audit row records the move, not just
		// the destination. §07's whole tease schedule counts back from this
		// column, so "what was it before" is the question anyone will ask.
		const { data: before, error: readError } = await client
			.from('drops')
			.select('launch_instant')
			.eq('id', dropId)
			.maybeSingle();
		if (readError) throw new Error(`drop read failed: ${readError.message}`);
		if (!before) throw new Error(`Unknown drop ${dropId}`);

		const previous = (before as { launch_instant: string }).launch_instant;
		const next = new Date(launchInstant).toISOString();

		const { error } = await client
			.from('drops')
			.update({ launch_instant: next })
			.eq('id', dropId);
		if (error) throw new Error(`launch instant write failed: ${error.message}`);

		await writeAudit(actor, `launch ${previous} -> ${next}`, 'drop', dropId, {
			from: previous,
			to: next
		});
	},

	async setVariantStock({ variantId, stockCount, reserveCap, actor }) {
		if (stockCount < 0 || reserveCap < 0) {
			throw new Error('Stock and cap must be zero or greater.');
		}
		// The variants_reserved_within_stock and variants_reserved_within_cap
		// constraints are the real guard; this is the readable error.
		const { error } = await getCatalogueClient()
			.from('variants')
			.update({ stock_count: stockCount, reserve_cap: reserveCap })
			.eq('id', variantId);
		if (error) throw new Error(`stock write failed: ${error.message}`);
		await writeAudit(actor, `stock ${stockCount} / cap ${reserveCap}`, 'variant', variantId, {
			stockCount,
			reserveCap
		});
	},

	async listOrders(filter): Promise<AdminOrderSummary[]> {
		const service = getServiceClient();
		let query = service
			.from('orders')
			.select(
				'id, order_number, state, subtotal_paise, shipping_paise, discount_paise, tax_paise, total_paise, ship_name, ship_line1, ship_line2, ship_city, ship_state, ship_pincode, ship_phone, ship_country, notes, courier_name, tracking_ref, dispatched_at, created_at, customer_id'
			)
			.order('created_at', { ascending: false });
		if (filter?.state) query = query.eq('state', filter.state);

		const { data, error } = await query;
		if (error) throw new Error(`orders read failed: ${error.message}`);
		const orders = (data ?? []) as unknown as OrderRow[];
		if (orders.length === 0) return [];

		const [linesRes, emails] = await Promise.all([
			service
				.from('order_lines')
				.select('order_id, quantity, reservation_id')
				.in('order_id', orders.map((o) => o.id)),
			loadCustomerEmails(orders.map((o) => o.customer_id))
		]);
		if (linesRes.error) throw new Error(`order_lines read failed: ${linesRes.error.message}`);
		const lines = (linesRes.data ?? []) as unknown as Array<{
			order_id: string;
			quantity: number;
			reservation_id: string | null;
		}>;

		return orders.map((order) => {
			const mine = lines.filter((l) => l.order_id === order.id);
			return {
				id: order.id,
				orderNumber: order.order_number,
				email: emails.get(order.customer_id) ?? 'unknown',
				state: order.state,
				total: money(order.total_paise),
				createdAt: Date.parse(order.created_at),
				dispatchedAt: ms(order.dispatched_at),
				courierName: order.courier_name,
				trackingRef: order.tracking_ref,
				pieceCount: mine.reduce((n, l) => n + l.quantity, 0),
				isPreOrder: mine.some((l) => l.reservation_id !== null),
				shipTo: toShipTo(order)
			};
		});
	},

	async findOrder(id: string): Promise<AdminOrderDetail | null> {
		const service = getServiceClient();
		const { data, error } = await service
			.from('orders')
			.select(
				'id, order_number, state, subtotal_paise, shipping_paise, discount_paise, tax_paise, total_paise, ship_name, ship_line1, ship_line2, ship_city, ship_state, ship_pincode, ship_phone, ship_country, notes, courier_name, tracking_ref, dispatched_at, created_at, customer_id'
			)
			.eq('id', id)
			.maybeSingle();
		if (error) throw new Error(`order read failed: ${error.message}`);
		if (!data) return null;
		const order = data as unknown as OrderRow;

		const catalogue = await loadCatalogue();
		const [linesRes, paymentsRes, emails] = await Promise.all([
			service
				.from('order_lines')
				.select(
					'id, order_id, variant_id, reservation_id, quantity, unit_price_paise, price_source, piece_number, sku_snapshot, name_snapshot'
				)
				.eq('order_id', id),
			service
				.from('payments')
				.select('id, order_id, reservation_id, kind, gateway, gateway_payment_id, amount_paise, state, created_at')
				.eq('order_id', id),
			loadCustomerEmails([order.customer_id])
		]);
		if (linesRes.error) throw new Error(`order_lines read failed: ${linesRes.error.message}`);
		if (paymentsRes.error) throw new Error(`payments read failed: ${paymentsRes.error.message}`);

		const lines = (linesRes.data ?? []) as unknown as OrderLineRow[];
		const payments = (paymentsRes.data ?? []) as unknown as PaymentRow[];

		return {
			id: order.id,
			orderNumber: order.order_number,
			email: emails.get(order.customer_id) ?? 'unknown',
			state: order.state,
			total: money(order.total_paise),
			createdAt: Date.parse(order.created_at),
			dispatchedAt: ms(order.dispatched_at),
			courierName: order.courier_name,
			trackingRef: order.tracking_ref,
			pieceCount: lines.reduce((n, l) => n + l.quantity, 0),
			isPreOrder: lines.some((l) => l.reservation_id !== null),
			shipTo: toShipTo(order),
			subtotal: money(order.subtotal_paise),
			shipping: money(order.shipping_paise),
			discount: money(order.discount_paise),
			tax: money(order.tax_paise),
			notes: order.notes,
			lines: lines.map((line) => ({
				id: line.id,
				sku: line.sku_snapshot,
				name: line.name_snapshot,
				size: catalogue.variantById.get(line.variant_id)?.size ?? null,
				quantity: line.quantity,
				unitPrice: money(line.unit_price_paise),
				priceSource: line.price_source,
				pieceNumber: line.piece_number,
				reservationId: line.reservation_id
			})),
			payments: payments
				.map(toAdminPayment)
				.sort((a, b) => a.createdAt - b.createdAt)
		};
	},

	async updateFulfilment({ orderId, state, courierName, trackingRef, actor }) {
		if (state === 'dispatched' && (!courierName || !trackingRef)) {
			throw new Error('Enter the courier name and tracking reference before marking dispatched.');
		}
		const service = getServiceClient();
		const { error } = await service
			.from('orders')
			.update({
				state,
				courier_name: courierName,
				tracking_ref: trackingRef,
				dispatched_at: state === 'dispatched' ? new Date().toISOString() : null
			})
			.eq('id', orderId);
		if (error) throw new Error(`fulfilment write failed: ${error.message}`);

		if (state === 'dispatched') {
			// §08: the reservation behind a pre-order moves with its order.
			const { data: lines, error: linesError } = await service
				.from('order_lines')
				.select('reservation_id')
				.eq('order_id', orderId)
				.not('reservation_id', 'is', null);
			if (linesError) throw new Error(`order_lines read failed: ${linesError.message}`);

			const ids = ((lines ?? []) as unknown as Array<{ reservation_id: string }>).map(
				(l) => l.reservation_id
			);
			if (ids.length > 0) {
				const { error: resError } = await service
					.from('reservations')
					.update({ state: 'dispatched' })
					.in('id', ids);
				if (resError) throw new Error(`reservation write failed: ${resError.message}`);
			}
		}

		await writeAudit(actor, `fulfilment ${state}`, 'order', orderId, { courierName, trackingRef });
	},

	async packingList(limit: number): Promise<PackingListEntry[]> {
		const service = getServiceClient();
		const { data, error } = await service
			.from('orders')
			.select(
				'id, order_number, notes, ship_name, ship_line1, ship_line2, ship_city, ship_state, ship_pincode, ship_phone, ship_country, created_at'
			)
			.in('state', ['paid', 'packed'])
			.order('created_at', { ascending: true })
			.limit(limit);
		if (error) throw new Error(`packing list read failed: ${error.message}`);

		const orders = (data ?? []) as unknown as OrderRow[];
		if (orders.length === 0) return [];

		const catalogue = await loadCatalogue();
		const { data: lineData, error: lineError } = await service
			.from('order_lines')
			.select('order_id, variant_id, reservation_id, quantity, piece_number, sku_snapshot, name_snapshot')
			.in('order_id', orders.map((o) => o.id));
		if (lineError) throw new Error(`order_lines read failed: ${lineError.message}`);
		const lines = (lineData ?? []) as unknown as OrderLineRow[];

		return orders.map((order) => {
			const mine = lines.filter((l) => l.order_id === order.id);
			return {
				orderId: order.id,
				orderNumber: order.order_number,
				isPreOrder: mine.some((l) => l.reservation_id !== null),
				notes: order.notes,
				shipTo: toShipTo(order),
				lines: mine.map((l) => ({
					sku: l.sku_snapshot,
					name: l.name_snapshot,
					size: catalogue.variantById.get(l.variant_id)?.size ?? null,
					quantity: l.quantity,
					pieceNumber: l.piece_number
				}))
			};
		});
	},

	async listReservations(filter): Promise<AdminReservationSummary[]> {
		const service = getServiceClient();
		let query = service
			.from('reservations')
			.select(
				'id, drop_id, variant_id, customer_id, state, piece_number, locked_price_paise, deposit_paise, balance_paise, dispatch_date, cancellation_rule, balance_due_by, created_at, updated_at'
			)
			.order('created_at', { ascending: false });
		if (filter?.state) query = query.eq('state', filter.state);

		const { data, error } = await query;
		if (error) throw new Error(`reservations read failed: ${error.message}`);
		const rows = (data ?? []) as unknown as ReservationRow[];
		if (rows.length === 0) return [];

		const [catalogue, emails] = await Promise.all([
			loadCatalogue(),
			loadCustomerEmails(rows.map((r) => r.customer_id))
		]);

		return rows.map((row) => toReservationSummary(row, catalogue, emails));
	},

	async findReservation(id: string): Promise<AdminReservationDetail | null> {
		const service = getServiceClient();
		const { data, error } = await service
			.from('reservations')
			.select(
				'id, drop_id, variant_id, customer_id, state, piece_number, locked_price_paise, deposit_paise, balance_paise, dispatch_date, cancellation_rule, balance_due_by, created_at, updated_at'
			)
			.eq('id', id)
			.maybeSingle();
		if (error) throw new Error(`reservation read failed: ${error.message}`);
		if (!data) return null;
		const row = data as unknown as ReservationRow;

		const [catalogue, emails, paymentsRes, linkRes] = await Promise.all([
			loadCatalogue(),
			loadCustomerEmails([row.customer_id]),
			service
				.from('payments')
				.select('id, order_id, reservation_id, kind, gateway, gateway_payment_id, amount_paise, state, created_at')
				.eq('reservation_id', id),
			service.from('order_lines').select('order_id').eq('reservation_id', id).limit(1)
		]);
		if (paymentsRes.error) throw new Error(`payments read failed: ${paymentsRes.error.message}`);
		if (linkRes.error) throw new Error(`order_lines read failed: ${linkRes.error.message}`);

		const payments = ((paymentsRes.data ?? []) as unknown as PaymentRow[])
			.map(toAdminPayment)
			.sort((a, b) => a.createdAt - b.createdAt);

		const orderId =
			((linkRes.data ?? []) as unknown as Array<{ order_id: string }>)[0]?.order_id ?? null;

		let orderNumber: string | null = null;
		if (orderId) {
			const { data: orderRow } = await service
				.from('orders')
				.select('order_number')
				.eq('id', orderId)
				.maybeSingle();
			orderNumber = (orderRow as { order_number?: string } | null)?.order_number ?? null;
		}

		const paymentIds = payments.map((p) => p.id);
		const { data: refundData, error: refundError } = paymentIds.length
			? await service
					.from('refunds')
					.select('id, payment_id, amount_paise, reason, state, created_at')
					.in('payment_id', paymentIds)
			: { data: [], error: null };
		if (refundError) throw new Error(`refunds read failed: ${refundError.message}`);

		return {
			...toReservationSummary(row, catalogue, emails),
			cancellationRule: row.cancellation_rule,
			dispatchDate: row.dispatch_date,
			/* §08 "ONE CONTINUOUS RECORD": the timeline is rebuilt from the
			   payment ledger and the row's own timestamps rather than stored
			   twice, so it can never drift from what actually happened. */
			timeline: buildTimeline(row, payments),
			orderId,
			orderNumber,
			payments,
			refunds: (
				(refundData ?? []) as unknown as Array<{
					id: string;
					amount_paise: number;
					reason: 'cap_race' | 'cancellation' | 'defect' | 'admin';
					state: 'initiated' | 'processed' | 'failed';
					created_at: string;
				}>
			)
				.map((r) => ({
					id: r.id,
					amount: money(r.amount_paise),
					reason: r.reason,
					state: r.state,
					createdAt: Date.parse(r.created_at)
				}))
				.sort((a, b) => a.createdAt - b.createdAt)
		};
	},

	async markBalanceRequested({ reservationId, dueBy, actor }) {
		const service = getServiceClient();
		const { data, error } = await service
			.from('reservations')
			.update({ state: 'balance_due', balance_due_by: new Date(dueBy).toISOString() })
			.eq('id', reservationId)
			.in('state', ['reserved', 'balance_due'])
			.select('id');
		if (error) throw new Error(`balance request write failed: ${error.message}`);
		if (!data || data.length === 0) {
			throw new Error('A balance link only applies to a confirmed reservation.');
		}
		await writeAudit(actor, 'balance link sent', 'reservation', reservationId, { dueBy });
	},

	async listContact(filter): Promise<AdminContactSubmission[]> {
		let query = getServiceClient()
			.from('contact_submissions')
			.select('id, name, email, subject, message, status, is_spam, created_at')
			.order('created_at', { ascending: false });
		if (filter?.status) query = query.eq('status', filter.status);

		const { data, error } = await query;
		if (error) throw new Error(`contact read failed: ${error.message}`);

		return (
			(data ?? []) as unknown as Array<{
				id: string;
				name: string;
				email: string;
				subject: string;
				message: string;
				status: ContactStatus;
				is_spam: boolean;
				created_at: string;
			}>
		).map((row) => ({
			id: row.id,
			name: row.name,
			email: row.email,
			subject: row.subject,
			message: row.message,
			status: row.status,
			isSpam: row.is_spam,
			createdAt: Date.parse(row.created_at)
		}));
	},

	async setContactStatus({ id, status, actor }) {
		const { error } = await getServiceClient()
			.from('contact_submissions')
			.update({ status })
			.eq('id', id);
		if (error) throw new Error(`contact write failed: ${error.message}`);
		await writeAudit(actor, `status ${status}`, 'contact_submission', id);
	}
};

/* -------------------------------------------------------------------------- */

function toAdminPayment(row: PaymentRow): AdminPayment {
	return {
		id: row.id,
		kind: row.kind,
		gateway: row.gateway,
		state: row.state,
		amount: money(row.amount_paise),
		createdAt: Date.parse(row.created_at),
		gatewayPaymentId: row.gateway_payment_id
	};
}

function toReservationSummary(
	row: ReservationRow,
	catalogue: Awaited<ReturnType<typeof loadCatalogue>>,
	emails: Map<string, string>
): AdminReservationSummary {
	const variant = catalogue.variantById.get(row.variant_id);
	const drop = catalogue.dropById.get(row.drop_id);
	return {
		id: row.id,
		dropId: row.drop_id,
		dropSlug: drop?.slug ?? row.drop_id,
		dropName: drop?.name ?? row.drop_id,
		sku: variant?.sku ?? row.variant_id,
		size: (variant?.size ?? 'M') as Size,
		email: emails.get(row.customer_id) ?? 'unknown',
		state: row.state,
		pieceNumber: row.piece_number,
		lockedPrice: money(row.locked_price_paise),
		deposit: money(row.deposit_paise),
		balance: money(row.balance_paise),
		balanceDueBy: ms(row.balance_due_by),
		createdAt: Date.parse(row.created_at)
	};
}

function buildTimeline(row: ReservationRow, payments: AdminPayment[]) {
	const events = [
		{
			at: Date.parse(row.created_at),
			label: 'Reservation opened',
			detail: row.piece_number ? null : 'No piece number issued'
		}
	];

	for (const payment of payments) {
		if (payment.state !== 'captured' && payment.state !== 'refunded') continue;
		events.push({
			at: payment.createdAt,
			label: payment.kind === 'deposit' ? 'Deposit confirmed' : 'Balance cleared',
			detail: payment.state === 'refunded' ? 'Later refunded' : null
		});
	}

	if (row.piece_number !== null) {
		events.push({
			at: Date.parse(row.created_at),
			label: `Piece ${row.piece_number} allocated`,
			detail: 'Allocated on payment confirmation, never before'
		});
	}

	if (row.balance_due_by) {
		events.push({
			at: Date.parse(row.balance_due_by),
			label: 'Balance due',
			detail: null
		});
	}

	return events.sort((a, b) => a.at - b.at);
}

function toDropRow(
	drop: DropRow,
	variants: VariantRow[],
	variantDrop: Map<string, string>
): AdminDropRow {
	return {
		id: drop.id,
		slug: drop.slug,
		number: drop.number,
		name: drop.name,
		state: drop.state,
		launchInstant: Date.parse(drop.launch_instant),
		archivedAt: ms(drop.archived_at),
		editionSize: drop.edition_size,
		published: drop.published_at !== null,
		variants: variants
			.filter((v) => variantDrop.get(v.id) === drop.id)
			.map((v) => ({
				id: v.id,
				sku: v.sku,
				size: v.size,
				stockCount: v.stock_count,
				reserveCap: v.reserve_cap,
				reservedCount: v.reserved_count
			})),
		legalTransitions: legalTransitionsFrom(drop.state)
	};
}
