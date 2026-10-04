import type { PageServerLoad } from './$types';
import { drops } from '$lib/server/drops';
import { isOnSale, acceptsNotifyMe } from '$lib/domain/drop-state';
import { loadExperience } from '$lib/server/drops/experience';

/**
 * The homepage leads with the product, so it reads the live drop through the
 * SAME loader as the product experience: one price authority, one stock
 * figure, one set of images. Nothing on this page is a hand-typed copy of a
 * fact that lives on the drop record.
 */
export const load: PageServerLoad = async ({ locals, cookies }) => {
	const drop = await drops.findLiveDrop();
	const product = drop?.products[0];
	if (!drop || !product) return { feature: null };

	const experience = await loadExperience(drop, product, { now: locals.now, cookies });

	const onSale = isOnSale(drop.state);
	const beforeLaunch = locals.now < drop.launchInstant;
	const status = onSale
		? beforeLaunch
			? 'Open for pre-order'
			: 'Available now'
		: drop.state === 'SOLD_OUT'
			? 'Sold out'
			: acceptsNotifyMe(drop.state)
				? 'Coming soon'
				: 'Coming soon';

	const remaining = experience.offers.reduce((sum, offer) => sum + offer.remaining, 0);

	return {
		feature: {
			...experience,
			status,
			remaining
		}
	};
};
