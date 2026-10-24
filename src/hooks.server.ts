import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { serverNow } from '$lib/server/clock';
import { createAnonClient } from '$lib/server/db/clients';
import { isSupabaseConfigured } from '$lib/server/env';
import { recordTouch, touchFrom } from '$lib/server/attribution/touch';

/**
 * RW-019 — Request-scoped server clock.
 *
 * `locals.now` is stamped ONCE per request so every drop-state, stage and
 * countdown resolution within a single response agrees on the same instant.
 * §04: state changes run on server time, never the visitor's clock.
 */
const clock: Handle = async ({ event, resolve }) => {
	event.locals.now = serverNow();
	return resolve(event);
};

/**
 * RW-120 — Supabase SSR auth with cookie sessions and a VALIDATED JWT.
 *
 * The important part is `safeGetSession`. `supabase.auth.getSession()` reads
 * the session straight out of the cookie and does NOT verify its signature —
 * anyone can forge that cookie, so it is not safe to trust on the server.
 * `getUser()` calls the Auth server and validates the JWT. So: take the user
 * from getUser(), and only then hand back a session. Never authorise anything
 * on the strength of getSession() alone.
 *
 * Degrades cleanly: with no Supabase configured the app still runs, and every
 * auth-dependent route simply sees no user.
 */
const auth: Handle = async ({ event, resolve }) => {
	if (!isSupabaseConfigured()) {
		event.locals.supabase = null;
		event.locals.safeGetSession = async () => ({ session: null, user: null });
		return resolve(event);
	}

	event.locals.supabase = createAnonClient(event);

	event.locals.safeGetSession = async () => {
		const {
			data: { user },
			error
		} = await event.locals.supabase!.auth.getUser();

		// Signature invalid, expired, or no session at all.
		if (error || !user) return { session: null, user: null };

		const {
			data: { session }
		} = await event.locals.supabase!.auth.getSession();

		return { session, user };
	};

	return resolve(event, {
		// Supabase sets these on the auth response; they must reach the browser.
		filterSerializedResponseHeaders: (name) => name === 'content-range' || name === 'x-supabase-api-version'
	});
};

/**
 * Campaign attribution: a landing tagged with utm_* (or a Meta / Google click
 * id) is remembered in a first-party cookie, so the lead or order it leads
 * to can say where it came from. Page requests only; admin and APIs skip it.
 */
const touch: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;
	if (event.request.method === 'GET' && !path.startsWith('/admin') && !path.startsWith('/api')) {
		const landed = touchFrom(event.url, event.request.headers.get('referer'), event.locals.now);
		if (landed) recordTouch(event.cookies, landed);
	}
	return resolve(event);
};

/** Baseline hardening. */
const security: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set(
		'Permissions-Policy',
		'geolocation=(), microphone=(), camera=(), interest-cohort=()'
	);

	// CSP is deliberately not set yet: it needs the Razorpay checkout origins
	// (RW-096), which are blocked on RW-005 (account confirmed in writing).

	return response;
};

export const handle = sequence(clock, touch, auth, security);
