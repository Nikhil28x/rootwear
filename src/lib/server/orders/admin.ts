/**
 * Orders for admin: finding them, and everything done to one after payment —
 * packing, dispatch, delivery, notes, cancellation, refunds and returns.
 *
 * Rules that protect money and stock are enforced here:
 *   - a refund never exceeds what was captured less what was refunded;
 *   - a refund goes to the gateway FIRST and is recorded with its result, so
 *     the record never claims money moved that did not;
 *   - stock goes back only for pieces that never left (cancellation before
 *     dispatch) or that came back in a sellable state (a received return);
 *   - pre-order lines are cancelled from their reservation, not here.
 */
import { getCatalogueClient, getServiceClient } from '$lib/server/db/clients';
import { writeAudit, auditFor } from '$lib/server/admin/audit';
import { paymentProvider } from '$lib/server/payments';
import { messagesFor, type OutboxMessage } from '$lib/server/messaging/outbox';
import { paise, type Paise } from '$lib/money';
import { issueCreditNote, documentsForOrder, issueInvoice, type InvoiceDocument } from './invoices';
import { notifyOrder } from './notify';
import { attributeRecovery } from '$lib/server/carts/admin';
import { markWonByOrder } from '$lib/server/leads/admin';

export class OrderError extends Error {}

export type OrderState =
	'pending_payment' | 'paid' | 'packed' | 'dispatched' | 'delivered' | 'cancelled' | 'refunded';

export const ORDER_STATES: readonly OrderState[] = [
	'pending_payment',
	'paid',
	'packed',
	'dispatched',
	'delivered',
	'cancelled',
	'refunded'
];

type OrderRow = {
	id: string;
	order_number: string;
	customer_id: string;
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
	delivered_at: string | null;
	packed_at: string | null;
	cancelled_at: string | null;
	cancel_reason: string | null;
	public_token: string;
	created_at: string;
	updated_at: string;
};

const ms = (value: string | null | undefined) => (value ? Date.parse(value) : null);
const money = (value: number | string | null | undefined): Paise =>
	paise(Math.round(Number(value ?? 0)));

export type ShipTo = {
	readonly name: string;
	readonly line1: string;
	readonly line2: string | null;
	readonly city: string;
	readonly state: string;
	readonly pincode: string;
	readonly phone: string;
};

function shipTo(row: OrderRow): ShipTo {
	return {
		name: row.ship_name,
		line1: row.ship_line1,
		line2: row.ship_line2,
		city: row.ship_city,
		state: row.ship_state,
		pincode: row.ship_pincode,
		phone: row.ship_phone
	};
}

/* ------------------------------------------------------------------------ */
/* Lists                                                                     */
/* ------------------------------------------------------------------------ */

export type OrderListItem = {
	readonly id: string;
	readonly number: string;
	readonly state: OrderState;
	readonly email: string;
	readonly name: string;
	readonly city: string;
	readonly total: Paise;
	readonly pieces: number;
	readonly isPreOrder: boolean;
	readonly createdAt: number;
	readonly trackingRef: string | null;
	readonly courierName: string | null;
	readonly openReturn: boolean;
};

export type OrderFilter = {
	readonly state?: OrderState | 'to_ship' | 'returns';
	readonly search?: string;
	readonly from?: number;
	readonly to?: number;
	readonly dropId?: string;
	readonly customerId?: string;
};

export const ORDER_PAGE_SIZE = 50;

/** Order ids matching a search: number, name, phone, pincode, tracking, or the customer's email. */
async function searchIds(term: string): Promise<string[] | null> {
	const clean = term.replace(/[%,()*]/g, ' ').trim();
	if (!clean) return null;
	const client = getServiceClient();
	const [byOrder, byCustomer] = await Promise.all([
		client
			.from('orders')
			.select('id')
			.or(
				`order_number.ilike.*${clean}*,ship_name.ilike.*${clean}*,ship_phone.ilike.*${clean.replace(/\s/g, '')}*,ship_pincode.eq.${clean},tracking_ref.ilike.*${clean}*`
			)
			.limit(500),
		client.from('customers').select('id').ilike('email', `*${clean}*`).limit(200)
	]);
	const ids = new Set(((byOrder.data ?? []) as { id: string }[]).map((r) => r.id));
	const customers = ((byCustomer.data ?? []) as { id: string }[]).map((r) => r.id);
	if (customers.length) {
		const { data } = await client
			.from('orders')
			.select('id')
			.in('customer_id', customers)
			.limit(500);
		for (const r of (data ?? []) as { id: string }[]) ids.add(r.id);
	}
	return [...ids];
}

async function dropOrderIds(dropId: string): Promise<string[]> {
	const { data: products } = await getCatalogueClient()
		.from('products')
		.select('id')
		.eq('drop_id', dropId);
	const productIds = ((products ?? []) as { id: string }[]).map((p) => p.id);
	if (!productIds.length) return [];
	const { data: variants } = await getCatalogueClient()
		.from('variants')
		.select('id')
		.in('product_id', productIds);
	const variantIds = ((variants ?? []) as { id: string }[]).map((v) => v.id);
	if (!variantIds.length) return [];
	const { data } = await getServiceClient()
		.from('order_lines')
		.select('order_id')
		.in('variant_id', variantIds);
	return [...new Set(((data ?? []) as { order_id: string }[]).map((l) => l.order_id))];
}

async function openReturnOrderIds(): Promise<string[]> {
	const { data } = await getServiceClient()
		.from('returns')
		.select('order_id')
		.in('status', ['requested', 'received']);
	return [...new Set(((data ?? []) as { order_id: string }[]).map((r) => r.order_id))];
}

