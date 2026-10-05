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
	/**
	 * §06 state 2. TEASE is the drop's pre-launch state; LIVE is what §06 calls
	 * the "manual push", the override an operator uses to open a drop without
	 * waiting for the scheduled instant.
	 *
	 * Set to LIVE so the store is shoppable now. To put the drop back behind
	 * its tease, change this one value to 'TEASE' — the countdown, the deposit
	 * path and the greyed sizes all key off it. Once the launch instant passes,
	 * RW-041 (src/lib/domain/publish.ts) opens the drop on its own, whatever is
	 * stored here.
	 */
	state: 'LIVE',
	launchInstant: LAUNCH_INSTANT,
	archivedAt: null,
	editionSize: EDITION_SIZE,
	preorderMode: false,
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
			// The campaign shoot. The first image of each role is the one a page
			// asks for; the further details fill the galleries in order.
			images: [
				{
					url: '/images/drop-01/front-1600.webp',
					width: 1600,
					height: 2000,
					alt: 'The Pineapple Haze tee worn from the front: the tree and the script embroidered on the chest',
					role: 'lead',
					caption: 'Front'
				},
				{
					url: '/images/drop-01/back-1600.webp',
					width: 1600,
					height: 2000,
					alt: 'The back of the Pineapple Haze tee, with the embroidered bud between the shoulders',
					role: 'detail',
					caption: 'Back'
				},
				{
					url: '/images/pineapple-haze-shirt-cutout.png',
					width: 1152,
					height: 1366,
					alt: 'The Pineapple Haze tee, laid flat',
					role: 'fabric',
					caption: 'The piece'
				},
				{
					url: '/images/drop-01/worn-2400.webp',
					width: 2400,
					height: 1946,
					alt: 'Two people in the Pineapple Haze tee, one turned to show the back',
					role: 'worn',
					caption: 'Worn'
				},
				{
					url: '/images/drop-01/sitting-1600.webp',
					width: 1600,
					height: 2000,
					alt: 'Sitting on the studio floor in the Pineapple Haze tee and brown cargo trousers',
					role: 'detail',
					caption: 'Sitting'
				},
				{
					url: '/images/drop-01/pair-1600.webp',
					width: 1600,
					height: 1000,
					alt: 'The tee from the front and from the back, worn side by side',
					role: 'detail',
					caption: 'Front and back'
				},
				{
					url: '/images/drop-01/floor-1600.webp',
					width: 1600,
					height: 1600,
					alt: 'Leaning back on one arm in the Pineapple Haze tee',
					role: 'detail',
					caption: 'At ease'
				},
				{
					url: '/images/drop-01/standing-1600.webp',
					width: 1600,
					height: 2000,
					alt: 'The Pineapple Haze tee worn loose over brown cargo trousers',
					role: 'detail',
					caption: 'Worn loose'
				},
				{
					url: '/images/drop-01/seated-1600.webp',
					width: 1600,
					height: 2000,
					alt: 'Two people in the Pineapple Haze tee, one seated',
					role: 'detail',
					caption: 'In pairs'
				},
				{
					url: '/images/drop-01/duo-1600.webp',
					width: 1600,
					height: 2000,
					alt: 'Two people standing in the Pineapple Haze tee',
					role: 'detail',
					caption: 'Together'
				},
				{
					url: '/images/drop-01/full-1600.webp',
					width: 1600,
					height: 2000,
					alt: 'Full length in the Pineapple Haze tee, one hand at the hem',
					role: 'detail',
					caption: 'Full length'
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
