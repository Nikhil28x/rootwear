import type { PageServerLoad } from './$types';
import { can, requireSection } from '$lib/server/admin/roles';
import { staffActor } from '$lib/server/admin/session';
import { listDrops } from '$lib/server/catalogue/admin';

/**
 * Every drop, newest first. A drop is never deleted — a finished one moves to
 * the archive with its story and price history intact.
 */
export const load: PageServerLoad = async (event) => {
	const actor = await staffActor(event);
	requireSection(actor, 'drops');
	const drops = await listDrops();
	return {
		canEdit: can(actor, 'catalogue.edit'),
		drops: drops.map((drop) => ({
			id: drop.id,
			slug: drop.slug,
			number: drop.number,
			name: drop.name,
			state: drop.state,
			launchInstant: drop.launchInstant,
			published: drop.published,
			preorderMode: drop.preorderMode,
			editionSize: drop.editionSize,
			products: drop.products.length,
			drafts: drop.products.filter((p) => p.status === 'draft').length,
			lead: drop.products[0]?.images[0]?.url ?? null,
			totals: drop.totals
		}))
	};
};
