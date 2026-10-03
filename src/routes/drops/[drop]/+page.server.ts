import { error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { drops } from '$lib/server/drops';
import { handleNotifyMe, handlePreOrder, handleRequestDrop } from '$lib/server/demand/actions';
import { loadExperience } from '$lib/server/drops/experience';

/**
 * RW-045 — §05: "The same URL survives the drop's whole life — live, sold out,
 * archived. NEVER REDIRECT IT." This load serves every drop state from the
 * one URL and never redirects away from it.
 *
 * The drop and its lead piece are one experience — see
 * $lib/server/drops/experience.ts. Stage and price are resolved from
 * `locals.now`, the request-scoped server clock (RW-039).
 */
export const load: PageServerLoad = async ({ params, locals, cookies }) => {
	const drop = await drops.findBySlug(params.drop);
	if (!drop) error(404, 'No such drop');

	const product = drop.products[0];
	if (!product) error(404, 'This drop has no pieces yet');

	return loadExperience(drop, product, { now: locals.now, cookies });
};

export const actions: Actions = {
	/** §06 — notify-me sits on every sold-out piece and size. */
	notify: (event) => handleNotifyMe(event, 'drop_page'),
	/** §12 — a finished drop can be asked for again, by size. */
	requestDrop: (event) => handleRequestDrop(event, 'drop_page'),
	/** A pre-order signup — name, email, phone, size. No money, nothing held. */
	preorder: (event) => handlePreOrder(event, 'drop_page')
};
