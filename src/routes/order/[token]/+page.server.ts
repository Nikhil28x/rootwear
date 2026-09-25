import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { cartRepository } from '$lib/server/cart';
import { LAUNCH_INSTANT } from '$lib/drop/schedule';

/**
 * §03 template 07 / §11 — the order confirmation, reachable by TOKEN.
 *
 * `orders.public_token` is 24 random bytes minted by app.commit_order(). The
 * order id is a uuid and the order number is human-readable and roughly
 * sequential; neither belongs in a URL that shows a delivery address and a
 * phone number. Guest checkout is the norm (§10), so there is often no account
 * to sit behind — the unguessable URL IS the access control, and it is the
 * same link the confirmation email carries.
 */
export const load: PageServerLoad = async ({ params, locals }) => {
	const order = await cartRepository.findOrderByToken(params.token);
	if (!order) error(404, 'We have no order with that reference.');

	return {
		order,
		launchInstant: LAUNCH_INSTANT,
		serverNow: locals.now
	};
};
