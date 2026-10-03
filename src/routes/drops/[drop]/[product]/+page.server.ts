import { error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { drops } from '$lib/server/drops';
import { handleNotifyMe, handlePreOrder, handleRequestDrop } from '$lib/server/demand/actions';
import { loadExperience } from '$lib/server/drops/experience';

/**
 * §05: the piece is NESTED UNDER ITS DROP — /drops/01-pineapple-haze/tee.
 * It renders the same experience as the drop URL, focused on this piece;
 * see $lib/server/drops/experience.ts.
 */
export const load: PageServerLoad = async ({ params, locals, cookies }) => {
	const drop = await drops.findBySlug(params.drop);
	if (!drop) error(404, 'No such drop');

	const product = drop.products.find((item) => item.slug === params.product);
	if (!product) error(404, 'No such piece in this drop');

	return loadExperience(drop, product, { now: locals.now, cookies });
};

export const actions: Actions = {
	/** §06 — notify-me sits on every sold-out piece and size. */
	notify: (event) => handleNotifyMe(event, 'product_page'),
	/** §12 — once the drop is finished, the piece page can still take demand. */
	requestDrop: (event) => handleRequestDrop(event, 'product_page'),
	preorder: (event) => handlePreOrder(event, 'product_page')
};
