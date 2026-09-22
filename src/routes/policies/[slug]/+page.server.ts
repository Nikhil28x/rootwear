import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { policies } from '$lib/server/content';

/**
 * §03 template 10 — ONE route renders every static page.
 *
 * Shipping, Returns, Privacy, Terms, FAQ, Size Guide, Care and Track Order all
 * arrive here, and so does the ninth page whenever it is added: nothing in this
 * file or its component knows a slug by name. That is the whole point of the
 * template.
 *
 * NOT prerendered, though it otherwise could be: the root layout load reads
 * cookies for the cart, and SvelteKit forbids cookie access during
 * prerendering. The pages are static enough that a CDN cache header is the
 * right lever here instead.
 */
export const load: PageServerLoad = async ({ params, setHeaders }) => {
	const policy = await policies.findBySlug(params.slug);

	// An unknown slug is a 404 rendered by +error.svelte, which is styled with
	// this same template (§03: "Search and 404 styled with it").
	if (!policy) {
		error(404, `There is no page at /policies/${params.slug}.`);
	}

	const siblings = (await policies.listAll()).map(({ slug, title }) => ({ slug, title }));

	setHeaders({ 'cache-control': 'public, max-age=0, s-maxage=600' });

	return { policy, siblings };
};
