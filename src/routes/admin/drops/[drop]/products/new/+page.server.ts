import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requirePermission } from '$lib/server/admin/roles';
import { actorLabel, staffActor } from '$lib/server/admin/session';
import { CatalogueError, createProduct, findDrop, listSizeOptions } from '$lib/server/catalogue/admin';
import { readProductForm } from '$lib/server/catalogue/forms';

export const load: PageServerLoad = async (event) => {
	const actor = await staffActor(event);
	requirePermission(actor, 'catalogue.edit');
	const drop = await findDrop(event.params.drop);
	if (!drop) error(404, 'That drop no longer exists.');
	return {
		drop: { slug: drop.slug, name: drop.name, number: drop.number },
		sizes: await listSizeOptions()
	};
};

export const actions: Actions = {
	default: async (event) => {
		const actor = await staffActor(event);
		requirePermission(actor, 'catalogue.edit');
		const drop = await findDrop(event.params.drop);
		if (!drop) error(404, 'That drop no longer exists.');

		const form = await event.request.formData();
		const { input, values } = readProductForm(form);
		const sizes = form.getAll('sizes').map(String);
		const colourways = form
			.getAll('colourName')
			.map((name, i) => ({
				name: String(name).trim(),
				code: String(form.getAll('colourCode')[i] ?? '').trim().toUpperCase(),
				swatch: String(form.getAll('colourSwatch')[i] ?? '') || null
			}))
			.filter((c) => c.name);

		if (Number.isNaN(input.launchPrice)) {
			return fail(400, { values, sizes, colourways, error: 'Enter the launch price in rupees, e.g. 4100.' });
		}

		let id: string;
		try {
			id = await createProduct({ dropId: drop.id, product: input, sizes, colourways, actor: actorLabel(actor) });
		} catch (err) {
			if (err instanceof CatalogueError) return fail(400, { values, sizes, colourways, error: err.message });
			throw err;
		}
		redirect(303, `/admin/drops/${drop.slug}/products/${id}?created=1`);
	}
};
