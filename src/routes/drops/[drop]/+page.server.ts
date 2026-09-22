import { error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { drops } from '$lib/server/drops';
import { demand } from '$lib/server/demand';
import { handleNotifyMe, handleRequestDrop } from '$lib/server/demand/actions';
import { resolveStage } from '$lib/drop/stage-resolver';
import { DROP_01_SCHEDULE } from '$lib/drop/schedule';
import { acceptsDeposits, acceptsNotifyMe, isOnSale } from '$lib/domain/drop-state';
import { claimedCount, isSizeSoldOut, sellableStock } from '$lib/domain/drop';
import type { Drop, Product } from '$lib/domain/drop';
import type { Paise } from '$lib/money';
import { acceptsDropRequest, isFinished } from '$lib/components/drop/marks';
import type { SizeOffer } from '$lib/components/drop/types';

/**
 * RW-045 — §05: "The same URL survives the drop's whole life — live, sold out,
 * archived. NEVER REDIRECT IT." This load therefore serves EVERY drop state
 * from the one URL and never redirects away from it.
 *
 * §03 template 04 — "A finished drop kept alive: lookbook and story intact,
 * pieces marked sold out, notify-me on each. Reuses template 03." That is why
 * there is no separate archived-drop route: this file IS both templates, and
 * the state decides which affordances appear, not which page you land on.
 *
 * RW-039 — stage and price are resolved from `locals.now`, the request-scoped
 * server clock, so a visitor's system clock cannot change what they are shown
 * or open the drop early (§04, §18).
 */

/** §06: sold-out sizes stay visible and greyed. The flag drives the grey. */
function offersFor(product: Product): SizeOffer[] {
	return product.variants.map((variant) => ({
		variantId: variant.id,
		size: variant.size,
		sku: variant.sku,
		soldOut: isSizeSoldOut(variant),
		remaining: sellableStock(variant)
	}));
}

function sizeOptionsOf(drop: Drop) {
	const many = drop.products.length > 1;
	return drop.products.flatMap((product) =>
		product.variants.map((variant) => ({
			value: variant.id,
			label: many ? `${product.name} — ${variant.size}` : variant.size
		}))
	);
}

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
	 *
	 * The state test is what makes a FINISHED drop price correctly: an archived
	 * drop is not on sale and its launch instant may be in the future in a
	 * fixture, so a purely time-based test would show it at the tease price it
	 * never actually sold at.
	 */
	const isPreLaunchState = drop.state === 'TEASE' || drop.state === 'REVEALED';
	const showPrelaunchPrice = isPreLaunchState && !stage.launched && !isOnSale(drop.state);
	const displayPrice: Paise = showPrelaunchPrice ? product.prelaunchPrice : product.launchPrice;

	const finished = isFinished(drop.state);

	const pieces = drop.products.map((item) => {
		const offers = offersFor(item);
		return {
			slug: item.slug,
			name: item.name,
			summary: item.summary,
			fabric: item.fabric,
			gsm: item.gsm,
			fit: item.fit,
			care: item.care,
			modelHeightCm: item.modelHeightCm,
			modelWornSize: item.modelWornSize,
			images: item.images,
			lead: item.images.find((image) => image.role === 'lead') ?? item.images[0] ?? null,
			offers,
			price: showPrelaunchPrice ? item.prelaunchPrice : item.launchPrice,
			/** §06: every size gone. Drives the "sold out" plate on the piece. */
			allSoldOut: offers.every((offer) => offer.soldOut)
		};
	});

	/**
	 * §07 — real, live, never fabricated. Only read for a finished drop, where
	 * it is the thing the page is FOR; on a live drop the number that matters
	 * is stock, not petitions.
	 */
	const demandRows = finished ? await demand.demandForDrop(drop.id) : [];

	return {
		drop,
		product,
		stage,
		displayPrice,
		showPrelaunchPrice,
		acceptsDeposits: acceptsDeposits(drop.state),
		// §07: real, live, and never fabricated.
		claimed: claimedCount(drop),
		editionSize: drop.editionSize,

		pieces,
		onSale: isOnSale(drop.state),
		finished,
		/** The countdown is about a launch that has not happened. Past drops hide it. */
		showCountdown: isPreLaunchState,
		notifyOpen: acceptsNotifyMe(drop.state),
		canRequest: acceptsDropRequest(drop.state),
		sizeOptions: sizeOptionsOf(drop),
		demandRows
	};
};

export const actions: Actions = {
	/** §06 — notify-me sits on every sold-out piece and size. */
	notify: (event) => handleNotifyMe(event, 'drop_page'),
	/** §12 — a finished drop can be asked for again, by size. */
	requestDrop: (event) => handleRequestDrop(event, 'drop_page')
};