export async function listOrders(
	filter: OrderFilter,
	page: number,
	options: { all?: boolean } = {}
): Promise<{ orders: OrderListItem[]; total: number }> {
	const client = getServiceClient();
	let query = client
		.from('orders')
		.select('*', { count: 'exact' })
		.order('created_at', { ascending: false });

	if (filter.state === 'to_ship') query = query.in('state', ['paid', 'packed']);
	else if (filter.state === 'returns') {
		const ids = await openReturnOrderIds();
		query = query.in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
	} else if (filter.state) query = query.eq('state', filter.state);
	else query = query.neq('state', 'pending_payment');

	if (filter.search) {
		const ids = await searchIds(filter.search);
		if (ids) query = query.in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
	}
	if (filter.dropId) {
		const ids = await dropOrderIds(filter.dropId);
		query = query.in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
	}
	if (filter.customerId) query = query.eq('customer_id', filter.customerId);
	if (filter.from) query = query.gte('created_at', new Date(filter.from).toISOString());
	if (filter.to) query = query.lte('created_at', new Date(filter.to).toISOString());

	if (!options.all) {
		const start = Math.max(0, page - 1) * ORDER_PAGE_SIZE;
		query = query.range(start, start + ORDER_PAGE_SIZE - 1);
	}
	const { data, error, count } = await query;
	if (error) throw new Error(`orders read failed: ${error.message}`);
	const rows = (data ?? []) as OrderRow[];
	if (rows.length === 0) return { orders: [], total: count ?? 0 };

	const ids = rows.map((r) => r.id);
	const [lines, customers, returns] = await Promise.all([
		client.from('order_lines').select('order_id, quantity, reservation_id').in('order_id', ids),
		client
			.from('customers')
			.select('id, email')
			.in('id', [...new Set(rows.map((r) => r.customer_id))]),
		client
			.from('returns')
			.select('order_id')
			.in('order_id', ids)
			.in('status', ['requested', 'received'])
	]);
	const lineRows = (lines.data ?? []) as {
		order_id: string;
		quantity: number;
		reservation_id: string | null;
	}[];
	const emails = new Map(
		((customers.data ?? []) as { id: string; email: string }[]).map((c) => [c.id, c.email])
	);
	const open = new Set(((returns.data ?? []) as { order_id: string }[]).map((r) => r.order_id));

	return {
		total: count ?? rows.length,
		orders: rows.map((row) => {
			const mine = lineRows.filter((l) => l.order_id === row.id);
			return {
				id: row.id,
				number: row.order_number,
				state: row.state,
				email: emails.get(row.customer_id) ?? '',
				name: row.ship_name,
				city: row.ship_city,
				total: money(row.total_paise),
				pieces: mine.reduce((n, l) => n + l.quantity, 0),
				isPreOrder: mine.some((l) => l.reservation_id !== null),
				createdAt: Date.parse(row.created_at),
				trackingRef: row.tracking_ref,
				courierName: row.courier_name,
				openReturn: open.has(row.id)
			};
		})
	};
}

/** Counts for the tabs. */
export async function orderCounts(): Promise<Record<string, number>> {
	const client = getServiceClient();
	const head = (states: string[]) =>
		client.from('orders').select('id', { count: 'exact', head: true }).in('state', states);
	const [toShip, dispatched, unpaid, returns] = await Promise.all([
		head(['paid', 'packed']),
		head(['dispatched']),
		head(['pending_payment']),
		openReturnOrderIds()
	]);
	return {
		to_ship: toShip.count ?? 0,
		dispatched: dispatched.count ?? 0,
		pending_payment: unpaid.count ?? 0,
		returns: returns.length
	};
}

/* ------------------------------------------------------------------------ */
/* One order                                                                 */
/* ------------------------------------------------------------------------ */

export type OrderLine = {
	readonly id: string;
	readonly variantId: string;
	readonly sku: string;
	readonly name: string;
	readonly variant: string | null;
	readonly quantity: number;
	readonly unitPrice: Paise;
	readonly lineTotal: Paise;
	readonly pieceNumber: number | null;
	readonly reservationId: string | null;
	readonly image: string | null;
	readonly productId: string | null;
	readonly dropSlug: string | null;
};

export type OrderPayment = {
	readonly id: string;
	readonly kind: 'order' | 'deposit' | 'balance';
	readonly state: string;
	readonly amount: Paise;
	readonly gatewayPaymentId: string | null;
	readonly createdAt: number;
};

export type OrderRefund = {
	readonly id: string;
	readonly paymentId: string;
	readonly amount: Paise;
	readonly reason: string;
	readonly state: 'initiated' | 'processed' | 'failed';
	readonly note: string | null;
	readonly createdBy: string | null;
	readonly createdAt: number;
};

export type OrderNote = {
	readonly id: string;
	readonly body: string;
	readonly author: string;
	readonly at: number;
};

export type ReturnLine = { readonly orderLineId: string; readonly quantity: number };

export type OrderReturn = {
	readonly id: string;
	readonly lines: readonly ReturnLine[];
	readonly reason: string;
	readonly detail: string | null;
	readonly outcome: 'refund' | 'exchange' | 'repair' | 'none';
	readonly status: 'requested' | 'received' | 'completed' | 'rejected';
	readonly exchangeVariantId: string | null;
	readonly exchangeLabel: string | null;
	readonly refundId: string | null;
	readonly restocked: boolean;
	readonly courierName: string | null;
	readonly trackingRef: string | null;
	readonly createdBy: string | null;
	readonly createdAt: number;
	readonly updatedAt: number;
};

