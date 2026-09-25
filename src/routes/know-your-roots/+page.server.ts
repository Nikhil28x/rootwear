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
/**
 * NOT prerendered, despite the copy being identical for every visitor.
 *
 * The shared header carries a per-visitor cart badge. A prerendered page is
 * built once with no cart cookie and served byte-identical to everyone, so the
 * badge baked in as empty and stayed empty here while every other route showed
 * the right count. Correctness of a global chrome element beats static serving
 * for one page; this still renders on the server and caches normally.
 *
 * If this page is ever prerendered again, the badge has to become client-only
 * first — which is a change to SiteHeader, not to this file.
 */
export const prerender = false;

export const load: PageServerLoad = async () => {
	return { content: KNOW_YOUR_ROOTS };
};
