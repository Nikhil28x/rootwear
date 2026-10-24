/**
 * Carts and checkouts, for admin.
 *
 *   Live carts       — carts holding pieces right now. Usually anonymous:
 *                      a cart learns who it belongs to only at checkout or
 *                      when the shopper is signed in.
 *   In checkout      — the shopper gave their details and has an unpaid
 *                      order, still inside the payment window.
 *   Abandoned        — that unpaid order expired. This is the one we can
 *                      follow up: it has a name, an email and usually a phone.
 *
 * A reminder links to /cart/recover/<order token>, which puts the same
 * pieces back in the visitor's cart (if they are still available).
 */
import { getCatalogueClient, getServiceClient } from '$lib/server/db/clients';
import { writeAudit } from '$lib/server/admin/audit';
import { enqueue } from '$lib/server/messaging/outbox';
import { siteUrl } from '$lib/server/messaging/config';
import { getSetting } from '$lib/server/settings';
import { formatInr, paise, type Paise } from '$lib/money';

export class CartError extends Error {}

type VariantInfo = {
	name: string;
	label: string;
	image: string | null;
	price: number;
	dropName: string;
};

async function variantInfo(ids: string[]): Promise<Map<string, VariantInfo>> {
	if (!ids.length) return new Map();
	const catalogue = getCatalogueClient();
	const { data: variants } = await catalogue
		.from('variants')
		.select('id, product_id, size, colourway_id')
		.in('id', ids);
	const vs = (variants ?? []) as {
		id: string;
		product_id: string;
		size: string;
		colourway_id: string | null;
	}[];
	const productIds = [...new Set(vs.map((v) => v.product_id))];
	const [{ data: products }, { data: images }, { data: colours }] = await Promise.all([
		catalogue.from('products').select('id, name, drop_id, launch_price_paise').in('id', productIds),
		catalogue
			.from('product_images')
			.select('product_id, url, position')
			.in('product_id', productIds)
			.order('position'),
		catalogue.from('colourways').select('id, name').in('product_id', productIds)
	]);
	const ps = (products ?? []) as {
		id: string;
		name: string;
		drop_id: string;
		launch_price_paise: number;
	}[];
	const { data: drops } = await catalogue
		.from('drops')
		.select('id, name')
		.in('id', [...new Set(ps.map((p) => p.drop_id))]);
	const dropName = new Map(
		((drops ?? []) as { id: string; name: string }[]).map((d) => [d.id, d.name])
	);
	const product = new Map(ps.map((p) => [p.id, p]));
	const colour = new Map(
		((colours ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name])
	);
	const image = new Map<string, string>();
	for (const i of (images ?? []) as { product_id: string; url: string }[])
		if (!image.has(i.product_id)) image.set(i.product_id, i.url);
	return new Map(
		vs.map((v) => {
			const p = product.get(v.product_id);
			return [
				v.id,
				{
					name: p?.name ?? 'Item',
					label: [v.colourway_id ? colour.get(v.colourway_id) : null, v.size]
						.filter(Boolean)
						.join(' / '),
					image: image.get(v.product_id) ?? null,
					price: Number(p?.launch_price_paise ?? 0),
					dropName: dropName.get(p?.drop_id ?? '') ?? ''
				}
			];
		})
	);
}

/* ------------------------------------------------------------------------ */
/* Live carts                                                                */
/* ------------------------------------------------------------------------ */

export type CartItem = {
	readonly name: string;
	readonly label: string;
	readonly quantity: number;
	readonly image: string | null;
};

export type LiveCart = {
	readonly id: string;
	readonly email: string | null;
	readonly items: readonly CartItem[];
	readonly pieces: number;
	readonly value: Paise;
	readonly heldUntil: number | null;
	readonly updatedAt: number;
	readonly createdAt: number;
};

