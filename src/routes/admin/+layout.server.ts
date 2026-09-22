import { error, redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { previewAvailable, resolveAdminAuth } from '$lib/server/admin/session';
import { canAccess, homeFor, navFor, requireSection, sectionForRoute } from '$lib/server/admin/roles';
import { catalogueSource } from '$lib/server/env';

/**
 * RW-150 — The guard on the whole /admin tree.
 *
 * THREE distinct outcomes, and conflating any two of them is a bug:
 *
 *   not signed in       -> redirect to the login form, remembering where they
 *                          were going.
 *   signed in, NOT staff-> 403. This is a real customer with a real account;
 *                          sending them back to the login form they have just
 *                          completed would loop forever.
 *   signed in, staff    -> allowed, and then checked AGAIN against §12's role
 *                          split for the specific section being opened.
 *
 * The section check here is the outer fence. Every page load inside also calls
 * requireSection for itself, because a layout guard is one refactor away from
 * being skipped and §12 is not a guideline.
 */
export const load: LayoutServerLoad = async (event) => {
	const onLogin = event.route.id?.startsWith('/admin/login') ?? false;
	const auth = await resolveAdminAuth(event);

	if (onLogin) {
		if (auth.status === 'staff') redirect(303, homeFor(auth.actor.role));
		return {
			actor: null,
			nav: [],
			source: catalogueSource(),
			canPreview: previewAvailable()
		};
	}

	if (auth.status === 'anonymous') {
		redirect(303, `/admin/login?next=${encodeURIComponent(event.url.pathname)}`);
	}

	if (auth.status === 'not_staff') {
		error(
			403,
			`${auth.email} is signed in, but this account is not on the Rootwear staff list. ` +
				`Staff access is granted out of band, not from this screen.`
		);
	}

	const section = sectionForRoute(event.route.id);

	// The dashboard is the index of the area and owner-only. A layout user is
	// sent to their own first screen rather than refused at the front door;
	// every other owner-only section below refuses outright.
	if (section === 'dashboard' && !canAccess(auth.actor.role, 'dashboard')) {
		redirect(303, homeFor(auth.actor.role));
	}

	requireSection(auth.actor, section);

	return {
		actor: auth.actor,
		nav: navFor(auth.actor.role),
		source: catalogueSource(),
		canPreview: false
	};
};