export type OrderDetail = {
	readonly id: string;
	readonly number: string;
	readonly state: OrderState;
	readonly customerId: string;
	readonly email: string;
	readonly phone: string | null;
	readonly shipTo: ShipTo;
	readonly customerNote: string | null;
	readonly subtotal: Paise;
	readonly shipping: Paise;
	readonly discount: Paise;
	readonly total: Paise;
	readonly courierName: string | null;
	readonly trackingRef: string | null;
	readonly createdAt: number;
	readonly packedAt: number | null;
	readonly dispatchedAt: number | null;
	readonly deliveredAt: number | null;
	readonly cancelledAt: number | null;
	readonly cancelReason: string | null;
	readonly publicToken: string;
	readonly lines: readonly OrderLine[];
	readonly payments: readonly OrderPayment[];
	readonly refunds: readonly OrderRefund[];
	readonly notes: readonly OrderNote[];
	readonly returns: readonly OrderReturn[];
	readonly documents: readonly InvoiceDocument[];
	readonly messages: readonly OutboxMessage[];
	readonly captured: Paise;
	readonly refunded: Paise;
	readonly refundable: Paise;
	readonly isPreOrder: boolean;
	readonly otherOrders: number;
};

async function variantInfo(variantIds: string[]) {
	if (!variantIds.length)
		return new Map<
			string,
			{ productId: string; image: string | null; dropSlug: string | null; label: string }
		>();
	const catalogue = getCatalogueClient();
	const { data: variants } = await catalogue
		.from('variants')
		.select('id, product_id, size, colourway_id')
		.in('id', variantIds);
	const vs = (variants ?? []) as {
		id: string;
		product_id: string;
		size: string;
		colourway_id: string | null;
	}[];
	const productIds = [...new Set(vs.map((v) => v.product_id))];
	const [{ data: images }, { data: products }, { data: colours }] = await Promise.all([
		catalogue
			.from('product_images')
			.select('product_id, url, position')
			.in('product_id', productIds)
			.order('position'),
		catalogue.from('products').select('id, drop_id').in('id', productIds),
		catalogue.from('colourways').select('id, name').in('product_id', productIds)
	]);
	const dropIds = [...new Set(((products ?? []) as { drop_id: string }[]).map((p) => p.drop_id))];
	const { data: drops } = await catalogue.from('drops').select('id, slug').in('id', dropIds);
	const slugOf = new Map(
		((drops ?? []) as { id: string; slug: string }[]).map((d) => [d.id, d.slug])
	);
	const dropOf = new Map(
		((products ?? []) as { id: string; drop_id: string }[]).map((p) => [p.id, p.drop_id])
	);
	const colourName = new Map(
		((colours ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name])
	);
	const firstImage = new Map<string, string>();
	for (const img of (images ?? []) as { product_id: string; url: string }[]) {
		if (!firstImage.has(img.product_id)) firstImage.set(img.product_id, img.url);
	}
	return new Map(
		vs.map((v) => [
			v.id,
			{
				productId: v.product_id,
				image: firstImage.get(v.product_id) ?? null,
				dropSlug: slugOf.get(dropOf.get(v.product_id) ?? '') ?? null,
				label: [v.colourway_id ? colourName.get(v.colourway_id) : null, v.size]
					.filter(Boolean)
					.join(' / ')
			}
		])
	);
}

