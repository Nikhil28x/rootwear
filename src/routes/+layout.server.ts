import type { LayoutServerLoad } from './$types';

/**
 * RW-020 — Shell data available on every route.
 *
 * `serverNow` is exposed so client components can render a countdown that
 * starts from the server's instant. It is NOT authoritative for whether the
 * drop is open — that is resolved server-side per route (RW-039).
 */
export const load: LayoutServerLoad = ({ locals }) => {
	return { serverNow: locals.now };
};
