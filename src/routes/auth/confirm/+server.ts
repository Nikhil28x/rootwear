import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { EmailOtpType } from '@supabase/supabase-js';
import { safeRedirect } from '$lib/server/account/session';

/**
 * RW-140 — Email confirmation and recovery links.
 *
 * The token-hash flow, which is what Supabase's email templates use when they
 * are pointed at a server route rather than at an implicit-grant fragment.
 * Verifying here means the token never reaches client JavaScript and never
 * sits in a URL fragment the browser keeps in history.
 *
 * `type` is checked against the handful of values we actually issue rather
 * than passed through: an unexpected OTP type is a malformed link, not
 * something to hand to the Auth server and hope about.
 */
const ALLOWED_TYPES: readonly EmailOtpType[] = ['email', 'signup', 'recovery', 'email_change'];

function isAllowed(value: string | null): value is EmailOtpType {
	return value !== null && (ALLOWED_TYPES as readonly string[]).includes(value);
}

export const GET: RequestHandler = async (event) => {
	const tokenHash = event.url.searchParams.get('token_hash');
	const type = event.url.searchParams.get('type');
	const next = safeRedirect(event.url.searchParams.get('next'), '/account');
	const supabase = event.locals.supabase;

	if (!tokenHash || !isAllowed(type) || !supabase) redirect(303, '/account/login');

	const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
	if (error) redirect(303, '/account/login');

	// A verified link has established the session, so the customer goes where
	// they were headed rather than back through a form they no longer need.
	redirect(303, next);
};