export async function getOrder(id: string): Promise<OrderDetail | null> {
	const client = getServiceClient();
	const { data, error } = await client.from('orders').select('*').eq('id', id).maybeSingle();
	if (error) throw new Error(`order read failed: ${error.message}`);
	if (!data) return null;
	const row = data as OrderRow;

	const [linesRes, customerRes, notesRes, returnsRes, documents, messages, otherRes] =
		await Promise.all([
			client.from('order_lines').select('*').eq('order_id', id),
			client.from('customers').select('email, phone').eq('id', row.customer_id).maybeSingle(),
			client
				.from('order_notes')
				.select('*')
				.eq('order_id', id)
				.order('created_at', { ascending: false }),
			client
				.from('returns')
				.select('*')
				.eq('order_id', id)
				.order('created_at', { ascending: false }),
			documentsForOrder(id),
			messagesFor('order', id),
			client
				.from('orders')
				.select('id', { count: 'exact', head: true })
				.eq('customer_id', row.customer_id)
				.neq('id', id)
				.neq('state', 'pending_payment')
		]);

	const lineRows = (linesRes.data ?? []) as {
		id: string;
		variant_id: string;
		reservation_id: string | null;
		quantity: number;
		unit_price_paise: number;
		piece_number: number | null;
		sku_snapshot: string;
		name_snapshot: string;
		variant_snapshot: string | null;
	}[];
	const info = await variantInfo([...new Set(lineRows.map((l) => l.variant_id))]);
	const reservationIds = lineRows
		.map((l) => l.reservation_id)
		.filter((r): r is string => r !== null);

	const { data: paymentRows } = await client
		.from('payments')
		.select('*')
		.or(
			reservationIds.length
				? `order_id.eq.${id},reservation_id.in.(${reservationIds.join(',')})`
				: `order_id.eq.${id}`
		)
		.order('created_at');
	const payments = (
		(paymentRows ?? []) as {
			id: string;
			kind: OrderPayment['kind'];
			state: string;
			amount_paise: number;
			gateway_payment_id: string | null;
			created_at: string;
		}[]
	).map((p) => ({
		id: p.id,
		kind: p.kind,
		state: p.state,
		amount: money(p.amount_paise),
		gatewayPaymentId: p.gateway_payment_id,
		createdAt: Date.parse(p.created_at)
	}));

	const { data: refundRows } = payments.length
		? await client
				.from('refunds')
				.select('*')
				.in(
					'payment_id',
					payments.map((p) => p.id)
				)
				.order('created_at')
		: { data: [] };
	const refunds = (
		(refundRows ?? []) as {
			id: string;
			payment_id: string;
			amount_paise: number;
			reason: string;
			state: OrderRefund['state'];
			note: string | null;
			created_by: string | null;
			created_at: string;
		}[]
	).map((r) => ({
		id: r.id,
		paymentId: r.payment_id,
		amount: money(r.amount_paise),
		reason: r.reason,
		state: r.state,
		note: r.note,
		createdBy: r.created_by,
		createdAt: Date.parse(r.created_at)
	}));

	const captured = payments
		.filter((p) => p.state === 'captured' || p.state === 'refunded')
		.reduce((n, p) => n + Number(p.amount), 0);
	const refunded = refunds
		.filter((r) => r.state !== 'failed')
		.reduce((n, r) => n + Number(r.amount), 0);

	const returnRows = (returnsRes.data ?? []) as {
		id: string;
		lines: { order_line_id: string; quantity: number }[];
		reason: string;
		detail: string | null;
		outcome: OrderReturn['outcome'];
		status: OrderReturn['status'];
		exchange_variant_id: string | null;
		refund_id: string | null;
		restocked: boolean;
		courier_name: string | null;
		tracking_ref: string | null;
		created_by: string | null;
		created_at: string;
		updated_at: string;
	}[];
	const exchangeInfo = await variantInfo(
		returnRows.map((r) => r.exchange_variant_id).filter((v): v is string => v !== null)
	);

	const customer = (customerRes.data ?? { email: '', phone: null }) as {
		email: string;
		phone: string | null;
	};

	return {
		id: row.id,
		number: row.order_number,
		state: row.state,
		customerId: row.customer_id,
		email: customer.email,
		phone: row.ship_phone || customer.phone,
		shipTo: shipTo(row),
		customerNote: row.notes,
		subtotal: money(row.subtotal_paise),
		shipping: money(row.shipping_paise),
		discount: money(row.discount_paise),
		total: money(row.total_paise),
		courierName: row.courier_name,
		trackingRef: row.tracking_ref,
		createdAt: Date.parse(row.created_at),
		packedAt: ms(row.packed_at),
		dispatchedAt: ms(row.dispatched_at),
		deliveredAt: ms(row.delivered_at),
		cancelledAt: ms(row.cancelled_at),
		cancelReason: row.cancel_reason,
		publicToken: row.public_token,
		lines: lineRows.map((l) => {
			const v = info.get(l.variant_id);
			return {
				id: l.id,
				variantId: l.variant_id,
				sku: l.sku_snapshot,
				name: l.name_snapshot,
				variant: l.variant_snapshot ?? v?.label ?? null,
				quantity: l.quantity,
				unitPrice: money(l.unit_price_paise),
				lineTotal: money(Number(l.unit_price_paise) * l.quantity),
				pieceNumber: l.piece_number,
				reservationId: l.reservation_id,
				image: v?.image ?? null,
				productId: v?.productId ?? null,
				dropSlug: v?.dropSlug ?? null
			};
		}),
		payments,
		refunds,
		notes: (
			(notesRes.data ?? []) as { id: string; body: string; author: string; created_at: string }[]
		).map((n) => ({
			id: n.id,
			body: n.body,
			author: n.author,
			at: Date.parse(n.created_at)
		})),
		returns: returnRows.map((r) => ({
			id: r.id,
			lines: (r.lines ?? []).map((l) => ({ orderLineId: l.order_line_id, quantity: l.quantity })),
			reason: r.reason,
			detail: r.detail,
			outcome: r.outcome,
			status: r.status,
			exchangeVariantId: r.exchange_variant_id,
			exchangeLabel: r.exchange_variant_id
				? (exchangeInfo.get(r.exchange_variant_id)?.label ?? null)
				: null,
			refundId: r.refund_id,
			restocked: r.restocked,
			courierName: r.courier_name,
			trackingRef: r.tracking_ref,
			createdBy: r.created_by,
			createdAt: Date.parse(r.created_at),
			updatedAt: Date.parse(r.updated_at)
		})),
		documents,
		messages,
		captured: paise(captured),
		refunded: paise(refunded),
		refundable: paise(Math.max(0, captured - refunded)),
		isPreOrder: reservationIds.length > 0,
		otherOrders: otherRes.count ?? 0
	};
}

export async function orderHistory(id: string) {
	return auditFor('order', id, 50);
}

/* ------------------------------------------------------------------------ */
/* Fulfilment                                                                */
/* ------------------------------------------------------------------------ */

async function stateOf(id: string): Promise<OrderState> {
	const { data, error } = await getServiceClient()
		.from('orders')
		.select('state')
		.eq('id', id)
		.single();
	if (error || !data) throw new OrderError('That order no longer exists.');
	return (data as { state: OrderState }).state;
}

/** Marks paid orders packed. Returns how many moved; others are left as they were. */
export async function markPacked(ids: readonly string[], actor: string): Promise<number> {
	if (ids.length === 0) return 0;
	const { data, error } = await getServiceClient()
		.from('orders')
		.update({ state: 'packed', packed_at: new Date().toISOString() })
		.in('id', [...ids])
		.eq('state', 'paid')
		.select('id');
	if (error) throw new Error(`pack failed: ${error.message}`);
	const moved = (data ?? []) as { id: string }[];
	for (const row of moved) await writeAudit(actor, 'packed', 'order', row.id);
	return moved.length;
}

