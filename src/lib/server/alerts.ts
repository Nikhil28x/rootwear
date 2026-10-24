/**
 * What needs attention today, in one place: the Overview's to-do list and
 * the daily digest email both read this.
 */
import { getCatalogueClient, getServiceClient } from '$lib/server/db/clients';
import { getSetting } from '$lib/server/settings';
import { checkouts } from '$lib/server/carts/admin';
import { enqueue } from '$lib/server/messaging/outbox';
import { siteUrl } from '$lib/server/messaging/config';
import { formatInr, paise, type Paise } from '$lib/money';

export type Attention = {
	readonly key: string;
	readonly count: number;
	readonly title: string;
	readonly detail: string;
	readonly href: string;
	readonly tone: 'danger' | 'warning' | 'info';
};

export type LowStock = { readonly sku: string; readonly product: string; readonly size: string; readonly left: number; readonly href: string };

export type Today = {
	readonly attention: readonly Attention[];
	readonly lowStock: readonly LowStock[];
	readonly yesterday: { orders: number; revenue: Paise };
	readonly last7: { orders: number; revenue: Paise };
	readonly daily: readonly { day: string; revenue: number; orders: number }[];
};

const DAY = 86_400_000;
const PAID = ['paid', 'packed', 'dispatched', 'delivered'];

function istDay(ms: number): string {
	return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(ms);
}

export async function today(now: number): Promise<Today> {
	const client = getServiceClient();
	const catalogue = getCatalogueClient();
	const settings = await getSetting('alerts');
	const head = (table: string) => client.from(table).select('id', { count: 'exact', head: true });

	const [toPack, stuck, overdue, leadsDue, returns, failed, recentOrders, abandoned] = await Promise.all([
		head('orders').eq('state', 'paid'),
		head('orders').eq('state', 'packed').lte('packed_at', new Date(now - DAY).toISOString()),
		head('reservations').eq('state', 'balance_due').lte('balance_due_by', new Date(now).toISOString()),
		head('leads').lte('next_follow_up_at', new Date(now).toISOString()).not('stage', 'in', '(won,lost)'),
		head('returns').in('status', ['requested', 'received']),
		head('message_outbox').eq('status', 'failed').gte('created_at', new Date(now - DAY).toISOString()),
		client.from('orders').select('total_paise, created_at, state').gte('created_at', new Date(now - 14 * DAY).toISOString()).in('state', PAID),
		checkouts(now, 2).catch(() => [])
	]);

	// Low stock: published drops that are on sale or about to be.
	const { data: drops } = await catalogue.from('drops').select('id, slug').not('published_at', 'is', null).in('state', ['TEASE', 'REVEALED', 'LIVE', 'PARTIAL', 'RE_DROP']);
	const dropIds = ((drops ?? []) as { id: string; slug: string }[]).map((d) => d.id);
	const slugOf = new Map(((drops ?? []) as { id: string; slug: string }[]).map((d) => [d.id, d.slug]));
	const lowStock: LowStock[] = [];
	if (dropIds.length) {
		const { data: products } = await catalogue.from('products').select('id, name, drop_id').in('drop_id', dropIds).eq('status', 'active');
		const ps = (products ?? []) as { id: string; name: string; drop_id: string }[];
		if (ps.length) {
			const { data: variants } = await catalogue.from('variants').select('sku, size, product_id, stock_count, reserved_count').in('product_id', ps.map((p) => p.id));
			for (const v of (variants ?? []) as { sku: string; size: string; product_id: string; stock_count: number; reserved_count: number }[]) {
				const left = v.stock_count - v.reserved_count;
				if (left <= settings.lowStock) {
					const p = ps.find((x) => x.id === v.product_id)!;
					lowStock.push({ sku: v.sku, product: p.name, size: v.size, left, href: `/admin/drops/${slugOf.get(p.drop_id)}/products/${p.id}/stock` });
				}
			}
			lowStock.sort((a, b) => a.left - b.left);
		}
	}

	const orders = (recentOrders.data ?? []) as { total_paise: number; created_at: string }[];
	const yesterdayKey = istDay(now - DAY);
	const sum = (list: typeof orders) => paise(list.reduce((n, o) => n + Number(o.total_paise), 0));
	const days = [...Array(14)].map((_, i) => istDay(now - (13 - i) * DAY));
	const daily = days.map((day) => {
		const mine = orders.filter((o) => istDay(Date.parse(o.created_at)) === day);
		return { day, revenue: mine.reduce((n, o) => n + Number(o.total_paise), 0), orders: mine.length };
	});
	const waiting = (abandoned as { status: string }[]).filter((c) => c.status === 'abandoned').length;

	const items: Attention[] = [
		{ key: 'pack', count: toPack.count ?? 0, title: 'Orders to pack', detail: 'Paid and waiting.', href: '/admin/orders', tone: 'warning' },
		{ key: 'stuck', count: stuck.count ?? 0, title: 'Packed over a day ago', detail: 'Not dispatched yet.', href: '/admin/orders?view=packed', tone: 'danger' },
		{ key: 'returns', count: returns.count ?? 0, title: 'Open returns', detail: 'Expected back or waiting to be closed.', href: '/admin/orders?view=returns', tone: 'warning' },
		{ key: 'balances', count: overdue.count ?? 0, title: 'Overdue pre-order balances', detail: 'Past their due date.', href: '/admin/reservations?state=balance_due', tone: 'danger' },
		{ key: 'leads', count: leadsDue.count ?? 0, title: 'Leads to follow up', detail: 'Their follow-up date has come.', href: '/admin/leads?view=due', tone: 'info' },
		{ key: 'checkouts', count: waiting, title: 'Abandoned checkouts', detail: 'Not reminded yet.', href: '/admin/carts', tone: 'info' },
		{ key: 'lowstock', count: lowStock.length, title: 'Sizes running low', detail: `${settings.lowStock} or fewer left to sell.`, href: '#low-stock', tone: 'warning' },
		{ key: 'failed', count: failed.count ?? 0, title: 'Messages that failed', detail: 'In the last 24 hours.', href: '/admin/messages?status=problem', tone: 'danger' }
	];

	return {
		attention: items.filter((i) => i.count > 0),
		lowStock,
		yesterday: { orders: orders.filter((o) => istDay(Date.parse(o.created_at)) === yesterdayKey).length, revenue: sum(orders.filter((o) => istDay(Date.parse(o.created_at)) === yesterdayKey)) },
		last7: { orders: orders.filter((o) => Date.parse(o.created_at) >= now - 7 * DAY).length, revenue: sum(orders.filter((o) => Date.parse(o.created_at) >= now - 7 * DAY)) },
		daily
	};
}

