import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { account } from '$lib/server/account';
import { previewAvailable, resolveAccountAuth, safeRedirect } from '$lib/server/account/session';
import { isSupabaseConfigured } from '$lib/server/env';

/**
 * RW-138 — The guard on the whole /account tree.
 *
 * §10 is the constraint that shapes this file: "Guest checkout ON. Customers
 * may optionally create an account, and are offered one AFTER purchase rather
 * than before." So the account area must never become a barrier to buying —
 * it guards ITSELF and nothing else. No cart, checkout or product route is
 * touched by this, and an anonymous visitor who wanders in is sent to sign in
 * rather than refused.
 *
 * TWO outcomes, and conflating them is a bug:
 *
 *   not signed in  -> redirect to the sign-in form, CARRYING WHERE THEY WERE
 *                     GOING, so the trip through the form ends where it
 *                     started. A customer who clicked "pay the balance" in an
 *                     email must land on that reservation, not on a dashboard.
 *   signed in      -> allowed. Every page load inside still scopes its own
 *                     reads to this customer's id, because a layout guard is
 *                     one refactor away from being skipped.
 *
 * The sign-in page lives INSIDE /account (§05 keeps the URLs together), so it
 * is excluded here explicitly. Without that the guard would redirect the
 * sign-in form to itself.
 */
export const load: LayoutServerLoad = async (event) => {
	const onLogin = event.route.id?.startsWith('/account/login') ?? false;
	const auth = await resolveAccountAuth(event);

	if (onLogin) {
		// Already signed in: skip the form and go where they were headed.
		if (auth.status === 'signed_in') {
			redirect(303, safeRedirect(event.url.searchParams.get('redirectTo')));
		}
		return {
			signedIn: false,
			email: '',
			customerId: null,
			outstandingCount: 0,
			fixtures: false,
			preview: false,
			configured: isSupabaseConfigured(),
			canPreview: previewAvailable()
		};
	}

	if (auth.status === 'anonymous') {
		const target = `${event.url.pathname}${event.url.search}`;
		redirect(303, `/account/login?redirectTo=${encodeURIComponent(target)}`);
	}

	// §08: the one thing in this area a customer must ACT on is an outstanding
	// balance, so it is counted once here and marked in the navigation on every
	// page rather than only on the pre-orders screen they may never open.
	const customerId = auth.customer?.id ?? null;
	const preOrders = customerId ? await account.listPreOrders(customerId) : [];

	return {
		signedIn: true,
		email: auth.email,
		customerId,
		outstandingCount: preOrders.filter((record) => record.state === 'balance_due').length,
		fixtures: auth.fixtures,
		preview: auth.preview,
		configured: isSupabaseConfigured(),
		canPreview: previewAvailable()
	};
};
