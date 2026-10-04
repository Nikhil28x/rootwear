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
import { claimedCount } from '$lib/domain/drop';
import { acceptsDeposits, acceptsNotifyMe, isOnSale } from '$lib/domain/drop-state';
import { acceptsDropRequest, isFinished } from '$lib/components/drop/marks';
import { resolveStage } from '$lib/drop/stage-resolver';
import { DROP_01_SCHEDULE } from '$lib/drop/schedule';
import { resolvePrice } from '$lib/server/cart/pricing';
import { currentCartId, sizeOffers } from '$lib/server/cart/availability';

export async function loadExperience(
	drop: Drop,
	product: Product,
	{ now, cookies }: { now: number; cookies: Cookies }
) {
	// §10 — the same price authority the cart uses, so page and basket agree.
	const { unitPrice, isPreOrder } = resolvePrice(drop, product, now);
	const showPrelaunchPrice = unitPrice === product.prelaunchPrice && unitPrice !== product.launchPrice;

	const cartId = await currentCartId(cookies);
	const offers = await sizeOffers(product, now, cartId);

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
			preorderMode: drop.preorderMode,
			launchInstant: drop.launchInstant,
			releasedAt: drop.archivedAt ?? drop.launchInstant
		},
		product,
		offers,
		displayPrice: unitPrice,
		showPrelaunchPrice,
		isPreOrder,
		onSale: isOnSale(drop.state),
		finished: isFinished(drop.state),
		notifyOpen: acceptsNotifyMe(drop.state),
		canRequest: acceptsDropRequest(drop.state),
		acceptsDeposits: acceptsDeposits(drop.state),
		claimed: claimedCount(drop),
		showCountdown: preLaunch,
		stage: resolveStage(DROP_01_SCHEDULE, now),
		sizeOptions: product.variants.map((variant) => ({ value: variant.id, label: variant.size })),
		canonicalPath: single ? `/drops/${drop.slug}` : `/drops/${drop.slug}/${product.slug}`,
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
}

export type Experience = Awaited<ReturnType<typeof loadExperience>>;
