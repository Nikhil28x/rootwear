import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { cartRepository, holdUntil, openCart } from '$lib/server/cart';
import { catalogueIndex } from '$lib/server/cart/pricing';
import { availableUnits } from '$lib/server/cart/availability';
import { getServiceClient } from '$lib/server/db/clients';
import { catalogueSource } from '$lib/server/env';
import { recordClick } from '$lib/server/carts/admin';

/**
 * The link in a cart reminder. Puts the pieces from the abandoned checkout
 * back in this visitor's cart — only what is still available, never more
 * than is left — and opens the cart. The token is the order's own
 * unguessable public token, the same one its order page uses.
 */
export const GET: RequestHandler = async ({ params, cookies, locals }) => {
	if (catalogueSource() !== 'supabase') redirect(303, '/cart');

	const client = getServiceClient();
	const { data } = await client
		.from('orders')
		.select('id, state')
		.eq('public_token', params.token)
		.maybeSingle();
	const order = data as { id: string; state: string } | null;
	// A paid order has nothing to recover; its page is the right place.
	if (!order) redirect(303, '/cart');
	if (!['pending_payment', 'cancelled'].includes(order.state)) redirect(303, `/order/${params.token}`);

	const { data: lines } = await client.from('order_lines').select('variant_id, quantity').eq('order_id', order.id);
	const cart = await openCart(cookies, locals.now);
	const index = await catalogueIndex();

	const restore = [];
	let short = false;
	for (const line of (lines ?? []) as { variant_id: string; quantity: number }[]) {
		const entry = index.get(line.variant_id);
		if (!entry) {
			short = true;
			continue;
		}
		const available = await availableUnits(entry.variant, locals.now, cart.id);
		const quantity = Math.min(line.quantity, available);
		if (quantity < line.quantity) short = true;
		if (quantity > 0) restore.push({ variantId: line.variant_id, quantity, heldUntilMs: holdUntil(locals.now) });
	}
	await cartRepository.restoreLines(cart.id, restore, holdUntil(locals.now));
	await recordClick(order.id);

	redirect(303, short ? '/cart?restored=partial' : '/cart?restored=1');
};
