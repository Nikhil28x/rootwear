import type { PageServerLoad } from './$types';
import { requireSection } from '$lib/server/admin/roles';
import { staffActor } from '$lib/server/admin/session';
import { listTemplates } from '$lib/server/messaging/templates';

export const load: PageServerLoad = async (event) => {
	const actor = await staffActor(event);
	requireSection(actor, 'messages');
	return { templates: await listTemplates() };
};
