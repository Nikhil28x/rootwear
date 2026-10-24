/**
 * Customers: everyone who has placed an order, with what they have bought.
 *
 * A customer is created at checkout, matched on email (guest checkout stays
 * on), so this list is the order book read by person. Their name and phone
 * come from their most recent order, which is the freshest the shop has.
 */
import { getServiceClient } from '$lib/server/db/clients';
import { eq } from '$lib/server/db/filters';
import { writeAudit } from '$lib/server/admin/audit';
import { messagesFor, type OutboxMessage } from '$lib/server/messaging/outbox';
import { describeTouch, type Attribution } from '$lib/server/attribution/touch';
import { paise, type Paise } from '$lib/money';

export class CustomerError extends Error {}

const PAID = ['paid', 'packed', 'dispatched', 'delivered'];

type CustomerRow = {
	id: string;
	email: string;
	phone: string | null;
	user_id: string | null;
	marketing_email: boolean;
	marketing_whatsapp: boolean;
	tags: string[] | null;
	created_at: string;
};

type OrderRow = {
	id: string;
	order_number: string;
	customer_id: string;
	state: string;
	total_paise: number;
	ship_name: string;
	ship_phone: string | null;
	ship_city: string;
	ship_state: string;
	created_at: string;
	attribution: Attribution | null;
};

export type CustomerSummary = {
	readonly id: string;
	readonly email: string;
	readonly name: string | null;
	readonly phone: string | null;
	readonly city: string | null;
	readonly orders: number;
	readonly spent: Paise;
	readonly firstOrderAt: number | null;
	readonly lastOrderAt: number | null;
	readonly hasAccount: boolean;
	readonly tags: readonly string[];
	readonly marketingEmail: boolean;
	readonly marketingWhatsapp: boolean;
	readonly createdAt: number;
};

function summarise(customer: CustomerRow, orders: OrderRow[]): CustomerSummary {
	const mine = orders
		.filter((o) => o.customer_id === customer.id)
		.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
	const paid = mine.filter((o) => PAID.includes(o.state));
	const latest = mine[0];
	return {
		id: customer.id,
		email: customer.email,
		name: latest?.ship_name ?? null,
		phone: latest?.ship_phone ?? customer.phone,
		city: latest ? `${latest.ship_city}, ${latest.ship_state}` : null,
		orders: paid.length,
		spent: paise(paid.reduce((n, o) => n + Number(o.total_paise), 0)),
		firstOrderAt: paid.length ? Date.parse(paid[paid.length - 1].created_at) : null,
		lastOrderAt: paid.length ? Date.parse(paid[0].created_at) : null,
		hasAccount: customer.user_id !== null,
		tags: customer.tags ?? [],
		marketingEmail: customer.marketing_email,
		marketingWhatsapp: customer.marketing_whatsapp,
		createdAt: Date.parse(customer.created_at)
	};
}

export type CustomerFilter = {
	readonly search?: string;
	readonly segment?: 'buyers' | 'repeat' | 'lapsed' | 'never';
	readonly tag?: string;
	readonly sort?: 'recent' | 'spent' | 'orders';
};

export const CUSTOMER_PAGE_SIZE = 50;

/**
 * The list, filtered and sorted in memory: at a few thousand customers this
 * is two queries; a materialised view can replace it when that stops being
 * true.
 */
