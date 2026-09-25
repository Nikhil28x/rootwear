import { redirect } from '@sveltejs/kit';

/**
 * RW-029 — §05 fixes the canonical drop URL as /drops/01-pineapple-haze, and
 * "The same URL survives the drop's whole life — live, sold out, archived.
 * Never redirect it."
 *
 * /new-collection is the pre-brief URL and is not canonical, so it redirects
 * INTO the canonical drop URL. This is the one redirect the brief permits:
 * it points at the drop URL, it never points away from it.
 */
export const load = () => {
	redirect(308, '/drops/01-pineapple-haze');
};
