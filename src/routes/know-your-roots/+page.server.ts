import type { PageServerLoad } from './$types';
import { KNOW_YOUR_ROOTS } from '$lib/content/know-your-roots';

/**
 * §03 template 09 — "Know your roots".
 *
 * ONE page: hemp, why Rootwear, the making, read top to bottom. Deliberately
 * not split into a story page plus a sustainability page.
 *
 * The copy is static and identical for every visitor, so the page prerenders.
 * It still comes through a server load rather than being imported into the
 * component, because the copy is on its way to the content tables: when it
 * moves, this file changes and the view does not.
 */
export const prerender = true;

export const load: PageServerLoad = async () => {
	return { content: KNOW_YOUR_ROOTS };
};
