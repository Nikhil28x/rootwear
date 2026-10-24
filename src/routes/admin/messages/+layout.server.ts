import type { LayoutServerLoad } from './$types';
import { requireSection } from '$lib/server/admin/roles';
import { staffActor } from '$lib/server/admin/session';
import { outboxCounts } from '$lib/server/messaging/outbox';

export const load: LayoutServerLoad = async (event) => {
	const actor = await staffActor(event);
	requireSection(actor, 'messages');
	return { counts: await outboxCounts() };
};
