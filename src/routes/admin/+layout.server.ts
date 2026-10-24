import { error, redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { previewAvailable, resolveAdminAuth } from '$lib/server/admin/session';
import { canAccess, homeFor, navFor, requireSection, sectionForRoute } from '$lib/server/admin/roles';
import { catalogueSource } from '$lib/server/env';
import { readTheme } from '$lib/server/admin/theme';

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
 *   signed in, staff    -> allowed, and then checked AGAIN against that
 *                          person's permissions for the section being opened.
 *
 * The section check here is the outer fence. Every page load inside also
 * checks for itself, because a layout guard is one refactor away from being
 * skipped.
 */
export const load: LayoutServerLoad = async (event) => {
	const onLogin = event.route.id?.startsWith('/admin/login') ?? false;
	const auth = await resolveAdminAuth(event);
	const theme = readTheme(event.cookies);

	if (onLogin) {
		if (auth.status === 'staff') redirect(303, homeFor(auth.actor));
		return {
			actor: null,
			nav: { groups: [], footer: [] },
			source: catalogueSource(),
			canPreview: previewAvailable(),
			theme
		};
	}

	if (auth.status === 'anonymous') {
		redirect(303, `/admin/login?next=${encodeURIComponent(event.url.pathname)}`);
	}

	if (auth.status === 'not_staff') {
		error(
			403,
			`${auth.email} is signed in, but this account is not on the Rootwear staff list. ` +
				`Ask an owner to add you from Settings → Staff.`
		);
	}

	const section = sectionForRoute(event.route.id);
	const source = catalogueSource();
	const nav = navFor(auth.actor);

	// Until persistent storage is configured, admin is a submissions inbox only.
	// Sending every other route here prevents empty operational screens from
	// suggesting that orders, stock or revenue are already being stored.
	if (source === 'mock' && section !== 'submissions') {
		redirect(303, '/admin/submissions');
	}

	// The overview is the index of the area. Someone without reports is sent
	// to their own first screen rather than refused at the front door.
	if (section === 'dashboard' && !canAccess(auth.actor, 'dashboard')) {
		redirect(303, homeFor(auth.actor));
	}

	if (section) requireSection(auth.actor, section);

	return {
		actor: auth.actor,
		nav:
			source === 'mock'
				? {
						groups: nav.groups
							.map((group) => ({
								...group,
								items: group.items.filter((item) => item.section === 'submissions')
							}))
							.filter((group) => group.items.length > 0),
						footer: []
					}
				: nav,
		source,
		canPreview: false,
		theme
	};
};
