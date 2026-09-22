import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad, RequestEvent } from './$types';
import { adminRepo } from '$lib/server/admin';
import { requireSection } from '$lib/server/admin/roles';
import { actorLabel, resolveAdminAuth } from '$lib/server/admin/session';

/**
 * RW-162 — ONE reservation, as one continuous record (§08).
 *
 * The balance-link action records the state change; the email itself is sent
 * by the notifications path off the back of that change. Splitting it that way
 * keeps the record truthful even if a send fails: the row says a link was
 * requested, and a failed send is a send problem, not a silently unrecorded
 * one.
 */
async function requireStaff(event: RequestEvent) {
	const auth = await resolveAdminAuth(event);
	if (auth.status !== 'staff') error(403, 'Staff access required.');
	requireSection(auth.actor, 'reservations');
	return auth.actor;
}

export const load: PageServerLoad = async (event) => {
	await requireStaff(event);

	const reservation = await adminRepo.findReservation(event.params.id);
	if (!reservation) error(404, 'No reservation with that reference.');

	return { now: event.locals.now, reservation };
};

const DAY = 86_400_000;

export const actions: Actions = {
	/** §08: send the balance link and record the date it falls due. */
	balanceLink: async (event) => {
		const actor = await requireStaff(event);
		const form = await event.request.formData();

		const days = Number(form.get('days'));
		if (!Number.isInteger(days) || days < 1 || days > 60) {
			return fail(400, {
				ok: false,
				message: 'Give the customer between 1 and 60 days to pay the balance.'
			});
		}

		try {
			await adminRepo.markBalanceRequested({
				reservationId: event.params.id,
				dueBy: event.locals.now + days * DAY,
				actor: actorLabel(actor)
			});
		} catch (cause) {
			return fail(409, {
				ok: false,
				message: cause instanceof Error ? cause.message : 'Balance request failed.'
			});
		}

		return {
			ok: true,
			message: `Balance link recorded. Due in ${days} day${days === 1 ? '' : 's'}.`
		};
	}
};
