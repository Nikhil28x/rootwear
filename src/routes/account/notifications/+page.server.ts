import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { account } from '$lib/server/account';
import { resolveAccountAuth } from '$lib/server/account/session';

/**
 * RW-146 — §03 template 08: notify-me subscriptions. §08 adds the waitlist.
 *
 * TWO LISTS, KEYED DIFFERENTLY, and the difference is the point:
 *
 *   notify-me — keyed by EMAIL (app.notify_requests has no customer_id). §10
 *               keeps guest checkout on, and a visitor asks to be told when a
 *               size returns long before they have an account. So this list is
 *               read by the signed-in address, which is what makes a guest's
 *               earlier subscriptions visible once they do create one.
 *
 *   waitlist  — keyed by CUSTOMER (app.waitlist_entries.customer_id). §08 makes
 *               the waitlist an ordered queue for a specific piece, so a place
 *               in it belongs to a person, not to an address.
 *
 * §13: "Opt-in consent is captured and logged at the point of signup." The
 * consent date is therefore shown beside every subscription — a customer is
 * entitled to see what they agreed to and when, not just that they did.
 *
 * Withdrawing does two different things for the same reason. A notify-me row
 * IS the consent, so unsubscribing deletes it; leaving a tombstone would keep
 * a marketing address on file the customer believes they have withdrawn. A
 * waitlist place is a position in a queue, so giving it up is a STATE CHANGE —
 * §06 keeps the history, and renumbering a queue is how people lose their spot.
 */
export const load: PageServerLoad = async (event) => {
	const auth = await resolveAccountAuth(event);
	if (auth.status !== 'signed_in') redirect(303, '/account/login');

	const customerId = auth.customer?.id ?? null;

	const [notifications, waitlist] = await Promise.all([
		account.listNotifySubscriptions(auth.email),
		customerId ? account.listWaitlistEntries(customerId) : Promise.resolve([])
	]);

	return {
		email: auth.email,
		notifications,
		// A withdrawn place stays in the table but is not a subscription any
		// more, so it does not belong on a page about what you are signed up to.
		waitlist: waitlist.filter((entry) => entry.state !== 'withdrawn')
	};
};

export const actions: Actions = {
	unsubscribe: async (event) => {
		const auth = await resolveAccountAuth(event);
		if (auth.status !== 'signed_in') redirect(303, '/account/login');

		const form = await event.request.formData();
		const id = String(form.get('id') ?? '');

		// Scoped by the signed-in address, so an id alone removes nothing.
		const removed = id ? await account.unsubscribeNotify(auth.email, id) : false;
		if (!removed) {
			return fail(404, {
				failure: 'That subscription is already gone. Nothing was changed.'
			});
		}

		redirect(303, '/account/notifications?updated=1');
	},

	withdraw: async (event) => {
		const auth = await resolveAccountAuth(event);
		if (auth.status !== 'signed_in') redirect(303, '/account/login');

		const customerId = auth.customer?.id ?? null;
		const form = await event.request.formData();
		const id = String(form.get('id') ?? '');

		const changed = customerId && id ? await account.withdrawWaitlist(customerId, id) : false;
		if (!changed) {
			return fail(404, {
				failure: 'That place in the queue is no longer yours to give up.'
			});
		}

		redirect(303, '/account/notifications?updated=1');
	}
};
