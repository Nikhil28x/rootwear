import type { RequestHandler } from './$types';
import { requireSection } from '$lib/server/admin/roles';
import { staffActor } from '$lib/server/admin/session';
import { csvDate, csvResponse, toCsv } from '$lib/server/admin/csv';
import { listCustomers } from '$lib/server/customers/admin';

/** Customers as CSV, with the screen's filters. Contact data: owners and customer staff only. */
export const GET: RequestHandler = async (event) => {
	const actor = await staffActor(event);
	requireSection(actor, 'customers');
	const p = event.url.searchParams;
	const { customers } = await listCustomers(
		{ search: p.get('q') || undefined, segment: (p.get('segment') || undefined) as 'buyers' | undefined, tag: p.get('tag') || undefined },
		1,
		Date.now(),
		{ all: true }
	);
	const body = toCsv(
		['Name', 'Email', 'Phone', 'City', 'Orders', 'Spent (₹)', 'First order', 'Last order', 'Email OK', 'WhatsApp OK', 'Tags'],
		customers.map((c) => [
			c.name ?? '',
			c.email,
			c.phone ?? '',
			c.city ?? '',
			c.orders,
			(Number(c.spent) / 100).toFixed(2),
			c.firstOrderAt ? csvDate(c.firstOrderAt) : '',
			c.lastOrderAt ? csvDate(c.lastOrderAt) : '',
			c.marketingEmail ? 'yes' : 'no',
			c.marketingWhatsapp ? 'yes' : 'no',
			c.tags.join(' ')
		])
	);
	return csvResponse(`rootwear-customers-${new Date().toISOString().slice(0, 10)}.csv`, body);
};
