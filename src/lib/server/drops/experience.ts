/**
 * The product experience — one load for the drop URL and the piece URL.
 *
 * A drop and its piece used to be two pages that repeated each other: the
 * drop page carried the story, poster, countdown and demand forms; the piece
 * page carried the gallery, sizes and add-to-cart. Both URLs now render the
 * same experience from this one function, so the two can never drift.
 *
 * §05: the drop URL survives the drop's whole life and is never redirected.
 * It renders its lead piece. The piece URL renders that piece, and points
 * search engines at the drop URL when the drop has only the one piece.
 */
import type { Cookies } from '@sveltejs/kit';
import type { Drop, Product } from '$lib/domain/drop';
import { claimedCount, variantLabel } from '$lib/domain/drop';
import { acceptsDeposits, acceptsNotifyMe, isOnSale } from '$lib/domain/drop-state';
import { acceptsDropRequest, isFinished } from '$lib/components/drop/marks';
import { resolveStage } from '$lib/drop/stage-resolver';
import { scheduleFor } from '$lib/drop/schedule';
import { resolvePrice } from '$lib/server/cart/pricing';
import { sizeOffers } from '$lib/server/cart/availability';

export async function loadExperience(
	drop: Drop,
	product: Product,
	{ now, cookies }: { now: number; cookies: Cookies }
) {
	// §10 — the same price authority the cart uses, so page and basket agree.
	const { unitPrice, isPreOrder, priceSource, regularPrice } = resolvePrice(drop, product, now);
	const showPrelaunchPrice =
		priceSource === 'prelaunch_locked' && unitPrice !== product.launchPrice;
	// 0036: a founder's price shows the launch price struck through under it.
	const offer = priceSource === 'offer' && product.offer ? product.offer : null;

	// A hidden price is never sent to the browser, and the piece isn't for
	// sale while it is hidden: the buy bar falls back to notify-me, which the
	// cart and checkout enforce on their side too.
	const priceShown = product.priceVisible;
	// The page shows displayPrice; the raw prices stay on the server.
	const {
		launchPrice: _launch,
		prelaunchPrice: _prelaunch,
		offer: _offer,
		...publicProduct
	} = product;

	const offers = await sizeOffers(product);

	const preLaunch = drop.state === 'TEASE' || drop.state === 'REVEALED';
	const single = drop.products.length === 1;

	return {
		drop: {
			slug: drop.slug,
			number: drop.number,
			name: drop.name,
			state: drop.state,
			story: drop.story,
			editionSize: drop.editionSize,
			preorderMode: priceShown && drop.preorderMode,
			launchInstant: drop.launchInstant,
			releasedAt: drop.archivedAt ?? drop.launchInstant
		},
		product: publicProduct,
		offers,
		/** Null while the price is hidden. */
		displayPrice: priceShown ? unitPrice : null,
		showPrelaunchPrice: priceShown && showPrelaunchPrice,
		/** While a founder's price applies: the price it replaces, and its copy. */
		offer:
			priceShown && offer && regularPrice !== null
				? { regularPrice, label: offer.label, note: offer.note }
				: null,
		isPreOrder: priceShown && isPreOrder,
		onSale: priceShown && isOnSale(drop.state),
		finished: isFinished(drop.state),
		notifyOpen: acceptsNotifyMe(drop.state) || (!priceShown && !isFinished(drop.state)),
		canRequest: acceptsDropRequest(drop.state),
		acceptsDeposits: acceptsDeposits(drop.state),
		claimed: claimedCount(drop),
		showCountdown: preLaunch,
		// This drop's own tease run, from its own launch instant.
		stage: resolveStage(scheduleFor(drop.launchInstant), now),
		sizeOptions: product.variants.map((variant) => ({
			value: variant.id,
			label: variantLabel(product, variant)
		})),
		canonicalPath: single ? `/drops/${drop.slug}` : `/drops/${drop.slug}/${product.slug}`,
		/** §09: "cross-sell within the drop" — the other pieces, never a catalogue. */
		alsoInDrop: drop.products
			.filter((item) => item.slug !== product.slug)
			.map((item) => ({
				slug: item.slug,
				name: item.name,
				image: item.images.find((image) => image.role === 'lead') ?? item.images[0] ?? null,
				price: !item.priceVisible ? null : resolvePrice(drop, item, now).unitPrice
			}))
	};
}

export type Experience = Awaited<ReturnType<typeof loadExperience>>;
