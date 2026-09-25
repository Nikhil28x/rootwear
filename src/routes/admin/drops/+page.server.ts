import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { adminRepo } from '$lib/server/admin';
import { requireSection } from '$lib/server/admin/roles';
import { resolveAdminAuth } from '$lib/server/admin/session';
import { isOnSale } from '$lib/domain/drop-state';

/**
 * RW-156 — The drop index.
 *
 * §06: "Nothing is ever deleted." There is no delete action on this screen and
 * there never will be — a finished drop moves to ARCHIVED and stays listed.
 */
export const load: PageServerLoad = async (event) => {
	const auth = await resolveAdminAuth(event);
	if (auth.status !== 'staff') error(403, 'Staff access required.');
	requireSection(auth.actor, 'drops');

	const rows = await adminRepo.listDropRows();
	const live = rows.filter((row) => isOnSale(row.state));

	return {
		now: event.locals.now,
		rows,
		// §06 / RW-043: the model permits two, the storefront assumes one.
		liveWarning:
			live.length > 1
				? live.map((row) => `Drop ${String(row.number).padStart(2, '0')} ${row.name}`)
				: null
	};
};