export async function listCustomers(
	filter: CustomerFilter,
	page: number,
	now: number,
	options: { all?: boolean } = {}
) {
	const client = getServiceClient();
	let query = client.from('customers').select('*').limit(5000);
	if (filter.tag) query = query.contains('tags', [filter.tag]);
	const { data, error } = await query;
	if (error) throw new Error(`customers read failed: ${error.message}`);
	const customers = (data ?? []) as CustomerRow[];

	const { data: orderData } = await client
		.from('orders')
		.select(
			'id, order_number, customer_id, state, total_paise, ship_name, ship_phone, ship_city, ship_state, created_at, attribution'
		)
		.neq('state', 'pending_payment')
		.limit(20000);
	const orders = (orderData ?? []) as OrderRow[];

	let rows = customers.map((c) => summarise(c, orders));
	const term = filter.search?.trim().toLowerCase();
	if (term) {
		const digits = term.replace(/\D/g, '');
		rows = rows.filter(
			(r) =>
				r.email.includes(term) ||
				r.name?.toLowerCase().includes(term) ||
				(digits.length >= 4 && r.phone?.replace(/\D/g, '').includes(digits)) ||
				r.city?.toLowerCase().includes(term)
		);
	}
	const LAPSED = 120 * 86_400_000;
	if (filter.segment === 'buyers') rows = rows.filter((r) => r.orders > 0);
	if (filter.segment === 'repeat') rows = rows.filter((r) => r.orders > 1);
	if (filter.segment === 'lapsed')
		rows = rows.filter((r) => r.lastOrderAt !== null && now - r.lastOrderAt > LAPSED);
	if (filter.segment === 'never') rows = rows.filter((r) => r.orders === 0);

	rows.sort((a, b) =>
		filter.sort === 'spent'
			? Number(b.spent) - Number(a.spent)
			: filter.sort === 'orders'
				? b.orders - a.orders
				: (b.lastOrderAt ?? b.createdAt) - (a.lastOrderAt ?? a.createdAt)
	);

	const buyers = rows.filter((r) => r.orders > 0);
	const start = Math.max(0, page - 1) * CUSTOMER_PAGE_SIZE;
	return {
		customers: options.all ? rows : rows.slice(start, start + CUSTOMER_PAGE_SIZE),
		total: rows.length,
		stats: {
			buyers: buyers.length,
			repeat: buyers.filter((r) => r.orders > 1).length,
			averageOrder: paise(
				buyers.length
					? Math.round(
							buyers.reduce((n, r) => n + Number(r.spent), 0) /
								buyers.reduce((n, r) => n + r.orders, 0)
						)
					: 0
			),
			lifetime: paise(
				buyers.length
					? Math.round(buyers.reduce((n, r) => n + Number(r.spent), 0) / buyers.length)
					: 0
			)
		},
		tags: [...new Set(customers.flatMap((c) => c.tags ?? []))].sort()
	};
}

export type CustomerDetail = CustomerSummary & {
	readonly orders_: readonly {
		id: string;
		number: string;
		state: string;
		total: Paise;
		at: number;
		campaign: string;
	}[];
	readonly sizes: readonly { label: string; count: number }[];
	readonly notes: readonly { id: string; body: string; author: string; at: number }[];
	readonly leads: readonly { id: string; stage: string; source: string; at: number }[];
	readonly messages: readonly OutboxMessage[];
	readonly addresses: readonly { line: string }[];
	readonly campaign: string;
};

