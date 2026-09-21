/**
 * RW-037 — Drop 01 fixture.
 *
 * Shaped exactly like the eventual `drops` / `products` / `product_variants` /
 * `edition_units` rows, so Phase 2 transcribes rather than redesigns.
 *
 * Figures are the brief's settled ones: §08 25 hand-numbered pieces, §09
 * 30% hemp / 70% cotton at 180 GSM, §10 ₹4,100 at launch and ₹3,400 pre-launch.
 */
import type { Drop } from '$lib/domain/drop';
import { LAUNCH_INSTANT } from '$lib/drop/schedule';
import { LAUNCH_PRICE, PRELAUNCH_PRICE, EDITION_SIZE } from '$lib/config/commerce';
import { SIZES } from '$lib/drop/sizes';
import { buildSku } from '$lib/catalogue/sku';

/** 25 pieces across five sizes. Deliberately uneven — the middle sizes run deeper. */
const STOCK_BY_SIZE: Record<string, number> = { XS: 3, S: 5, M: 7, L: 6, XL: 4 };

/** Reservations taken during the tease. §07's claimed counter reads this. */
const RESERVED_BY_SIZE: Record<string, number> = { XS: 1, S: 2, M: 4, L: 2, XL: 1 };

export const DROP_01: Drop = {
	id: 'drop-01',
	slug: '01-pineapple-haze',
	number: 1,
	name: 'Pineapple Haze',
	story:
		'Our first growth: a tactile everyday uniform made with hemp-led fabric, quiet colour ' +
		'and a shape designed to gather character over time.',
	state: 'TEASE',
	launchInstant: LAUNCH_INSTANT,
	archivedAt: null,
	editionSize: EDITION_SIZE,
	products: [
		{
			id: 'product-01-tee',
			dropId: 'drop-01',
			slug: 'tee',
			name: 'Pineapple Haze Tee',
			summary: 'Hemp-cotton jersey, relaxed oversized, one of twenty-five hand-numbered pieces.',
			// §09: fields, not prose, so they render identically everywhere.
			fabric: '30% hemp / 70% cotton',
			gsm: 180,
			care: ['Wash cold', 'Line dry', 'No bleach'],
			fit: 'Relaxed oversized',
			modelHeightCm: 178,
			modelWornSize: 'M',
			images: [
				{
					url: '/images/pineapple-haze-front.jpg',
					alt: 'Pineapple Haze hemp-cotton T-shirt worn from the front',
					role: 'lead'
				},
				{
					url: '/images/pineapple-haze-back.jpg',
					alt: 'The back of the Pineapple Haze T-shirt, showing the tree artwork',
					role: 'detail'
				},
				{
					url: '/images/pineapple-haze-shirt-cutout.png',
					alt: 'Close-up of the hemp-cotton jersey, showing the weave',
					role: 'fabric'
				},
				{
					url: '/images/pineapple-haze-editorial.jpg',
					alt: 'The Pineapple Haze T-shirt worn, photographed in the campaign',
					role: 'worn'
				}
			],
			variants: SIZES.map((size) => ({
				id: `variant-01-tee-${size.toLowerCase()}`,
				productId: 'product-01-tee',
				sku: buildSku(1, 'TEE', size),
				size,
				stockCount: STOCK_BY_SIZE[size],
				reservedCount: RESERVED_BY_SIZE[size]
			})),
			launchPrice: LAUNCH_PRICE,
			prelaunchPrice: PRELAUNCH_PRICE
		}
	]
};