export async function markDispatched(input: {
	orderId: string;
	courierName: string;
	trackingRef: string;
	notify: boolean;
	actor: string;
}): Promise<void> {
	const courier = input.courierName.trim();
	const tracking = input.trackingRef.trim();
	if (!courier || !tracking)
		throw new OrderError('Enter the courier and the tracking number before marking it dispatched.');
	const state = await stateOf(input.orderId);
	if (!['paid', 'packed', 'dispatched'].includes(state)) {
		throw new OrderError(`An order that is ${state.replace('_', ' ')} cannot be dispatched.`);
	}
	const client = getServiceClient();
	const now = new Date().toISOString();
	const { error } = await client
		.from('orders')
		.update({
			state: 'dispatched',
			courier_name: courier,
			tracking_ref: tracking,
			dispatched_at: state === 'dispatched' ? undefined : now,
			packed_at: state === 'paid' ? now : undefined
		})
		.eq('id', input.orderId);
	if (error) throw new Error(`dispatch failed: ${error.message}`);

	// §08: the reservation behind a pre-order moves with its order.
	const { data: lines } = await client
		.from('order_lines')
		.select('reservation_id')
		.eq('order_id', input.orderId)
		.not('reservation_id', 'is', null);
	const reservationIds = ((lines ?? []) as { reservation_id: string }[]).map(
		(l) => l.reservation_id
	);
	if (reservationIds.length)
		await client.from('reservations').update({ state: 'dispatched' }).in('id', reservationIds);

	await writeAudit(
		input.actor,
		state === 'dispatched' ? 'tracking changed' : 'dispatched',
		'order',
		input.orderId,
		{
			courier,
			tracking
		}
	);
	if (input.notify)
		await notifyOrder(input.orderId, 'dispatched', { actor: input.actor, once: false });
}

export async function markDelivered(input: {
	orderId: string;
	notify: boolean;
	actor: string;
}): Promise<void> {
	const state = await stateOf(input.orderId);
	if (state !== 'dispatched')
		throw new OrderError('Only a dispatched order can be marked delivered.');
	const { error } = await getServiceClient()
		.from('orders')
		.update({ state: 'delivered', delivered_at: new Date().toISOString() })
		.eq('id', input.orderId);
	if (error) throw new Error(`delivery failed: ${error.message}`);
	await writeAudit(input.actor, 'delivered', 'order', input.orderId);
	if (input.notify) await notifyOrder(input.orderId, 'delivered', { actor: input.actor });
}

/** Steps back one fulfilment state, for a mis-click. Never past paid. */
export async function undoFulfilment(input: {
	orderId: string;
	actor: string;
}): Promise<OrderState> {
	const state = await stateOf(input.orderId);
	const back: Partial<Record<OrderState, { state: OrderState; clear: Record<string, null> }>> = {
		packed: { state: 'paid', clear: { packed_at: null } },
		dispatched: { state: 'packed', clear: { dispatched_at: null } },
		delivered: { state: 'dispatched', clear: { delivered_at: null } }
	};
	const step = back[state];
	if (!step) throw new OrderError('There is nothing to undo on this order.');
	const { error } = await getServiceClient()
		.from('orders')
		.update({ state: step.state, ...step.clear })
		.eq('id', input.orderId)
		.eq('state', state);
	if (error) throw new Error(`undo failed: ${error.message}`);
	await writeAudit(input.actor, `back to ${step.state}`, 'order', input.orderId);
	return step.state;
}

export async function updateAddress(input: {
	orderId: string;
	to: ShipTo;
	actor: string;
}): Promise<void> {
	const state = await stateOf(input.orderId);
	if (['dispatched', 'delivered', 'cancelled', 'refunded'].includes(state)) {
		throw new OrderError('The address can only change before the order is dispatched.');
	}
	if (!/^[1-9][0-9]{5}$/.test(input.to.pincode))
		throw new OrderError('Enter a 6-digit Indian pincode.');
	if (
		!input.to.name.trim() ||
		!input.to.line1.trim() ||
		!input.to.city.trim() ||
		!input.to.state.trim()
	) {
		throw new OrderError('Name, first address line, city and state are all needed.');
	}
	const { error } = await getServiceClient()
		.from('orders')
		.update({
			ship_name: input.to.name.trim(),
			ship_line1: input.to.line1.trim(),
			ship_line2: input.to.line2?.trim() || null,
			ship_city: input.to.city.trim(),
			ship_state: input.to.state.trim(),
			ship_pincode: input.to.pincode,
			ship_phone: input.to.phone.trim()
		})
		.eq('id', input.orderId);
	if (error) throw new Error(`address update failed: ${error.message}`);
	await writeAudit(input.actor, 'address changed', 'order', input.orderId, { to: input.to });
}

export async function addNote(input: {
	orderId: string;
	body: string;
	actor: string;
}): Promise<void> {
	const body = input.body.trim();
	if (!body) throw new OrderError('Write the note first.');
	const { error } = await getServiceClient()
		.from('order_notes')
		.insert({ order_id: input.orderId, body, author: input.actor });
	if (error) throw new Error(`note failed: ${error.message}`);
}

export async function deleteNote(input: { noteId: string; actor: string }): Promise<void> {
	await getServiceClient()
		.from('order_notes')
		.delete()
		.eq('id', input.noteId)
		.eq('author', input.actor);
}

/* ------------------------------------------------------------------------ */
/* Money                                                                     */
/* ------------------------------------------------------------------------ */

const REFUND_REASONS = ['cancellation', 'defect', 'return', 'goodwill', 'admin'] as const;
export type RefundReason = (typeof REFUND_REASONS)[number];

/**
 * Sends money back through the gateway, latest payment first, and records
 * each refund with the gateway's answer. Issues a credit note and tells the
 * customer. Returns the refund ids.
 */
