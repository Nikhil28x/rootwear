import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * §03 template 07 — checkout has a first step, and /checkout is not a page.
 * Sending the visitor to the address step keeps one entry point rather than
 * two URLs that both claim to be "checkout".
 */
export const load: PageServerLoad = async () => {
	redirect(307, '/checkout/information');
};
