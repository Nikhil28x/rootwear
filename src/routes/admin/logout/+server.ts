import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * RW-152 — Sign out.
 *
 * POST ONLY. A GET /admin/logout would let any page on the internet sign an
 * operator out with an <img> tag; SvelteKit's origin check covers form posts,
 * so the verb is the control here.
 */
export const POST: RequestHandler = async ({ locals }) => {
	await locals.supabase?.auth.signOut();
	redirect(303, '/admin/login');
};