export async function refund(input: {
	orderId: string;
	amount: number;
	reason: RefundReason;
	note: string | null;
	notify: boolean;
	actor: string;
}): Promise<string[]> {
	if (!REFUND_REASONS.includes(input.reason)) throw new OrderError('Pick a reason for the refund.');
	if (!Number.isInteger(input.amount) || input.amount <= 0)
		throw new OrderError('Enter an amount to refund.');
	const order = await getOrder(input.orderId);
	if (!order) throw new OrderError('That order no longer exists.');
	if (input.amount > Number(order.refundable)) {
		throw new OrderError(
			`At most ₹${(Number(order.refundable) / 100).toLocaleString('en-IN')} can be refunded on this order.`
		);
	}

	const client = getServiceClient();
	const provider = paymentProvider();
	let left = input.amount;
	const ids: string[] = [];

	const payable = order.payments
		.filter((p) => p.state === 'captured' && p.gatewayPaymentId)
		.map((p) => ({
			...p,
			available:
				Number(p.amount) -
				order.refunds
					.filter((r) => r.paymentId === p.id && r.state !== 'failed')
					.reduce((n, r) => n + Number(r.amount), 0)
		}))
		.filter((p) => p.available > 0)
		.reverse();

	for (const payment of payable) {
		if (left <= 0) break;
		const amount = Math.min(left, payment.available);
		// The refund is recorded BEFORE the gateway call, as 'initiated'. The
		// database refuses it if it would exceed the payment (0029, which also
		// serialises two refunds racing for the same money). Only then does
		// the gateway move money, and the row takes the gateway's answer.
		const { data, error } = await client
			.from('refunds')
			.insert({
				payment_id: payment.id,
				amount_paise: amount,
				reason: input.reason,
				state: 'initiated',
				note: input.note,
				created_by: input.actor
			})
			.select('id')
			.single();
		if (error || !data) {
			if (error?.code === 'P0001')
				throw new OrderError(
					'Someone else refunded this order a moment ago. Refresh to see what is left.'
				);
			throw new Error(`refund record failed: ${error?.message}`);
		}
		const refundId = (data as { id: string }).id;
		try {
			const result = await provider.refund({
				gatewayPaymentId: payment.gatewayPaymentId!,
				amount: paise(amount),
				reason: input.reason === 'return' || input.reason === 'goodwill' ? 'admin' : input.reason
			});
			await client
				.from('refunds')
				.update({ gateway_refund_id: result.gatewayRefundId, state: result.state })
				.eq('id', refundId);
		} catch (cause) {
			await client
				.from('refunds')
				.update({ state: 'failed', note: `${input.note ?? ''} — gateway refused`.trim() })
				.eq('id', refundId);
			throw new OrderError(
				`The payment gateway refused the refund: ${cause instanceof Error ? cause.message : cause}`
			);
		}
		ids.push((data as { id: string }).id);
		left -= amount;
	}
	if (left > 0)
		throw new OrderError(
			'Part of that refund could not be matched to a payment. Check the payments below.'
		);

	const fullyRefunded = Number(order.refunded) + input.amount >= Number(order.captured);
	if (fullyRefunded && ['paid', 'packed', 'cancelled'].includes(order.state)) {
		await client.from('orders').update({ state: 'refunded' }).eq('id', input.orderId);
	}
	for (const id of ids) await issueCreditNote(id, input.orderId, input.actor);

	await writeAudit(
		input.actor,
		`refunded ₹${(input.amount / 100).toLocaleString('en-IN')}`,
		'order',
		input.orderId,
		{
			reason: input.reason,
			note: input.note,
			refunds: ids
		}
	);
	if (input.notify) {
		await notifyOrder(input.orderId, 'refunded', {
			actor: input.actor,
			once: false,
			extra: { amount: `₹${(input.amount / 100).toLocaleString('en-IN')}` }
		});
	}
	return ids;
}

/**
 * Cancels an order that has not left. Puts its pieces back in stock and,
 * if asked, refunds everything captured.
 */
export async function cancelOrder(input: {
	orderId: string;
	reason: string;
	refundMoney: boolean;
	notify: boolean;
	actor: string;
}): Promise<void> {
	const order = await getOrder(input.orderId);
	if (!order) throw new OrderError('That order no longer exists.');
	if (!['pending_payment', 'paid', 'packed'].includes(order.state)) {
		throw new OrderError(
			'Only an order that has not been dispatched can be cancelled. Record a return instead.'
		);
	}
	if (order.isPreOrder) {
		throw new OrderError(
			'This order fulfils a pre-order. Cancel it from its reservation on the Pre-orders screen.'
		);
	}
	if (!input.reason.trim()) throw new OrderError('Say why it is being cancelled.');

	const client = getServiceClient();

	if (order.state === 'pending_payment') {
		// The existing expiry path: puts stock, the coupon use and the
		// idempotency key back, and skips an order a capture just paid.
		const { data, error } = await client.rpc('cancel_unpaid_orders', {
			p_order_ids: [input.orderId]
		});
		if (error) throw new Error(`cancel failed: ${error.message}`);
		if (!data)
			throw new OrderError(
				'It was paid a moment ago, so it was not cancelled. Refresh and look again.'
			);
		await client
			.from('orders')
			.update({ cancelled_at: new Date().toISOString(), cancel_reason: input.reason.trim() })
			.eq('id', input.orderId);
	} else {
		// Claimed by a conditional update: a second submit finds nothing to
		// claim, so the stock below goes back exactly once.
		const { data: claimed, error } = await client
			.from('orders')
			.update({
				state: 'cancelled',
				cancelled_at: new Date().toISOString(),
				cancel_reason: input.reason.trim()
			})
			.eq('id', input.orderId)
			.eq('state', order.state)
			.select('id');
		if (error) throw new Error(`cancel failed: ${error.message}`);
		if (!claimed?.length)
			throw new OrderError(
				'This order changed while you were looking at it. Refresh and try again.'
			);

		// The pieces never left, so they go back on sale.
		for (const line of order.lines) {
			await client.rpc('adjust_stock', {
				p_variant_id: line.variantId,
				p_delta: line.quantity,
				p_reason: 'cancelled',
				p_note: `Order ${order.number} cancelled`,
				p_actor: input.actor
			});
		}
	}
	await writeAudit(input.actor, 'cancelled', 'order', input.orderId, { reason: input.reason });

	if (input.refundMoney && Number(order.refundable) > 0) {
		await refund({
			orderId: input.orderId,
			amount: Number(order.refundable),
			reason: 'cancellation',
			note: input.reason,
			notify: input.notify,
			actor: input.actor
		});
	}
}

