import type { PageServerLoad } from './$types';
import { requireSection } from '$lib/server/admin/roles';
import { staffActor } from '$lib/server/admin/session';
import { AUDIT_PAGE_SIZE, auditFacets, listAudit } from '$lib/server/admin/audit';
import { parseIstInput } from '$lib/components/admin/tone';

export const load: PageServerLoad = async (event) => {
	const actor = await staffActor(event);
	requireSection(actor, 'audit');

	const params = event.url.searchParams;
	const filters = {
		actor: params.get('actor') ?? '',
		entity: params.get('entity') ?? '',
		search: params.get('q') ?? '',
		from: params.get('from') ?? '',
		to: params.get('to') ?? ''
	};
	const page = Math.max(1, Number(params.get('page')) || 1);

	const [result, facets] = await Promise.all([
		listAudit(
			{
				actor: filters.actor || undefined,
				entity: filters.entity || undefined,
				search: filters.search || undefined,
				from: filters.from ? (parseIstInput(`${filters.from}T00:00`) ?? undefined) : undefined,
				to: filters.to ? (parseIstInput(`${filters.to}T23:59`) ?? undefined) : undefined
			},
			page
		),
		auditFacets()
	]);

	return { ...result, facets, filters, page, pageSize: AUDIT_PAGE_SIZE };
};
