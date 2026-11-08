import type { PageServerLoad } from './$types';
import { drops } from '$lib/server/drops';
import { loadExperience } from '$lib/server/drops/experience';

/**
 * The homepage leads with the product, so it reads the live drop through the
 * SAME loader as the product experience: one price authority, one stock
 * figure, one set of images. Nothing on this page is a hand-typed copy of a
 * fact that lives on the drop record.
 *
 * No stock count or sale status is printed here: the page says only that the
 * drop is a limited run of its edition size.
 */
export const load: PageServerLoad = async ({ locals, cookies }) => {
	const drop = await drops.findLiveDrop();
	const product = drop?.products[0];
	if (!drop || !product) return { feature: null };

	const experience = await loadExperience(drop, product, { now: locals.now, cookies });
	return { feature: experience };
};
