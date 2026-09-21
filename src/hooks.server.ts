import type { Handle } from '@sveltejs/kit';
import { serverNow } from '$lib/server/clock';

/**
 * RW-019 — Request-scoped server clock and baseline security headers.
 *
 * `locals.now` is stamped ONCE per request so every drop-state, stage and
 * countdown resolution within a single response agrees on the same instant.
 * §04: state changes run on server time, never the visitor's clock.
 */
export const handle: Handle = async ({ event, resolve }) => {
	event.locals.now = serverNow();

	const response = await resolve(event);

	// Baseline hardening. CSP is deliberately not set here yet — it needs the
	// Razorpay checkout origins (RW-096), which are blocked on RW-005.
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set(
		'Permissions-Policy',
		'geolocation=(), microphone=(), camera=(), interest-cohort=()'
	);

	return response;
};
