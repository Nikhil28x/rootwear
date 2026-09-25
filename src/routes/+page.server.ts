import type { PageServerLoad } from './$types';
import { drops } from '$lib/server/drops';
import { isOnSale, acceptsNotifyMe } from '$lib/domain/drop-state';

/**
 * The homepage drop section used to advertise a hardcoded '₹3,490' — a third
 * price matching neither settled figure (§10 fixes ₹4,100 at launch and ₹3,400
 * pre-launch). It now carries the drop's AVAILABILITY instead of a price, so
 * there is one fewer place a stale number can hide.
 */
export const load: PageServerLoad = async ({ locals }) => {
	const drop = await drops.findLiveDrop();
	if (!drop) return { dropStatus: null };

	const onSale = isOnSale(drop.state);
	const beforeLaunch = locals.now < drop.launchInstant;

	/**
	 * "Open for pre-order" means you can commit now and it dispatches after the
	 * drop's stated instant — which is exactly where Drop 01 sits while it is
	 * open ahead of its launch date. Once that instant passes the same piece is
	 * simply available.
	 */
	const label = onSale
		? beforeLaunch
			? 'Open for pre-order'
			: 'Available now'
		: drop.state === 'SOLD_OUT'
			? 'Sold out'
			: acceptsNotifyMe(drop.state)
				? 'Notify me'
				: 'Coming soon';

	return {
		dropStatus: {
			label,
			slug: drop.slug,
			name: drop.name,
			launchInstant: drop.launchInstant
		}
	};
};
