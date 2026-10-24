import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireSection } from '$lib/server/admin/roles';
import { actorLabel, staffActor } from '$lib/server/admin/session';
import { findPolicy, PolicyError, revertPolicy, savePolicy } from '$lib/server/content/admin';
import { markupToBlocks, blocksToMarkup } from '$lib/admin/policy-markup';
import { RETURNS_WORDING } from '$lib/content/returns';

export const load: PageServerLoad = async (event) => {
	const actor = await staffActor(event);
	requireSection(actor, 'layout');
	if (event.params.slug === 'new') {
		return { isNew: true, page: { slug: '', title: '', summary: '', markup: '', navOrder: 100, showInFooter: false, edited: false, published: false, hasOriginal: false, carriesReturnsWording: false }, returnsWording: RETURNS_WORDING };
	}
	const page = await findPolicy(event.params.slug);
	if (!page) error(404, 'No such page.');
	return {
		isNew: false,
		page: {
			slug: page.slug,
			title: page.title,
			summary: page.summary,
			markup: blocksToMarkup(page.body),
			navOrder: page.navOrder,
			showInFooter: page.showInFooter,
			edited: page.edited,
			published: page.published,
			hasOriginal: page.hasOriginal,
			carriesReturnsWording: page.carriesReturnsWording
		},
		returnsWording: RETURNS_WORDING
	};
};

export const actions: Actions = {
	save: async (event) => {
		const actor = await staffActor(event);
		requireSection(actor, 'layout');
		const form = await event.request.formData();
		const slug = event.params.slug === 'new' ? String(form.get('slug') ?? '').trim().toLowerCase() : event.params.slug;
		try {
			await savePolicy({
				slug,
				title: String(form.get('title') ?? ''),
				summary: String(form.get('summary') ?? ''),
				body: markupToBlocks(String(form.get('markup') ?? '')),
				navOrder: Number(form.get('navOrder')) || 100,
				showInFooter: form.get('showInFooter') === 'on',
				publish: form.get('intent') === 'publish',
				actor: actorLabel(actor)
			});
		} catch (err) {
			if (err instanceof PolicyError) return fail(400, { error: err.message });
			throw err;
		}
		if (event.params.slug === 'new') redirect(303, `/admin/layout/pages/${slug}`);
		return { message: form.get('intent') === 'publish' ? 'Published. It is live on the site.' : 'Saved as a draft. The site still shows the last published version.' };
	},
	revert: async (event) => {
		const actor = await staffActor(event);
		requireSection(actor, 'layout');
		try {
			await revertPolicy(event.params.slug, actorLabel(actor));
		} catch (err) {
			if (err instanceof PolicyError) return fail(400, { error: err.message });
			throw err;
		}
		return { message: 'Back to the original.' };
	}
};
