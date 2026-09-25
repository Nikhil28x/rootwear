import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { adminRepo } from '$lib/server/admin';
import { requireSection } from '$lib/server/admin/roles';
import { resolveAdminAuth } from '$lib/server/admin/session';

/**
 * RW-164 — The layout role's own screen.
 *
 * §12: "TRONE OWNS LAYOUT, BANNERS AND NEW PAGES … NO ACCESS TO ORDERS,
 * CUSTOMER RECORDS OR PAYOUTS."
 *
 * So this load is deliberately NARROW. It reads the drop list for the campaign
 * slots — which drop is on the hero, which are in the archive — and PROJECTS
 * AWAY everything else before it returns. Stock counts, reservation caps and
 * reserved figures never reach this page, because stock is owner-owned and a
 * page that merely does not render a field has still shipped it to the
 * browser in the data payload.
 */
export const load: PageServerLoad = async (event) => {
	const auth = await resolveAdminAuth(event);
	if (auth.status !== 'staff') error(403, 'Staff access required.');
	requireSection(auth.actor, 'layout');

	const rows = await adminRepo.listDropRows();

	return {
		role: auth.actor.role,
		// Identity and visibility only. No stock, no caps, no money.
		slots: rows.map((row) => ({
			id: row.id,
			slug: row.slug,
			number: row.number,
			name: row.name,
			state: row.state,
			published: row.published,
			launchInstant: row.launchInstant
		}))
	};
};
