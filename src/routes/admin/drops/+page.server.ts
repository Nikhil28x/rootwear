import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { can, requirePermission, requireSection } from '$lib/server/admin/roles';
import { actorLabel, staffActor } from '$lib/server/admin/session';
import { listDrops } from '$lib/server/catalogue/admin';
import { DEFAULT_NEXT_DROP, getSetting, saveSetting } from '$lib/server/settings';

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
		nextDrop: await getSetting('nextDrop').catch(() => DEFAULT_NEXT_DROP),
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
			liveProducts: drop.products.filter((p) => p.status === 'active').length,
			totals: drop.totals
		}))
	};
};

/** A link the teaser may point at: a web address, or a path on this site. */
function safeLink(value: string): string | null {
	if (!value) return '';
	if (value.startsWith('/') && !value.startsWith('//')) return value;
	try {
		const url = new URL(value);
		return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
	} catch {
		return null;
	}
}

export const actions: Actions = {
	/** The "next drop" teaser at the end of the shop's list (see /drops). */
	nextDrop: async (event) => {
		const actor = await staffActor(event);
		requirePermission(actor, 'catalogue.edit');
		const form = await event.request.formData();
		const text = (name: string, max: number) => String(form.get(name) ?? '').trim().slice(0, max);
		const linkUrl = safeLink(text('linkUrl', 500));
		const image = safeLink(text('image', 500));
		if (linkUrl === null) return fail(400, { error: 'The link must be a web address or a path like /contact.' });
		if (image === null) return fail(400, { error: 'The image must be a web address or a path like /images/….' });
		const title = text('title', 60);
		if (!title) return fail(400, { error: 'Give the teaser a title.' });
		await saveSetting(
			'nextDrop',
			{
				show: form.get('show') === 'on',
				title,
				status: text('status', 60),
				note: text('note', 40),
				image,
				linkLabel: text('linkLabel', 60),
				linkUrl
			},
			actorLabel(actor)
		);
		return { message: 'Next drop teaser saved. The shop shows it now.' };
	}
};
