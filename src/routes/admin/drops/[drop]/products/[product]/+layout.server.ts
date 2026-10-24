import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { can, requireSection } from '$lib/server/admin/roles';
import { staffActor } from '$lib/server/admin/session';
import { findProduct, listSizeOptions } from '$lib/server/catalogue/admin';

export const load: LayoutServerLoad = async (event) => {
	const actor = await staffActor(event);
	requireSection(actor, 'drops');
	const found = await findProduct(event.params.drop, event.params.product);
	if (!found) error(404, 'That product is not in this drop.');
	return {
		canEdit: can(actor, 'catalogue.edit'),
		drop: { id: found.drop.id, slug: found.drop.slug, name: found.drop.name, number: found.drop.number, published: found.drop.published },
		product: found.product,
		sizeOptions: await listSizeOptions()
	};
};
