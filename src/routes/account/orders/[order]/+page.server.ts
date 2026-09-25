import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { account } from '$lib/server/account';
import { resolveAccountAuth } from '$lib/server/account/session';

/**
 * RW-143 — One order, in full.
 *
 * The URL carries the human-facing order number, which is printed on the
 * invoice and is therefore guessable. It NEVER authorises the read on its own:
 * the repository is asked for "this number, belonging to this customer", and a
 * number that exists for somebody else comes back null and 404s here — the
 * same response as a number that does not exist at all, so the page cannot be
 * used to discover which order numbers are real.
 */
export const load: PageServerLoad = async (event) => {
	const auth = await resolveAccountAuth(event);
	if (auth.status !== 'signed_in') redirect(303, '/account/login');

	const customerId = auth.customer?.id ?? null;
	const order = customerId ? await account.findOrder(customerId, event.params.order) : null;

	if (!order) {
		error(404, 'We cannot find that order on this account.');
	}

	return { order };
};
