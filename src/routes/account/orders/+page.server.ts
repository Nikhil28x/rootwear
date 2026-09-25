import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { account } from '$lib/server/account';
import { resolveAccountAuth } from '$lib/server/account/session';

/**
 * RW-142 — §03 template 08: order history.
 *
 * Read scoped by the customer id from the validated session, never by anything
 * in the URL. This page has no parameters for exactly that reason.
 */
export const load: PageServerLoad = async (event) => {
	const auth = await resolveAccountAuth(event);
	if (auth.status !== 'signed_in') redirect(303, '/account/login');

	const customerId = auth.customer?.id ?? null;
	const orders = customerId ? await account.listOrders(customerId) : [];

	return { orders };
};
