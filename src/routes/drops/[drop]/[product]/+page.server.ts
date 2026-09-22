import { error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { drops } from '$lib/server/drops';
import { handleNotifyMe, handleRequestDrop } from '$lib/server/demand/actions';
import { resolvePrice } from '$lib/server/cart/pricing';
import { resolveStage } from '$lib/drop/stage-resolver';
import { DROP_01_SCHEDULE, LAUNCH_INSTANT } from '$lib/drop/schedule';
import { acceptsNotifyMe, isOnSale } from '$lib/domain/drop-state';
import { isSizeSoldOut, sellableStock } from '$lib/domain/drop';
import type { Paise } from '$lib/money';
import { acceptsDropRequest, isFinished } from '$lib/components/drop/marks';
import type { SizeOffer } from '$lib/components/drop/types';

/**
 * §03 template 05 / §09 — the product page.
 *
 * §05: the product is NESTED UNDER ITS DROP — /drops/01-pineapple-haze/tee —
 * because a piece has no meaning outside the drop it belongs to, and the drop
 * URL is the one that must survive forever.
 *
 * Everything §09 asks for is a FIELD on the product record, resolved here:
 * gallery by role, per-size sold-out state, fabric, GSM, care, fit, model
 * height and worn size. Nothing on this page is prose that happens to mention
 * a fact — the spec table and the invoice read the same columns.
 */
export const load: PageServerLoad = async ({ params, locals }) => {
	const drop = await drops.findBySlug(params.drop);
	if (!drop) error(404, 'No such drop');

	const product = drop.products.find((item) => item.slug === params.product);
	if (!product) error(404, 'No such piece in this drop');

	const stage = resolveStage(DROP_01_SCHEDULE, locals.now);

	/**
	 * §10 — resolved SERVER-SIDE through the SAME function the cart uses, so the
	 * page and the basket can never quote different prices for the same piece.
	 *
	 * This used to derive the price and the pre-order flag from the clock here,
	 * separately from $lib/server/cart/pricing. The two then disagreed on a
	 * manual push (§06 state 2): the page offered "Reserve this piece" at the
	 * tease price while the cart charged the launch price for an open sale.
	 * One authority now.
	 */
	const { unitPrice, isPreOrder } = resolvePrice(drop, product, locals.now);
	const displayPrice: Paise = unitPrice;
	const showPrelaunchPrice = displayPrice === product.prelaunchPrice;

	const finished = isFinished(drop.state);
	const onSale = isOnSale(drop.state);

	// §06: every size is listed. The sold-out ones are flagged, not removed.
	const offers: SizeOffer[] = product.variants.map((variant) => ({
		variantId: variant.id,
		size: variant.size,
		sku: variant.sku,
		soldOut: isSizeSoldOut(variant),
		remaining: sellableStock(variant)
	}));

	return {
		drop: {
			slug: drop.slug,
			number: drop.number,
			name: drop.name,
			state: drop.state,
			story: drop.story,
			editionSize: drop.editionSize
		},
		product,
		offers,
		displayPrice,
		showPrelaunchPrice,
		onSale,
		finished,
		/** §06: the drop's own state can open notify-me on every size. */
		notifyOpen: acceptsNotifyMe(drop.state),
		isPreOrder,
		launchInstant: LAUNCH_INSTANT,
		canRequest: acceptsDropRequest(drop.state),
		sizeOptions: product.variants.map((variant) => ({
			value: variant.id,
			label: variant.size
		})),
		/** §09: "cross-sell within the drop" — the other pieces, never a catalogue. */
		alsoInDrop: drop.products
			.filter((item) => item.slug !== product.slug)
			.map((item) => ({
				slug: item.slug,
				name: item.name,
				image: item.images.find((image) => image.role === 'lead') ?? item.images[0] ?? null,
				price: showPrelaunchPrice ? item.prelaunchPrice : item.launchPrice
			}))
	};
};

export const actions: Actions = {
	/** §06 — notify-me sits on every sold-out piece and size. */
	notify: (event) => handleNotifyMe(event, 'product_page'),
	/** §12 — once the drop is finished, the piece page can still take demand. */
	requestDrop: (event) => handleRequestDrop(event, 'product_page')
};