export async function getCustomer(id: string): Promise<CustomerDetail | null> {
	const client = getServiceClient();
	const { data } = await client.from('customers').select('*').eq('id', id).maybeSingle();
	if (!data) return null;
	const customer = data as CustomerRow;

	const [{ data: orderData }, { data: notes }, { data: leads }] = await Promise.all([
		client
			.from('orders')
			.select(
				'id, order_number, customer_id, state, total_paise, ship_name, ship_phone, ship_city, ship_state, created_at, attribution, ship_line1, ship_pincode'
			)
			.eq('customer_id', id)
			.neq('state', 'pending_payment')
			.order('created_at', { ascending: false }),
		client
			.from('customer_notes')
			.select('*')
			.eq('customer_id', id)
			.order('created_at', { ascending: false }),
		client
			.from('leads')
			.select('id, stage, source, created_at')
			.or(`${eq('customer_id', id)},${eq('email', customer.email)}`)
			.order('created_at', { ascending: false })
	]);
	const orders = (orderData ?? []) as (OrderRow & { ship_line1: string; ship_pincode: string })[];
	const paidIds = orders.filter((o) => PAID.includes(o.state)).map((o) => o.id);

	const { data: lines } = paidIds.length
		? await client
				.from('order_lines')
				.select('variant_snapshot, name_snapshot, quantity')
				.in('order_id', paidIds)
		: { data: [] };
	const sizeCount = new Map<string, number>();
	for (const line of (lines ?? []) as {
		variant_snapshot: string | null;
		name_snapshot: string;
		quantity: number;
	}[]) {
		const key = line.variant_snapshot ?? line.name_snapshot;
		sizeCount.set(key, (sizeCount.get(key) ?? 0) + line.quantity);
	}

	const messageLists = await Promise.all([
		messagesFor('customer', id),
		...orders.slice(0, 10).map((o) => messagesFor('order', o.id))
	]);
	const firstTouch = [...orders].reverse().find((o) => o.attribution?.first)?.attribution?.first;

	return {
		...summarise(customer, orders),
		orders_: orders.map((o) => ({
			id: o.id,
			number: o.order_number,
			state: o.state,
			total: paise(Number(o.total_paise)),
			at: Date.parse(o.created_at),
			campaign: describeTouch(o.attribution?.first ?? o.attribution?.last)
		})),
		sizes: [...sizeCount.entries()]
			.map(([label, count]) => ({ label, count }))
			.sort((a, b) => b.count - a.count),
		notes: (
			(notes ?? []) as { id: string; body: string; author: string; created_at: string }[]
		).map((n) => ({
			id: n.id,
			body: n.body,
			author: n.author,
			at: Date.parse(n.created_at)
		})),
		leads: (
			(leads ?? []) as { id: string; stage: string; source: string; created_at: string }[]
		).map((l) => ({
			id: l.id,
			stage: l.stage,
			source: l.source,
			at: Date.parse(l.created_at)
		})),
		messages: messageLists
			.flat()
			.sort((a, b) => b.createdAt - a.createdAt)
			.slice(0, 30),
		addresses: [
			...new Set(
				orders.map((o) => `${o.ship_line1}, ${o.ship_city} ${o.ship_pincode}, ${o.ship_state}`)
			)
		].map((line) => ({ line })),
		campaign: describeTouch(firstTouch)
	};
}

function normalisePhone(raw: string | null): string | null {
	const digits = (raw ?? '').replace(/\D/g, '');
	if (!digits) return null;
	const local =
		digits.length === 12 && digits.startsWith('91')
			? digits.slice(2)
			: digits.length === 11 && digits.startsWith('0')
				? digits.slice(1)
				: digits;
	if (!/^[6-9]\d{9}$/.test(local))
		throw new CustomerError('Enter a 10-digit Indian mobile number, like 98765 43210.');
	return local;
}

export async function updateCustomer(input: {
	id: string;
	phone: string | null;
	marketingEmail: boolean;
	marketingWhatsapp: boolean;
	tags: string[];
	actor: string;
}): Promise<void> {
	const tags = [...new Set(input.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(
		0,
		20
	);
	const { error } = await getServiceClient()
		.from('customers')
		.update({
			// Stored as checkout stores it: ten digits for an Indian mobile.
			phone: normalisePhone(input.phone),
			marketing_email: input.marketingEmail,
			marketing_whatsapp: input.marketingWhatsapp,
			tags
		})
		.eq('id', input.id);
	if (error) throw new Error(`customer update failed: ${error.message}`);
	await writeAudit(input.actor, 'customer edited', 'customer', input.id, {
		marketingEmail: input.marketingEmail,
		marketingWhatsapp: input.marketingWhatsapp,
		tags
	});
}

export async function addCustomerNote(input: {
	id: string;
	body: string;
	actor: string;
}): Promise<void> {
	if (!input.body.trim()) throw new CustomerError('Write the note first.');
	const { error } = await getServiceClient()
		.from('customer_notes')
		.insert({ customer_id: input.id, body: input.body.trim(), author: input.actor });
	if (error) throw new Error(`note failed: ${error.message}`);
}
