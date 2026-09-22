import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { safeRedirect } from '$lib/server/account/session';

/**
 * RW-140 — The OAuth / PKCE landing strip.
 *
 * Supabase sends the browser here with a one-time `code` after an email link
 * or a provider sign-in. Exchanging it sets the session cookies through the
 * request-scoped anon client from hooks.server.ts, which is the only client
 * whose Set-Cookie headers reach this response.
 *
 * TWO rules this endpoint keeps:
 *
 *  1. The `next` parameter is run through safeRedirect, so a link crafted with
 *     `?next=https://evil.example` cannot use our own domain to bounce someone
 *     off-site with a fresh session in hand.
 *  2. A failed exchange goes back to the sign-in form with a generic notice.
 *     The reason a code failed (expired, already used, wrong verifier) is not
 *     something a visitor can act on, and naming it tells a link-harvester
 *     which of their guesses was closest.
 */
export const GET: RequestHandler = async (event) => {
	const code = event.url.searchParams.get('code');
	const next = safeRedirect(event.url.searchParams.get('next'));
	const supabase = event.locals.supabase;

	if (!code || !supabase) redirect(303, '/account/login');

	const { error } = await supabase.auth.exchangeCodeForSession(code);
	if (error) redirect(303, '/account/login');

	redirect(303, next);
};
