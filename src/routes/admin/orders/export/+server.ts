import type { RequestHandler } from './$types';
import { requireSection } from '$lib/server/admin/roles';
import { staffActor } from '$lib/server/admin/session';
import { csvDate, csvResponse, toCsv } from '$lib/server/admin/csv';
import { listOrders } from '$lib/server/orders/admin';
import { readOrderFilter } from '$lib/server/orders/filters';

/** The orders list as CSV, with whatever filters are on the screen. */
export const GET: RequestHandler = async (event) => {
	const actor = await staffActor(event);
	requireSection(actor, 'orders');
	const { filter } = readOrderFilter(event.url.searchParams);
	const { orders } = await listOrders(filter, 1, { all: true });
	const body = toCsv(
		[
			'Order',
			'Placed',
			'State',
			'Customer',
			'Email',
			'City',
			'Pieces',
			'Total (₹)',
			'Pre-order',
			'Courier',
			'Tracking'
		],
		orders.map((o) => [
			o.number,
			csvDate(o.createdAt),
			o.state,
			o.name,
			o.email,
			o.city,
			o.pieces,
			(Number(o.total) / 100).toFixed(2),
			o.isPreOrder ? 'yes' : 'no',
			o.courierName ?? '',
			o.trackingRef ?? ''
		])
	);
	return csvResponse(`rootwear-orders-${new Date().toISOString().slice(0, 10)}.csv`, body);
};