/* ------------------------------------------------------------------------ */
/* Returns                                                                   */
/* ------------------------------------------------------------------------ */

export const RETURN_REASONS = [
	{ value: 'defect', label: 'Defect' },
	{ value: 'damaged_in_transit', label: 'Damaged in transit' },
	{ value: 'wrong_item', label: 'Wrong item sent' },
	{ value: 'size_exchange', label: 'Size exchange' },
	{ value: 'other', label: 'Other' }
] as const;

export async function createReturn(input: {
	orderId: string;
	lines: ReturnLine[];
	reason: string;
	detail: string | null;
	outcome: OrderReturn['outcome'];
	exchangeVariantId: string | null;
	actor: string;
}): Promise<string> {
	const order = await getOrder(input.orderId);
	if (!order) throw new OrderError('That order no longer exists.');
	if (!['dispatched', 'delivered'].includes(order.state)) {
		throw new OrderError('Returns are for orders that have been dispatched. Cancel it instead.');
	}
	const lines = input.lines.filter((l) => l.quantity > 0);
	if (!lines.length) throw new OrderError('Pick at least one piece coming back.');
	// Pieces already on another open or completed return cannot come back twice.
	const alreadyBack = new Map<string, number>();
	for (const ret of order.returns.filter((r) => r.status !== 'rejected')) {
		for (const l of ret.lines)
			alreadyBack.set(l.orderLineId, (alreadyBack.get(l.orderLineId) ?? 0) + l.quantity);
	}
	for (const line of lines) {
		const original = order.lines.find((l) => l.id === line.orderLineId);
		if (!original) throw new OrderError('One of those pieces is not on this order.');
		const left = original.quantity - (alreadyBack.get(line.orderLineId) ?? 0);
		if (line.quantity > left) {
			throw new OrderError(
				left > 0
					? `Only ${left} of ${original.name} can still come back.`
					: `${original.name} is already on a return.`
			);
		}
	}
	if (!RETURN_REASONS.some((r) => r.value === input.reason))
		throw new OrderError('Pick why it is coming back.');
	if (input.outcome === 'exchange' && !input.exchangeVariantId)
		throw new OrderError('Pick the size or colour to send instead.');

	const { data, error } = await getServiceClient()
		.from('returns')
		.insert({
			order_id: input.orderId,
			lines: lines.map((l) => ({ order_line_id: l.orderLineId, quantity: l.quantity })),
			reason: input.reason,
			detail: input.detail,
			outcome: input.outcome,
			exchange_variant_id: input.outcome === 'exchange' ? input.exchangeVariantId : null,
			created_by: input.actor
		})
		.select('id')
		.single();
	if (error || !data) throw new Error(`return failed: ${error?.message}`);
	const id = (data as { id: string }).id;
	await writeAudit(input.actor, 'return opened', 'order', input.orderId, {
		returnId: id,
		reason: input.reason,
		outcome: input.outcome
	});
	return id;
}

/** The parcel is back. Restocks the pieces when they can be sold again. */
export async function receiveReturn(input: {
	returnId: string;
	restock: boolean;
	actor: string;
}): Promise<void> {
	const client = getServiceClient();
	const { data, error } = await client
		.from('returns')
		.select('*')
		.eq('id', input.returnId)
		.single();
	if (error || !data) throw new OrderError('That return no longer exists.');
	const ret = data as {
		order_id: string;
		status: string;
		lines: { order_line_id: string; quantity: number }[];
	};
	// Claimed first, so a double submit restocks once.
	const { data: claimed } = await client
		.from('returns')
		.update({ status: 'received', restocked: input.restock })
		.eq('id', input.returnId)
		.eq('status', 'requested')
		.select('id');
	if (!claimed?.length) throw new OrderError('This return has already been received.');

	if (input.restock) {
		const { data: lines } = await client
			.from('order_lines')
			.select('id, variant_id')
			.in(
				'id',
				ret.lines.map((l) => l.order_line_id)
			);
		const variantOf = new Map(
			((lines ?? []) as { id: string; variant_id: string }[]).map((l) => [l.id, l.variant_id])
		);
		for (const line of ret.lines) {
			const variant = variantOf.get(line.order_line_id);
			if (variant) {
				await client.rpc('adjust_stock', {
					p_variant_id: variant,
					p_delta: line.quantity,
					p_reason: 'returned',
					p_note: `Return on order`,
					p_actor: input.actor
				});
			}
		}
	}
	await writeAudit(
		input.actor,
		input.restock ? 'return received, restocked' : 'return received',
		'order',
		ret.order_id,
		{
			returnId: input.returnId
		}
	);
}