/** The morning email to everyone who switched it on. Returns how many it went to. */
export async function sendDigest(now: number): Promise<number> {
	const { data } = await getServiceClient().from('staff').select('email, display_name').eq('active', true).eq('daily_digest', true);
	const people = ((data ?? []) as { email: string | null; display_name: string | null }[]).filter((p) => p.email);
	if (!people.length) return 0;

	const t = await today(now);
	const lines = [
		`Yesterday: ${t.yesterday.orders} order${t.yesterday.orders === 1 ? '' : 's'}, ${formatInr(t.yesterday.revenue)}.`,
		`Last 7 days: ${t.last7.orders} orders, ${formatInr(t.last7.revenue)}.`,
		'',
		...(t.attention.length ? t.attention.map((a) => `• ${a.count} — ${a.title}. ${a.detail}`) : ['Nothing needs attention. Good morning.']),
		...(t.lowStock.length ? ['', 'Running low:', ...t.lowStock.slice(0, 10).map((s) => `• ${s.product} ${s.size}: ${s.left} left`)] : []),
		'',
		`Open admin: ${siteUrl()}/admin`
	];
	const headline = t.attention.length ? `${t.attention[0].count} ${t.attention[0].title.toLowerCase()}` : 'all clear';

	for (const person of people) {
		await enqueue({
			template: 'daily_digest_email',
			to: person.email!,
			toName: person.display_name,
			variables: { headline, summary: lines.join('\n') },
			context: { type: 'digest', id: istDay(now) }
		});
	}
	return people.length;
}
