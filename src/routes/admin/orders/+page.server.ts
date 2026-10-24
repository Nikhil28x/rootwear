import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { can, requirePermission, requireSection } from '$lib/server/admin/roles';
import { actorLabel, staffActor } from '$lib/server/admin/session';
import { listOrders, markPacked, ORDER_PAGE_SIZE, orderCounts } from '$lib/server/orders/admin';
import { readOrderFilter } from '$lib/server/orders/filters';
import { listDrops } from '$lib/server/catalogue/admin';

/**
 * RW-158 — Orders. The default view is what needs doing: paid orders not yet
 * dispatched. Every other state is a tab away.
 */
export const load: PageServerLoad = async (event) => {
	const actor = await staffActor(event);
	requireSection(actor, 'orders');

	const { filter, raw } = readOrderFilter(event.url.searchParams);
	const page = Math.max(1, Number(event.url.searchParams.get('page')) || 1);
	const [result, counts, drops] = await Promise.all([
		listOrders(filter, page),
		orderCounts(),
		listDrops()
	]);

	return {
		...result,
		counts,
		page,
		pageSize: ORDER_PAGE_SIZE,
		filters: raw,
		drops: drops.map((d) => ({
			id: d.id,
			label: `Drop ${String(d.number).padStart(2, '0')} — ${d.name}`
		})),
		canEdit: can(actor, 'orders.edit'),
		query: event.url.search
	};
};

export const actions: Actions = {
	pack: async (event) => {
		const actor = await staffActor(event);
		requirePermission(actor, 'orders.edit');
		const ids = (await event.request.formData()).getAll('ids').map(String);
		if (!ids.length) return fail(400, { error: 'Select the orders to mark packed.' });
		const moved = await markPacked(ids, actorLabel(actor));
		const skipped = ids.length - moved;
		return {
			message: `${moved} marked packed.${skipped ? ` ${skipped} skipped — only paid orders can be packed.` : ''}`
		};
	}
};