/**
 * Closes a return: refunds it, or sends the exchange out (taking that piece
 * from stock and recording its tracking), or simply closes it.
 */
export async function completeReturn(input: {
	returnId: string;
	refundAmount: number | null;
	courierName: string | null;
	trackingRef: string | null;
	notify: boolean;
	actor: string;
}): Promise<void> {
	const client = getServiceClient();
	const { data, error } = await client
		.from('returns')
		.select('*')
		.eq('id', input.returnId)
		.single();
	if (error || !data) throw new OrderError('That return no longer exists.');
	const ret = data as {
		order_id: string;
		status: string;
		outcome: OrderReturn['outcome'];
		exchange_variant_id: string | null;
		lines: { order_line_id: string; quantity: number }[];
	};
	if (ret.status === 'requested')
		throw new OrderError('Mark the parcel received before closing the return.');
	if (ret.status !== 'received') throw new OrderError('This return is already closed.');
	// Claimed before money or stock moves; put back if what follows fails.
	const { data: claimed } = await client
		.from('returns')
		.update({ status: 'completed' })
		.eq('id', input.returnId)
		.eq('status', 'received')
		.select('id');
	if (!claimed?.length) throw new OrderError('This return is already closed.');
	const release = () =>
		client.from('returns').update({ status: 'received' }).eq('id', input.returnId);

	const patch: Record<string, unknown> = {};
	try {
		if (ret.outcome === 'refund') {
			if (!input.refundAmount) throw new OrderError('Enter the amount to refund.');
			const [refundId] = await refund({
				orderId: ret.order_id,
				amount: input.refundAmount,
				reason: 'return',
				note: 'Return',
				notify: input.notify,
				actor: input.actor
			});
			patch.refund_id = refundId;
		} else if (ret.outcome === 'exchange') {
			if (!input.courierName?.trim() || !input.trackingRef?.trim()) {
				throw new OrderError('Enter the courier and tracking number for the replacement.');
			}
			const { error: stockError } = await client.rpc('adjust_stock', {
				p_variant_id: ret.exchange_variant_id,
				// One replacement per piece that came back.
				p_delta: -ret.lines.reduce((n, l) => n + l.quantity, 0),
				p_reason: 'correction',
				p_note: 'Sent as an exchange',
				p_actor: input.actor
			});
			if (stockError) throw new OrderError(stockError.message.replace(/^ERROR:\s*/, ''));
			patch.courier_name = input.courierName.trim();
			patch.tracking_ref = input.trackingRef.trim();
		}
	} catch (error) {
		await release();
		throw error;
	}
	if (Object.keys(patch).length)
		await client.from('returns').update(patch).eq('id', input.returnId);
	await writeAudit(input.actor, `return completed (${ret.outcome})`, 'order', ret.order_id, {
		returnId: input.returnId
	});
}

export async function rejectReturn(input: { returnId: string; actor: string }): Promise<void> {
	const { data } = await getServiceClient()
		.from('returns')
		.update({ status: 'rejected' })
		.eq('id', input.returnId)
		.in('status', ['requested', 'received'])
		.select('order_id')
		.maybeSingle();
	if (!data) throw new OrderError('Only an open return can be rejected.');
	if (data)
		await writeAudit(
			input.actor,
			'return rejected',
			'order',
			(data as { order_id: string }).order_id,
			{ returnId: input.returnId }
		);
}

/** Sizes and colours of the same product, for an exchange. */
export async function exchangeOptions(
	order: OrderDetail
): Promise<{ id: string; label: string; product: string; available: number }[]> {
	const productIds = [
		...new Set(order.lines.map((l) => l.productId).filter((p): p is string => p !== null))
	];
	if (!productIds.length) return [];
	const catalogue = getCatalogueClient();
	const [{ data: variants }, { data: colours }, { data: products }] = await Promise.all([
		catalogue
			.from('variants')
			.select('id, product_id, size, colourway_id, stock_count, reserved_count')
			.in('product_id', productIds),
		catalogue.from('colourways').select('id, name').in('product_id', productIds),
		catalogue.from('products').select('id, name').in('id', productIds)
	]);
	const colourName = new Map(
		((colours ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name])
	);
	const productName = new Map(
		((products ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name])
	);
	return (
		(variants ?? []) as {
			id: string;
			product_id: string;
			size: string;
			colourway_id: string | null;
			stock_count: number;
			reserved_count: number;
		}[]
	).map((v) => ({
		id: v.id,
		product: productName.get(v.product_id) ?? '',
		label: [v.colourway_id ? colourName.get(v.colourway_id) : null, v.size]
			.filter(Boolean)
			.join(' / '),
		available: Math.max(0, v.stock_count - v.reserved_count)
	}));
}

/** Called once payment is captured: the invoice and the confirmation. */
export async function onOrderPaid(orderId: string): Promise<void> {
	await issueInvoice(orderId).catch((error) => console.error('[orders] invoice failed', error));
	await attributeRecovery(orderId).catch((error) =>
		console.error('[orders] attribution failed', error)
	);
	await markWonByOrder(orderId).catch((error) => console.error('[orders] lead win failed', error));
	await notifyOrder(orderId, 'confirmed').catch((error) =>
		console.error('[orders] confirmation failed', error)
	);
}

/** The webhook knows the order by its public token. Both calls are idempotent. */
export async function onOrderPaidByToken(publicToken: string): Promise<void> {
	const { data } = await getServiceClient()
		.from('orders')
		.select('id')
		.eq('public_token', publicToken)
		.maybeSingle();
	if (data) await onOrderPaid((data as { id: string }).id);
}