/** Carts with pieces in them, touched in the last `hours`. Holds may have lapsed. */
export async function liveCarts(now: number, hours = 48): Promise<LiveCart[]> {
	const client = getServiceClient();
	const since = new Date(now - hours * 3_600_000).toISOString();
	const { data: lines, error } = await client
		.from('cart_lines')
		.select('cart_id, variant_id, quantity, held_until, created_at')
		.gte('created_at', since)
		.order('created_at', { ascending: false })
		.limit(1000);
	if (error) throw new Error(`cart lines read failed: ${error.message}`);
	const rows = (lines ?? []) as {
		cart_id: string;
		variant_id: string;
		quantity: number;
		held_until: string;
		created_at: string;
	}[];
	if (!rows.length) return [];

	const cartIds = [...new Set(rows.map((r) => r.cart_id))];
	const [{ data: carts }, info] = await Promise.all([
		client.from('carts').select('id, customer_id, created_at, updated_at').in('id', cartIds),
		variantInfo([...new Set(rows.map((r) => r.variant_id))])
	]);
	const cartRows = (carts ?? []) as {
		id: string;
		customer_id: string | null;
		created_at: string;
		updated_at: string;
	}[];
	const customerIds = cartRows.map((c) => c.customer_id).filter((c): c is string => c !== null);
	const { data: customers } = customerIds.length
		? await client.from('customers').select('id, email').in('id', customerIds)
		: { data: [] };
	const email = new Map(
		((customers ?? []) as { id: string; email: string }[]).map((c) => [c.id, c.email])
	);

	return cartRows
		.map((cart) => {
			const mine = rows.filter((r) => r.cart_id === cart.id);
			const holds = mine.map((r) => Date.parse(r.held_until)).filter((t) => t > now);
			return {
				id: cart.id,
				email: cart.customer_id ? (email.get(cart.customer_id) ?? null) : null,
				items: mine.map((r) => {
					const v = info.get(r.variant_id);
					return {
						name: v?.name ?? 'Item',
						label: v?.label ?? '',
						quantity: r.quantity,
						image: v?.image ?? null
					};
				}),
				pieces: mine.reduce((n, r) => n + r.quantity, 0),
				value: paise(
					mine.reduce((n, r) => n + (info.get(r.variant_id)?.price ?? 0) * r.quantity, 0)
				),
				heldUntil: holds.length ? Math.max(...holds) : null,
				updatedAt: Math.max(
					...mine.map((r) => Date.parse(r.created_at)),
					Date.parse(cart.updated_at)
				),
				createdAt: Date.parse(cart.created_at)
			};
		})
		.sort((a, b) => b.updatedAt - a.updatedAt);
}

/* ------------------------------------------------------------------------ */
/* Checkouts                                                                 */
/* ------------------------------------------------------------------------ */

export type CheckoutStatus =
	'in_checkout' | 'abandoned' | 'reminded' | 'clicked' | 'recovered' | 'bought_later' | 'dismissed';

export type Checkout = {
	readonly orderId: string;
	readonly number: string;
	readonly token: string;
	readonly name: string;
	readonly email: string;
	readonly phone: string | null;
	readonly city: string;
	readonly items: readonly CartItem[];
	readonly dropName: string;
	readonly total: Paise;
	readonly createdAt: number;
	readonly status: CheckoutStatus;
	readonly sentAt: number | null;
	readonly sentBy: string | null;
	readonly channels: readonly string[];
	readonly clickedAt: number | null;
	readonly laterOrderId: string | null;
};

type OrderRow = {
	id: string;
	order_number: string;
	public_token: string;
	customer_id: string;
	state: string;
	ship_name: string;
	ship_phone: string | null;
	ship_city: string;
	total_paise: number;
	created_at: string;
	cancelled_at: string | null;
};

/**
 * Unpaid checkouts from the last `days`, newest first. An order cancelled by
 * staff (cancelled_at set) is not an abandoned checkout and is left out.
 */
