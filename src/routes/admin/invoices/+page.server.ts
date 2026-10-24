import type { PageServerLoad } from './$types';
import { requireSection } from '$lib/server/admin/roles';
import { staffActor } from '$lib/server/admin/session';
import { DOCUMENT_PAGE_SIZE, listDocuments } from '$lib/server/orders/invoices';
import { readRegisterFilter } from '$lib/server/orders/register';

export const load: PageServerLoad = async (event) => {
	const actor = await staffActor(event);
	requireSection(actor, 'invoices');
	const { filter, raw } = readRegisterFilter(event.url.searchParams);
	const page = Math.max(1, Number(event.url.searchParams.get('page')) || 1);
	const [paged, all] = await Promise.all([
		listDocuments({ ...filter, page }),
		listDocuments({ ...filter, page: 1, all: true })
	]);
	const sum = (kind: 'invoice' | 'credit_note', pick: (t: (typeof all.documents)[number]['totals']) => number) =>
		all.documents.filter((d) => d.kind === kind).reduce((n, d) => n + pick(d.totals), 0);
	return {
		...paged,
		page,
		pageSize: DOCUMENT_PAGE_SIZE,
		filters: raw,
		query: event.url.search,
		summary: {
			invoiced: sum('invoice', (t) => t.total),
			credited: sum('credit_note', (t) => t.total),
			tax: sum('invoice', (t) => t.cgst + t.sgst + t.igst) - sum('credit_note', (t) => t.cgst + t.sgst + t.igst),
			count: all.documents.filter((d) => d.kind === 'invoice').length
		}
	};
};
