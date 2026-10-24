import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad, RequestEvent } from './$types';
import { adminRepo } from '$lib/server/admin';
import { can, requirePermission, requireSection } from '$lib/server/admin/roles';
import { actorLabel, staffActor } from '$lib/server/admin/session';
import { auditFor } from '$lib/server/admin/audit';
import { DROP_STATES, canTransition, isOnSale, type DropState } from '$lib/domain/drop-state';
import { parseIstInput } from '$lib/components/admin/tone';
import { STAGE_COUNT, STAGE_DURATION_MS } from '$lib/drop/schedule';
import {
	CatalogueError,
	dropStateEvents,
	findDrop,
	listDrops,
	moveProduct,
	rotatePreviewToken,
	updateDropDetails
} from '$lib/server/catalogue/admin';
import { siteUrl } from '$lib/server/messaging/config';
import { formatInr } from '$lib/money';

/**
 * RW-157 — One drop: its pieces, state, schedule and visibility.
 *
 * THE TRANSITION GUARD IS THE POINT OF THE STATE CONTROL. §06 defines seven
 * states and a fixed set of legal edges between them. The UI never offers an
 * illegal one — the select is built from legalTransitionsFrom() — and the
 * action re-checks before writing, because a select is markup and markup can
 * be posted around.
 *
 * Nothing here deletes anything. The archive is the brand's proof of history.
 */

/** A posted state string is untrusted until it is one of the seven. */
function parseState(value: FormDataEntryValue | null): DropState | null {
	const text = String(value ?? '');
	return (DROP_STATES as readonly string[]).includes(text) ? (text as DropState) : null;
}

async function editor(event: RequestEvent) {
	const actor = await staffActor(event);
	requirePermission(actor, 'catalogue.edit');
	const drop = await findDrop(event.params.drop);
	if (!drop) error(404, 'That drop no longer exists.');
	return { actor, drop };
}

export const load: PageServerLoad = async (event) => {
	const actor = await staffActor(event);
	requireSection(actor, 'drops');

	const drop = await findDrop(event.params.drop);
	if (!drop) error(404, `No drop at "${event.params.drop}".`);

	const [all, events, audit] = await Promise.all([
		listDrops(),
		dropStateEvents(drop.id),
		auditFor('drop', drop.id, 30)
	]);
	const othersLive = all.filter((row) => row.id !== drop.id && isOnSale(row.state));

	return {
		now: event.locals.now,
		canEdit: can(actor, 'catalogue.edit'),
		created: event.url.searchParams.has('created'),
		drop: {
			...drop,
			products: drop.products.map((p) => ({
				id: p.id,
				slug: p.slug,
				name: p.name,
				status: p.status,
				price: formatInr(p.launchPrice),
				prelaunchPrice: p.prelaunchPrice !== p.launchPrice ? formatInr(p.prelaunchPrice) : null,
				sizes: p.sizes,
				colours: p.colourways.map((c) => ({ name: c.name, swatch: c.swatch })),
				image: p.images[0]?.url ?? null,
				totals: p.totals
			}))
		},
		previewUrl: drop.previewToken ? `${siteUrl()}/drops/${drop.slug}?preview=${drop.previewToken}` : null,
		othersLive: othersLive.map((row) => `Drop ${String(row.number).padStart(2, '0')} ${row.name}`),
		/**
		 * §07 — the tease run is derived from the launch instant, not stored
		 * beside it: one stage per day, counted back from launch.
		 */
		schedule: {
			stageCount: STAGE_COUNT,
			stageDurationMs: STAGE_DURATION_MS,
			teaseStart: drop.launchInstant - STAGE_COUNT * STAGE_DURATION_MS
		},
		history: [
			...events.map((e) => ({
				at: e.at,
				title: `${e.from ? `${e.from} → ` : ''}${e.to}`,
				detail: e.trigger === 'schedule' ? 'By the schedule' : null,
				actor: e.actor
			})),
			...audit
				.filter((a) => !a.action.startsWith('state '))
				.map((a) => ({ at: a.occurredAt, title: a.action.charAt(0).toUpperCase() + a.action.slice(1), detail: null, actor: a.actor }))
		].sort((a, b) => b.at - a.at)
	};
};

export const actions: Actions = {
	/** §06 — move the drop to another state, if and only if the edge is legal. */
	transition: async (event) => {
		const { actor, drop } = await editor(event);
		const to = parseState((await event.request.formData()).get('to'));
		if (!to) return fail(400, { error: 'Pick a state to move to.' });
		if (!canTransition(drop.state, to)) {
			return fail(400, { error: `A drop in ${drop.state} cannot move to ${to}.` });
		}
		await adminRepo.setDropState({ dropId: drop.id, from: drop.state, to, actor: actorLabel(actor) });
		return { message: `Moved to ${to}.` };
	},

	/** Publication: the archive, the cart and the public URL follow this. */
	publish: async (event) => {
		const { actor, drop } = await editor(event);
		const published = (await event.request.formData()).get('published') === 'true';
		if (published && !drop.products.some((p) => p.status === 'active')) {
			return fail(400, { error: 'Make at least one product live before publishing the drop.' });
		}
		await adminRepo.setDropPublished({ dropId: drop.id, published, actor: actorLabel(actor) });
		return { message: published ? 'Published. The drop is on the site.' : 'Hidden from the site.' };
	},

	/** Pre-order mode: the storefront takes signups instead of selling. */
	preorderMode: async (event) => {
		const { actor, drop } = await editor(event);
		const preorderMode = (await event.request.formData()).get('preorderMode') === 'true';
		await adminRepo.setDropPreorderMode({ dropId: drop.id, preorderMode, actor: actorLabel(actor) });
		return {
			message: preorderMode
				? 'Pre-order mode on: the product page shows Pre-order.'
				: 'Pre-order mode off: the product page shows Buy now.'
		};
	},

	/**
	 * §07 — the launch instant, and with it the whole tease schedule. The
	 * operator types IST; it is parsed once, here, to an epoch millisecond.
	 */
	launchInstant: async (event) => {
		const { actor, drop } = await editor(event);
		const launchInstant = parseIstInput(String((await event.request.formData()).get('launchInstant') ?? ''));
		if (launchInstant === null) return fail(400, { error: 'Pick the launch date and time.' });
		await adminRepo.setDropLaunchInstant({ dropId: drop.id, launchInstant, actor: actorLabel(actor) });
		return { message: 'Launch saved. The countdown and tease schedule moved with it.' };
	},

	details: async (event) => {
		const { actor, drop } = await editor(event);
		const form = await event.request.formData();
		try {
			await updateDropDetails({
				dropId: drop.id,
				name: String(form.get('name') ?? ''),
				story: String(form.get('story') ?? ''),
				editionSize: Number(form.get('editionSize')),
				actor: actorLabel(actor)
			});
		} catch (err) {
			if (err instanceof CatalogueError) return fail(400, { error: err.message });
			throw err;
		}
		return { message: 'Details saved.' };
	},

	preview: async (event) => {
		const { actor, drop } = await editor(event);
		await rotatePreviewToken(drop.id, actorLabel(actor));
		return {
			message: drop.previewToken ? 'New preview link made. The old one no longer works.' : 'Preview link ready.'
		};
	},

	moveProduct: async (event) => {
		const { actor } = await editor(event);
		const form = await event.request.formData();
		await moveProduct({
			productId: String(form.get('productId') ?? ''),
			direction: form.get('direction') === 'up' ? -1 : 1,
			actor: actorLabel(actor)
		});
		return {};
	}
};
