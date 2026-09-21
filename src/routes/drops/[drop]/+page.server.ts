import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { drops } from '$lib/server/drops';
import { resolveStage } from '$lib/drop/stage-resolver';
import { DROP_01_SCHEDULE } from '$lib/drop/schedule';
import { acceptsDeposits, isOnSale } from '$lib/domain/drop-state';
import { claimedCount } from '$lib/domain/drop';

/**
 * RW-045 — §05: "The same URL survives the drop's whole life — live, sold out,
 * archived. Never redirect it." This load therefore serves EVERY drop state
 * from the one URL and never redirects away from it.
 *
 * RW-039 — stage and price are resolved from `locals.now`, the request-scoped
 * server clock, so a visitor's system clock cannot change what they are shown
 * or open the drop early (§04, §18).
 */
export const load: PageServerLoad = async ({ params, locals }) => {
	const drop = await drops.findBySlug(params.drop);
	if (!drop) error(404, 'No such drop');

	const stage = resolveStage(DROP_01_SCHEDULE, locals.now);
	const product = drop.products[0];

	/**
	 * §10 — price is chosen SERVER-SIDE. The pre-launch price is shown while the
	 * drop is in TEASE/REVEALED and is locked for anyone who reserves then (§08);
	 * the launch price applies from the launch instant onward. The client is
	 * never given both and never chooses.
	 */
	const showPrelaunchPrice = !stage.launched && !isOnSale(drop.state);
	const displayPrice = showPrelaunchPrice ? product.prelaunchPrice : product.launchPrice;

	return {
		drop,
		product,
		stage,
		displayPrice,
		showPrelaunchPrice,
		acceptsDeposits: acceptsDeposits(drop.state),
		// §07: real, live, never fabricated.
		claimed: claimedCount(drop),
		editionSize: drop.editionSize
	};
};
