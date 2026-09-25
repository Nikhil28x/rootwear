import type { LayoutServerLoad } from './$types';
import { policies } from '$lib/server/content';
import { loadCartView } from '$lib/server/cart';

/**
 * RW-020 — Shell data on every route.
 *
 * `serverNow` is exposed so client components can render a countdown from the
 * server's instant. It is NOT authoritative for whether the drop is open —
 * that is resolved server-side per route (RW-039).
 */
export const load: LayoutServerLoad = async ({ locals, cookies }) => {
	const [footerPolicies, cart] = await Promise.all([
		policies.listFooterLinks(),
		loadCartView(cookies)
	]);

	return {
		serverNow: locals.now,
		footerPolicies,
		cartLines: cart
	};
};
