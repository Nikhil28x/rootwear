import type { PageServerLoad } from './$types';
import { adminRepo } from '$lib/server/admin';
import { requireSection } from '$lib/server/admin/roles';
import { staffActor } from '$lib/server/admin/session';
import { listPolicies } from '$lib/server/content/admin';

/**
 * RW-164 — Site layout and copy: the policy pages, and which drop sits on
 * which surface.
 *
 * Deliberately NARROW: the drop list is projected down to identity and
 * visibility before it leaves the server, so stock, caps and money never
 * reach a layout-only account's browser.
 */
export const load: PageServerLoad = async (event) => {
	const actor = await staffActor(event);
	requireSection(actor, 'layout');
	const [rows, pages] = await Promise.all([adminRepo.listDropRows(), listPolicies()]);
	return {
		isOwner: actor.isOwner,
		pages: pages.map((p) => ({ slug: p.slug, title: p.title, edited: p.edited, published: p.published, showInFooter: p.showInFooter, updatedAt: p.updatedAt })),
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