export async function checkouts(now: number, days = 30): Promise<Checkout[]> {
	const client = getServiceClient();
	const since = new Date(now - days * 86_400_000).toISOString();
	const { data, error } = await client
		.from('orders')
		.select(
			'id, order_number, public_token, customer_id, state, ship_name, ship_phone, ship_city, total_paise, created_at, cancelled_at'
		)
		.in('state', ['pending_payment', 'cancelled'])
		.is('cancelled_at', null)
		.gte('created_at', since)
		.order('created_at', { ascending: false })
		.limit(500);
	if (error) throw new Error(`checkouts read failed: ${error.message}`);
	const orders = (data ?? []) as OrderRow[];
	if (!orders.length) return [];

	const ids = orders.map((o) => o.id);
	const customerIds = [...new Set(orders.map((o) => o.customer_id))];
	const [lines, customers, recovery, laterPaid, captured] = await Promise.all([
		client.from('order_lines').select('order_id, variant_id, quantity').in('order_id', ids),
		client.from('customers').select('id, email, phone').in('id', customerIds),
		client.from('checkout_recovery').select('*').in('order_id', ids),
		client
			.from('orders')
			.select('id, customer_id, created_at')
			.in('customer_id', customerIds)
			.in('state', ['paid', 'packed', 'dispatched', 'delivered']),
		client.from('payments').select('order_id').in('order_id', ids).eq('state', 'captured')
	]);
	const lineRows = (lines.data ?? []) as {
		order_id: string;
		variant_id: string;
		quantity: number;
	}[];
	const info = await variantInfo([...new Set(lineRows.map((l) => l.variant_id))]);
	const customer = new Map(
		((customers.data ?? []) as { id: string; email: string; phone: string | null }[]).map((c) => [
			c.id,
			c
		])
	);
	const rec = new Map(
		(
			(recovery.data ?? []) as {
				order_id: string;
				sent_at: string | null;
				sent_by: string | null;
				channels: string[];
				clicked_at: string | null;
				recovered_order_id: string | null;
				dismissed_at: string | null;
			}[]
		).map((r) => [r.order_id, r])
	);
	const paidLater = (laterPaid.data ?? []) as {
		id: string;
		customer_id: string;
		created_at: string;
	}[];
	const wasPaid = new Set(((captured.data ?? []) as { order_id: string }[]).map((p) => p.order_id));
	const windowOpen = (o: OrderRow) => o.state === 'pending_payment';

	return orders
		.filter((o) => !wasPaid.has(o.id))
		.map((o) => {
			const r = rec.get(o.id);
			const later = paidLater.find(
				(p) =>
					p.customer_id === o.customer_id && Date.parse(p.created_at) > Date.parse(o.created_at)
			);
			const items = lineRows
				.filter((l) => l.order_id === o.id)
				.map((l) => {
					const v = info.get(l.variant_id);
					return {
						name: v?.name ?? 'Item',
						label: v?.label ?? '',
						quantity: l.quantity,
						image: v?.image ?? null
					};
				});
			const firstVariant = lineRows.find((l) => l.order_id === o.id)?.variant_id;
			let status: CheckoutStatus = windowOpen(o) ? 'in_checkout' : 'abandoned';
			if (r?.dismissed_at) status = 'dismissed';
			else if (later)
				status =
					r?.sent_at && Date.parse(later.created_at) > Date.parse(r.sent_at)
						? 'recovered'
						: 'bought_later';
			else if (r?.clicked_at) status = 'clicked';
			else if (r?.sent_at) status = 'reminded';
			return {
				orderId: o.id,
				number: o.order_number,
				token: o.public_token,
				name: o.ship_name,
				email: customer.get(o.customer_id)?.email ?? '',
				phone: o.ship_phone || customer.get(o.customer_id)?.phone || null,
				city: o.ship_city,
				items,
				dropName: firstVariant ? (info.get(firstVariant)?.dropName ?? '') : '',
				total: paise(Number(o.total_paise)),
				createdAt: Date.parse(o.created_at),
				status,
				sentAt: r?.sent_at ? Date.parse(r.sent_at) : null,
				sentBy: r?.sent_by ?? null,
				channels: r?.channels ?? [],
				clickedAt: r?.clicked_at ? Date.parse(r.clicked_at) : null,
				laterOrderId: later?.id ?? null
			};
		});
}

/* ------------------------------------------------------------------------ */
/* Funnel                                                                    */
/* ------------------------------------------------------------------------ */

export type Funnel = {
	readonly carts: number;
	readonly checkouts: number;
	readonly paid: number;
	readonly recovered: number;
	readonly recoveredValue: Paise;
};

export async function funnel(now: number, days: number): Promise<Funnel> {
	const client = getServiceClient();
	const since = new Date(now - days * 86_400_000).toISOString();
	const [carts, orders, paidRows, recovered] = await Promise.all([
		client.from('carts').select('id', { count: 'exact', head: true }).gte('created_at', since),
		client.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', since),
		client
			.from('orders')
			.select('id', { count: 'exact', head: true })
			.gte('created_at', since)
			.in('state', ['paid', 'packed', 'dispatched', 'delivered', 'refunded']),
		client
			.from('checkout_recovery')
			.select('recovered_order_id')
			.gte('sent_at', since)
			.not('recovered_order_id', 'is', null)
	]);
	const recoveredIds = ((recovered.data ?? []) as { recovered_order_id: string }[]).map(
		(r) => r.recovered_order_id
	);
	const { data: recoveredOrders } = recoveredIds.length
		? await client.from('orders').select('total_paise').in('id', recoveredIds)
		: { data: [] };
	return {
		carts: carts.count ?? 0,
		checkouts: orders.count ?? 0,
		paid: paidRows.count ?? 0,
		recovered: recoveredIds.length,
		recoveredValue: paise(
			((recoveredOrders ?? []) as { total_paise: number }[]).reduce(
				(n, o) => n + Number(o.total_paise),
				0
			)
		)
	};
}

/* ------------------------------------------------------------------------ */
/* Reminders                                                                 */
/* ------------------------------------------------------------------------ */

/**
 * Sends the reminder for an abandoned checkout by email and/or WhatsApp.
 * At most one reminder per checkout per day, however many times it is asked.
 */
