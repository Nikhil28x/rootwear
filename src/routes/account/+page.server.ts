import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { account } from '$lib/server/account';
import { resolveAccountAuth } from '$lib/server/account/session';
import { addPaise, paise, ZERO, type Paise } from '$lib/money';

/**
 * RW-141 — §05 fixes /account as the account's front door, and §03 template 08
 * says what belongs behind it: "order history, pre-order queue with balance
 * status, saved addresses, notify-me subscriptions, tracking link."
 *
 * This page is the index of those, arranged around ONE question: is anything
 * waiting for me? An outstanding balance is the only thing in this area a
 * customer can lose a piece by ignoring (§08 releases a lapsed reservation to
 * the waitlist), so it is computed first and shown first.
 *
 * The identity is resolved through the same cached call the layout used, so
 * the two cannot disagree about who is asking, and every repository call below
 * is scoped by the customer id that came out of it.
 */
export const load: PageServerLoad = async (event) => {
	const auth = await resolveAccountAuth(event);
	// The layout guard already redirected an anonymous visitor. Repeated here
	// because a layout guard is one refactor away from being skipped, and this
	// page reads a customer's orders.
	if (auth.status !== 'signed_in') redirect(303, '/account/login');

	const customerId = auth.customer?.id ?? null;

	if (!customerId) {
		return {
			latestOrder: null,
			preOrders: [],
			outstanding: ZERO as Paise,
			outstandingCount: 0,
			orderCount: 0,
			addressCount: 0,
			notifyCount: 0,
			waitlistCount: 0
		};
	}

	const [orders, preOrders, addresses, notifies, waitlist] = await Promise.all([
		account.listOrders(customerId),
		account.listPreOrders(customerId),
		account.listAddresses(customerId),
		account.listNotifySubscriptions(auth.email),
		account.listWaitlistEntries(customerId)
	]);

	// §08: read the STORED state. A reservation is not "awaiting balance"
	// because a balance payment row is missing — it is awaiting balance when
	// the column says so.
	const due = preOrders.filter((record) => record.state === 'balance_due');
	const outstanding = due.length
		? addPaise(...due.map((record) => paise(Math.max(0, record.balance - record.balancePaid))))
		: ZERO;

	return {
		latestOrder: orders[0] ?? null,
		// The two that need attention, in full; the rest live on their own page.
		preOrders: due.slice(0, 2),
		outstanding,
		outstandingCount: due.length,
		orderCount: orders.length,
		addressCount: addresses.length,
		notifyCount: notifies.filter((row) => row.notifiedAt === null).length,
		waitlistCount: waitlist.filter((row) => row.state === 'waiting').length
	};
};
