import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { adminRepo } from '$lib/server/admin';
import { RESERVATION_STATES, type ReservationState } from '$lib/server/admin/types';
import { requireSection } from '$lib/server/admin/roles';
import { resolveAdminAuth } from '$lib/server/admin/session';

/**
 * RW-161 — Reservations.
 *
 * §08: "A reservation, its deposit, its balance payment and its final order
 * are ONE CONTINUOUS RECORD — the customer sees one thing in
 * /account/pre-orders, and ADMIN SEES ONE ROW WITH A CLEAR STATE."
 *
 * So this list is one row per reservation with its state spelled out, not a
 * join of payments that the reader has to reassemble in their head.
 */
export const load: PageServerLoad = async (event) => {
	const auth = await resolveAdminAuth(event);
	if (auth.status !== 'staff') error(403, 'Staff access required.');
	requireSection(auth.actor, 'reservations');

	const stateParam = event.url.searchParams.get('state');
	const state = (RESERVATION_STATES as readonly string[]).includes(stateParam ?? '')
		? (stateParam as ReservationState)
		: undefined;

	const [reservations, ledger] = await Promise.all([
		adminRepo.listReservations({ state }),
		adminRepo.preOrderLedger(event.locals.now)
	]);

	return {
		now: event.locals.now,
		reservations,
		ledger,
		states: RESERVATION_STATES,
		filter: { state: state ?? '' }
	};
};
