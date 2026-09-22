import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

/**
 * RW-139 — Sign out.
 *
 * A POST, always. Signing someone out is a state change, and a GET that does
 * it can be fired by any image tag on any page on the internet; the form in
 * the account navigation posts here, and SvelteKit's origin check covers it.
 *
 * The GET below therefore does NOT sign anyone out. It renders a confirmation
 * page, which is what a customer sees if they reach this URL directly.
 */
export const load: PageServerLoad = async () => {
	return {};
};

export const actions: Actions = {
	default: async (event) => {
		// Clears the session cookies through the request-scoped anon client, so
		// the Set-Cookie headers reach the browser on this response.
		await event.locals.supabase?.auth.signOut();

		// Home, not the sign-in form: someone who has just signed out is leaving,
		// and putting a password box in front of them reads as a demand to
		// return. §10 — the account is never the price of shopping here.
		redirect(303, '/?signed-out=1');
	}
};
