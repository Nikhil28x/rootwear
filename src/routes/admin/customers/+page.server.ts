import type { PageServerLoad } from './$types';
import { requireSection } from '$lib/server/admin/roles';
import { staffActor } from '$lib/server/admin/session';
import { CUSTOMER_PAGE_SIZE, listCustomers } from '$lib/server/customers/admin';

export const load: PageServerLoad = async (event) => {
	const actor = await staffActor(event);
	requireSection(actor, 'customers');
	const p = event.url.searchParams;
	const filters = {
		q: p.get('q') ?? '',
		segment: p.get('segment') ?? '',
		tag: p.get('tag') ?? '',
		sort: p.get('sort') ?? 'recent'
	};
	const page = Math.max(1, Number(p.get('page')) || 1);
	const result = await listCustomers(
		{
			search: filters.q || undefined,
			segment: ['buyers', 'repeat', 'lapsed', 'never'].includes(filters.segment) ? (filters.segment as 'buyers') : undefined,
			tag: filters.tag || undefined,
			sort: filters.sort === 'spent' || filters.sort === 'orders' ? filters.sort : 'recent'
		},
		page,
		event.locals.now
	);
	return { ...result, filters, page, pageSize: CUSTOMER_PAGE_SIZE, now: event.locals.now, query: event.url.search };
};
