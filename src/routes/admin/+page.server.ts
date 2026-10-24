import type { PageServerLoad } from './$types';
import { requireSection } from '$lib/server/admin/roles';
import { staffActor } from '$lib/server/admin/session';
import { today } from '$lib/server/alerts';

/** The home screen: what happened yesterday, and what is waiting today. */
export const load: PageServerLoad = async (event) => {
	const actor = await staffActor(event);
	requireSection(actor, 'dashboard');
	return { name: actor.name?.split(' ')[0] ?? null, now: event.locals.now, today: await today(event.locals.now) };
};