export async function sendReminder(input: {
	orderId: string;
	channels: readonly ('email' | 'whatsapp')[];
	actor: string;
	now: number;
}): Promise<{ sent: string[]; skipped: string[] }> {
	const client = getServiceClient();
	const list = await checkouts(input.now, 60);
	const checkout = list.find((c) => c.orderId === input.orderId);
	if (!checkout) throw new CartError('That checkout is not waiting for a reminder.');
	if (['recovered', 'bought_later'].includes(checkout.status))
		throw new CartError('They have bought since. No reminder needed.');
	if (checkout.sentAt && input.now - checkout.sentAt < 86_400_000) {
		throw new CartError(
			`A reminder went ${Math.round((input.now - checkout.sentAt) / 3_600_000)} h ago. Give it a day.`
		);
	}
	if (!input.channels.length) throw new CartError('Pick email, WhatsApp or both.');

	const items = checkout.items.map((i) => `${i.name}${i.label ? ` (${i.label})` : ''}`).join(', ');
	const variables = {
		name: checkout.name.split(' ')[0] || checkout.name,
		items,
		drop_name: checkout.dropName || 'your drop',
		cart_url: `${siteUrl()}/cart/recover/${checkout.token}`,
		total: formatInr(checkout.total)
	};

	const sent: string[] = [];
	const skipped: string[] = [];
	for (const channel of input.channels) {
		const to = channel === 'email' ? checkout.email : checkout.phone;
		if (!to) {
			skipped.push(`${channel}: no ${channel === 'email' ? 'address' : 'number'}`);
			continue;
		}
		const message = await enqueue({
			template: channel === 'email' ? 'cart_recovery_email' : 'cart_recovery_whatsapp',
			to,
			toName: checkout.name,
			variables,
			context: { type: 'checkout', id: checkout.orderId },
			createdBy: input.actor
		});
		if (['sent', 'queued'].includes(message.status)) sent.push(channel);
		else skipped.push(`${channel}: ${message.lastError ?? message.status}`);
	}

	// Only a reminder that actually went (or is queued to go) counts as sent;
	// otherwise the day's wait would block a retry once email is connected.
	if (!sent.length) return { sent, skipped };
	await client.from('checkout_recovery').upsert(
		{
			order_id: checkout.orderId,
			sent_at: new Date(input.now).toISOString(),
			sent_by: input.actor,
			channels: input.channels,
			dismissed_at: null
		},
		{ onConflict: 'order_id' }
	);
	await writeAudit(input.actor, 'cart reminder sent', 'order', checkout.orderId, {
		channels: input.channels,
		sent,
		skipped
	});
	return { sent, skipped };
}

export async function dismiss(orderId: string, actor: string): Promise<void> {
	await getServiceClient()
		.from('checkout_recovery')
		.upsert(
			{ order_id: orderId, dismissed_at: new Date().toISOString() },
			{ onConflict: 'order_id' }
		);
	await writeAudit(actor, 'checkout dismissed', 'order', orderId);
}

/** The automatic pass, run by the cron when switched on in settings. */
export async function autoRemind(now: number): Promise<number> {
	const settings = await getSetting('carts');
	if (!settings.autoRecover) return 0;
	const due = (await checkouts(now, 3)).filter(
		(c) => c.status === 'abandoned' && now - c.createdAt >= settings.delayMinutes * 60_000
	);
	let count = 0;
	for (const checkout of due) {
		try {
			await sendReminder({
				orderId: checkout.orderId,
				channels: settings.channels,
				actor: 'automatic',
				now
			});
			count++;
		} catch (error) {
			if (!(error instanceof CartError)) console.error('[carts] reminder failed', error);
		}
	}
	return count;
}

/** The link in a reminder was opened. */
export async function recordClick(orderId: string): Promise<void> {
	await getServiceClient()
		.from('checkout_recovery')
		.update({ clicked_at: new Date().toISOString() })
		.eq('order_id', orderId)
		.is('clicked_at', null);
}

/**
 * Links a paid order back to the reminder that brought it, so the funnel
 * can count recovered revenue. The most recent reminder to the same
 * customer in the last 14 days gets the credit.
 */
export async function attributeRecovery(paidOrderId: string): Promise<void> {
	const client = getServiceClient();
	const { data: order } = await client
		.from('orders')
		.select('customer_id, created_at')
		.eq('id', paidOrderId)
		.maybeSingle();
	if (!order) return;
	const { customer_id: customerId, created_at: createdAt } = order as {
		customer_id: string;
		created_at: string;
	};
	const { data: earlier } = await client
		.from('orders')
		.select('id')
		.eq('customer_id', customerId)
		.lt('created_at', createdAt)
		.gte('created_at', new Date(Date.parse(createdAt) - 14 * 86_400_000).toISOString());
	const ids = ((earlier ?? []) as { id: string }[]).map((o) => o.id);
	if (!ids.length) return;
	await client
		.from('checkout_recovery')
		.update({ recovered_order_id: paidOrderId })
		.in('order_id', ids)
		.not('sent_at', 'is', null)
		.is('recovered_order_id', null);
}
