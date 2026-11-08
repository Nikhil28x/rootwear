import type { PageServerLoad } from './$types';
import { requireSection } from '$lib/server/admin/roles';
import { staffActor } from '$lib/server/admin/session';
import { today } from '$lib/server/alerts';

/** The home screen: what happened yesterday, and what is waiting today. */
export const load: PageServerLoad = async (event) => {
	const actor = await staffActor(event);
	requireSection(actor, 'dashboard');
	// Streamed: the greeting and layout paint at once; the figures (about ten
	// queries) fill in when they arrive. Not awaited, so SvelteKit streams it.
	const figures = today(event.locals.now);
	// Rendered by {#await}'s catch; never an unhandled rejection meanwhile.
	figures.catch(() => undefined);
	return {
		name: actor.name?.split(' ')[0] ?? null,
		now: event.locals.now,
		today: figures
	};
};
