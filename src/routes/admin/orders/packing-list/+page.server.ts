import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { adminRepo } from '$lib/server/admin';
import { requireSection } from '$lib/server/admin/roles';
import { resolveAdminAuth } from '$lib/server/admin/session';
import { EDITION_SIZE } from '$lib/config/commerce';

/**
 * RW-160 — §11 "A printable packing list and address label view for 25 orders
 * — no label integration."
 *
 * Twenty-five is the whole edition, so the default limit is the edition size:
 * this list is meant to be printed once, on the morning everything ships.
 * Guarded as 'fulfilment' rather than 'orders' so the §12 split can give
 * packing access to someone who should not read the order ledger, without
 * rewriting this route.
 */
export const load: PageServerLoad = async (event) => {
	const auth = await resolveAdminAuth(event);
	if (auth.status !== 'staff') error(403, 'Staff access required.');
	requireSection(auth.actor, 'fulfilment');

	const requested = Number(event.url.searchParams.get('limit'));
	const limit =
		Number.isInteger(requested) && requested > 0 && requested <= 200 ? requested : EDITION_SIZE;

	return {
		now: event.locals.now,
		limit,
		entries: await adminRepo.packingList(limit)
	};
};
