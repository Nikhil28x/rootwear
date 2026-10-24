import type { PageServerLoad } from './$types';
import { requireSection } from '$lib/server/admin/roles';
import { staffActor } from '$lib/server/admin/session';
import { sourceReport } from '$lib/server/leads/admin';
import { siteUrl } from '$lib/server/messaging/config';

export const load: PageServerLoad = async (event) => {
	const actor = await staffActor(event);
	requireSection(actor, 'leads');
	const days = [7, 30, 90].includes(Number(event.url.searchParams.get('days')))
		? Number(event.url.searchParams.get('days'))
		: 30;
	return { days, site: siteUrl(), ...(await sourceReport(event.locals.now, days)) };
};
