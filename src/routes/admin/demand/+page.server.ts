import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { adminRepo } from '$lib/server/admin';
import type { DemandEntry, DemandEntryKind } from '$lib/server/admin/types';
import { requireSection } from '$lib/server/admin/roles';
import { resolveAdminAuth } from '$lib/server/admin/session';

/**
 * RW-154 — §12 "Demand board — the input to the next cut and to any re-drop."
 *
 * The dashboard shows the counts. This screen shows the PEOPLE: who asked, for
 * which drop, in which size, and when. That is the surface the brief asks for
 * — visibility into how many have requested a past drop and what the
 * requirement actually is, size by size.
 *
 * Filtering and sorting run on the server through the query string, so both
 * work with JavaScript switched off and both survive a bookmarked URL.
 */

const KINDS: DemandEntryKind[] = ['request', 'notify_me', 'waitlist'];

export type DemandSort = 'newest' | 'oldest' | 'drop' | 'size' | 'kind';

function isKind(value: string | null): value is DemandEntryKind {
	return value !== null && (KINDS as string[]).includes(value);
}

function sortEntries(entries: DemandEntry[], sort: DemandSort): DemandEntry[] {
	const copy = [...entries];
	switch (sort) {
		case 'oldest':
			return copy.sort((a, b) => a.createdAt - b.createdAt);
		case 'drop':
			return copy.sort(
				(a, b) => a.dropName.localeCompare(b.dropName) || b.createdAt - a.createdAt
			);
		case 'size':
			// Garment order, not alphabetical: XS S M L XL.
			return copy.sort(
				(a, b) => sizeRank(a.size) - sizeRank(b.size) || b.createdAt - a.createdAt
			);
		case 'kind':
			return copy.sort((a, b) => a.kind.localeCompare(b.kind) || b.createdAt - a.createdAt);
		default:
			return copy.sort((a, b) => b.createdAt - a.createdAt);
	}
}

function sizeRank(size: string | null): number {
	const order = ['XS', 'S', 'M', 'L', 'XL'];
	const index = size ? order.indexOf(size) : -1;
	return index === -1 ? order.length : index;
}

export const load: PageServerLoad = async (event) => {
	const auth = await resolveAdminAuth(event);
	if (auth.status !== 'staff') error(403, 'Staff access required.');
	requireSection(auth.actor, 'demand');

	const params = event.url.searchParams;
	const dropId = params.get('drop') || undefined;
	const kindParam = params.get('kind');
	const kind = isKind(kindParam) ? kindParam : undefined;
	const sort = (params.get('sort') ?? 'newest') as DemandSort;

	const [rows, entries, dropList] = await Promise.all([
		adminRepo.listDemandRows(),
		adminRepo.listDemandEntries({ dropId, kind }),
		adminRepo.listDropRows()
	]);

	const filteredRows = dropId ? rows.filter((row) => row.dropId === dropId) : rows;

	return {
		now: event.locals.now,
		rows: filteredRows,
		entries: sortEntries(entries, sort),
		drops: dropList.map((drop) => ({
			id: drop.id,
			label: `Drop ${String(drop.number).padStart(2, '0')} — ${drop.name}`
		})),
		filter: { dropId: dropId ?? '', kind: kind ?? '', sort }
	};
};
