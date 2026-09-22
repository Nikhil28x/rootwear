import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad, RequestEvent } from './$types';
import { adminRepo } from '$lib/server/admin';
import { ORDER_STATES, type OrderState } from '$lib/server/admin/types';
import { requireSection } from '$lib/server/admin/roles';
import { actorLabel, resolveAdminAuth } from '$lib/server/admin/session';

/**
 * RW-159 — One order, and the §11 fulfilment screen.
 *
 * §11: "Mark packed, enter courier name and tracking reference, mark
 * dispatched." Aaron ships all 25 pieces himself via Porter in this phase, so
 * there is no carrier API — the reference is typed in, and the guard is that a
 * dispatch WITHOUT a courier and a reference is refused rather than recorded
 * as a dispatch with nothing to track.
 */
async function requireStaff(event: RequestEvent) {
	const auth = await resolveAdminAuth(event);
	if (auth.status !== 'staff') error(403, 'Staff access required.');
	requireSection(auth.actor, 'orders');
	return auth.actor;
}

export const load: PageServerLoad = async (event) => {
	await requireStaff(event);

	const order = await adminRepo.findOrder(event.params.id);
	if (!order) error(404, 'No order with that reference.');

	return { now: event.locals.now, order, states: ORDER_STATES };
};

export const actions: Actions = {
	fulfil: async (event) => {
		const actor = await requireStaff(event);
		const form = await event.request.formData();

		const stateValue = String(form.get('state') ?? '');
		if (!(ORDER_STATES as readonly string[]).includes(stateValue)) {
			return fail(400, { ok: false, message: 'Unknown order state.' });
		}
		const state = stateValue as OrderState;

		const courierName = String(form.get('courierName') ?? '').trim() || null;
		const trackingRef = String(form.get('trackingRef') ?? '').trim() || null;

		if (state === 'dispatched' && (!courierName || !trackingRef)) {
			return fail(400, {
				ok: false,
				message:
					'A dispatch needs a courier name and a tracking reference. Both are shown to the customer on the track-order page.'
			});
		}

		try {
			await adminRepo.updateFulfilment({
				orderId: event.params.id,
				state,
				courierName,
				trackingRef,
				actor: actorLabel(actor)
			});
		} catch (cause) {
			return fail(409, {
				ok: false,
				message: cause instanceof Error ? cause.message : 'Fulfilment write failed.'
			});
		}

		return { ok: true, message: `Order marked ${state.replace(/_/g, ' ')}.` };
	}
};
