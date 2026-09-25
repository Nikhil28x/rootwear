import type { PageServerLoad } from './$types';
import { policies } from '$lib/server/content';

/**
 * The index of everything the static template carries. Adding a ninth page
 * puts it here automatically — this file names no slug.
 *
 * Not prerendered: the root layout load reads cookies for the cart, and
 * SvelteKit forbids cookie access during prerendering. A shared-cache header
 * does the same job for content that changes a few times a year.
 */
export const load: PageServerLoad = async ({ setHeaders }) => {
	setHeaders({ 'cache-control': 'public, max-age=0, s-maxage=600' });
	return { pages: await policies.listAll() };
};
