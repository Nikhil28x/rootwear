/**
 * Who may open an unpublished drop's page.
 *
 * A published drop is public. An unpublished one is a draft being prepared
 * in admin, and opens only for:
 *
 *   - the drop the homepage is already showing (findLiveDrop's fallback, so
 *     a site whose only drop was never formally published keeps working);
 *   - anyone holding the secret preview link (?preview=<token>), which is
 *     remembered in a cookie for that drop so the gallery and cart links work;
 *   - signed-in staff who can see the catalogue.
 *
 * Everyone else gets the same 404 as a drop that does not exist, so a draft's
 * name cannot be discovered by guessing its URL.
 */
import { error, type RequestEvent } from '@sveltejs/kit';
import type { Drop } from '$lib/domain/drop';
import { drops } from './index';
import { resolveAdminAuth } from '$lib/server/admin/session';
import { can } from '$lib/server/admin/roles';
import { constantTimeEqual } from '$lib/server/payments/crypto';

const cookieName = (slug: string) => `rw_preview_${slug.replace(/[^a-z0-9-]/g, '')}`;

export async function requireVisible(drop: Drop, event: RequestEvent): Promise<void> {
	if (drop.published) return;

	const live = await drops.findLiveDrop();
	if (live?.id === drop.id) return;

	const token = await drops.previewToken(drop.slug);
	if (token) {
		const presented =
			event.url.searchParams.get('preview') ?? event.cookies.get(cookieName(drop.slug)) ?? '';
		if (presented && constantTimeEqual(presented, token)) {
			event.cookies.set(cookieName(drop.slug), token, {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				maxAge: 60 * 60 * 24 * 7
			});
			return;
		}
	}

	const auth = await resolveAdminAuth(event);
	if (auth.status === 'staff' && can(auth.actor, 'catalogue.view')) return;

	error(404, 'No such drop');
}
