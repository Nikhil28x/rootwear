import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { adminRepo } from '$lib/server/admin';
import { ORDER_STATES, type OrderState } from '$lib/server/admin/types';
import { requireSection } from '$lib/server/admin/roles';
import { resolveAdminAuth } from '$lib/server/admin/session';

/**
 * RW-158 — Orders.
 *
 * §12: orders are OWNER data. requireSection refuses a 'layout' account here
 * even though the nav never showed them the link.
 */
export const load: PageServerLoad = async (event) => {
	const auth = await resolveAdminAuth(event);
	if (auth.status !== 'staff') error(403, 'Staff access required.');
	requireSection(auth.actor, 'orders');

	const stateParam = event.url.searchParams.get('state');
	const state = (ORDER_STATES as readonly string[]).includes(stateParam ?? '')
		? (stateParam as OrderState)
		: undefined;

	const orders = await adminRepo.listOrders({ state });

	return {
		now: event.locals.now,
		orders,
		states: ORDER_STATES,
		filter: { state: state ?? '' }
	};
};
