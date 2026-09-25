import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { account } from '$lib/server/account';
import { resolveAccountAuth } from '$lib/server/account/session';
import { addPaise, paise, ZERO, type Paise } from '$lib/money';
import type { PreOrder, ReservationState } from '$lib/server/account/types';

/**
 * RW-144 — §05 fixes /account/pre-orders as one of the two account URLs that
 * must not move. §08 fixes what is on it:
 *
 *   "A reservation, its deposit, its balance payment and its final order are
 *    ONE CONTINUOUS RECORD — the customer sees ONE THING here."
 *
 * So the load returns ONE row per reservation, already carrying its deposit,
 * its balance, its piece number, its dispatch date and the order it became.
 * Nothing on this page is assembled by the component out of three lists.
 *
 * ORDERING is by urgency, not by date. A reservation whose balance has not
 * been cleared is released to the waitlist if it lapses (§08), so it is the
 * one thing here a customer can lose a piece by scrolling past.
 */
const URGENCY: Record<ReservationState, number> = {
	balance_due: 0,
	pending_payment: 1,
	reserved: 2,
	balance_paid: 3,
	dispatched: 4,
	released_to_waitlist: 5,
	cancelled: 6,
	refunded_cap_race: 7
};

export const load: PageServerLoad = async (event) => {
	const auth = await resolveAccountAuth(event);
	if (auth.status !== 'signed_in') redirect(303, '/account/login');

	const customerId = auth.customer?.id ?? null;
	const records: PreOrder[] = customerId ? await account.listPreOrders(customerId) : [];

	const sorted = [...records].sort(
		(a, b) => URGENCY[a.state] - URGENCY[b.state] || b.createdAt - a.createdAt
	);

	// §08: read the STORED state, never inferred from whether a payment exists.
	const due = sorted.filter((record) => record.state === 'balance_due');
	const outstanding: Paise = due.length
		? addPaise(...due.map((record) => paise(Math.max(0, record.balance - record.balancePaid))))
		: ZERO;

	return {
		records: sorted,
		outstanding,
		outstandingCount: due.length
	};
};
