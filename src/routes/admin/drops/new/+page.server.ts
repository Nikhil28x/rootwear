import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requirePermission } from '$lib/server/admin/roles';
import { actorLabel, staffActor } from '$lib/server/admin/session';
import { CatalogueError, createDrop, nextDropNumber } from '$lib/server/catalogue/admin';
import { parseIstInput } from '$lib/components/admin/tone';

export const load: PageServerLoad = async (event) => {
	const actor = await staffActor(event);
	requirePermission(actor, 'catalogue.edit');
	return { nextNumber: await nextDropNumber() };
};

export const actions: Actions = {
	default: async (event) => {
		const actor = await staffActor(event);
		requirePermission(actor, 'catalogue.edit');
		const form = await event.request.formData();

		const values = {
			number: String(form.get('number') ?? ''),
			name: String(form.get('name') ?? '').trim(),
			story: String(form.get('story') ?? '').trim(),
			launch: String(form.get('launch') ?? ''),
			editionSize: String(form.get('editionSize') ?? ''),
			preorderMode: form.get('preorderMode') === 'on'
		};
		const errors: Record<string, string> = {};

		const number = Number(values.number);
		if (!Number.isInteger(number) || number < 1 || number > 99)
			errors.number = 'Use a number from 1 to 99.';
		if (!values.name) errors.name = 'Give the drop a name, e.g. Pineapple Haze.';
		const launchInstant = parseIstInput(values.launch);
		if (launchInstant === null) errors.launch = 'Pick the launch date and time.';
		const editionSize = Number(values.editionSize);
		if (!Number.isInteger(editionSize) || editionSize < 1)
			errors.editionSize = 'How many pieces in the edition? A whole number, 1 or more.';

		if (Object.keys(errors).length)
			return fail(400, { values, errors, error: 'Check the highlighted fields.' });

		let slug: string;
		try {
			({ slug } = await createDrop({
				number,
				name: values.name,
				story: values.story,
				launchInstant: launchInstant!,
				editionSize,
				preorderMode: values.preorderMode,
				actor: actorLabel(actor)
			}));
		} catch (err) {
			if (err instanceof CatalogueError)
				return fail(400, { values, errors: {}, error: err.message });
			throw err;
		}
		redirect(303, `/admin/drops/${slug}?created=1`);
	}
};
