import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { cartRepository } from '$lib/server/cart';
import { settleCheckout } from '$lib/server/checkout/place';
import { LAUNCH_INSTANT } from '$lib/drop/schedule';
import { DEFAULT_DELIVERY, getSetting } from '$lib/server/settings';

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
export const load: PageServerLoad = async ({ params, locals, cookies }) => {
	// The order, and the shop's delivery promise, at once.
	const [order, delivery] = await Promise.all([
		cartRepository.findOrderByToken(params.token),
		getSetting('delivery').catch(() => DEFAULT_DELIVERY)
	]);
	if (!order) error(404, 'We have no order with that reference.');

	// A paid order retires the cart that placed it (a no-op for any other).
	await settleCheckout(cookies, order);

	return {
		order,
		delivery,
		launchInstant: LAUNCH_INSTANT,
		serverNow: locals.now
	};
};
