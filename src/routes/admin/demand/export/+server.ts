import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminRepo } from '$lib/server/admin';
import type { DemandEntryKind } from '$lib/server/admin/types';
import { requireSection } from '$lib/server/admin/roles';
import { resolveAdminAuth } from '$lib/server/admin/session';
import { csvDate, csvResponse, toCsv } from '$lib/server/admin/csv';

/**
 * RW-155 — §13: "The list belongs to Rootwear, EXPORTABLE AT ANY TIME."
 *
 * An endpoint rather than a form action, so the file downloads without
 * navigating away from the board.
 *
 * This route is a customer-data egress point, so it carries the same two
 * checks as every other owner-only screen — a session AND a role — and it
 * carries them itself. An endpoint does not run the layout guard.
 */
const KINDS: DemandEntryKind[] = ['request', 'notify_me', 'waitlist'];

export const GET: RequestHandler = async (event) => {
	const auth = await resolveAdminAuth(event);
	if (auth.status !== 'staff') error(403, 'Staff access required.');
	requireSection(auth.actor, 'demand');

	const params = event.url.searchParams;
	const dropId = params.get('drop') || undefined;
	const kindParam = params.get('kind');
	const kind = (KINDS as string[]).includes(kindParam ?? '')
		? (kindParam as DemandEntryKind)
		: undefined;

	const entries = await adminRepo.listDemandEntries({ dropId, kind });

	const body = toCsv(
		['kind', 'drop', 'drop_slug', 'size', 'email', 'position', 'state', 'note', 'recorded_at'],
		entries.map((entry) => [
			entry.kind,
			entry.dropName,
			entry.dropSlug,
			entry.size ?? '',
			entry.email,
			entry.position ?? '',
			entry.state,
			entry.note ?? '',
			csvDate(entry.createdAt)
		])
	);

	const stamp = new Date(event.locals.now).toISOString().slice(0, 10);
	return csvResponse(`rootwear-demand-${stamp}.csv`, body);
};
