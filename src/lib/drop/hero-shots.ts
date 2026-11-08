/**
 * The hero cloth's images for a piece, by drop and product slug: a front and
 * a back cutout, and each side's baked surface maps (normal + displacement).
 * All prepared by scripts/prepare-hero-shots.mjs from the studio renders in
 * "new images/" (front fake.png, back fake.png), registered to one frame.
 *
 * A piece without an entry keeps the single cutout from its product record
 * (image role "fabric"), front only. Once settled, these belong on the
 * product record as image roles, managed from admin.
 */
import type { ClothMaps } from '$lib/components/product/cloth-scene';

export type HeroShots = {
	front: { src: string; alt: string; width: number; height: number };
	back: { src: string; alt: string };
	maps: ClothMaps;
};

const SHOTS: Record<string, HeroShots> = {
	'01-pineapple-haze/tee': {
		front: {
			src: '/images/drop-01/tee-cutout-front.webp',
			alt: 'The Pineapple Haze tee from the front: the script and the tree embroidered on the chest',
			width: 1152,
			height: 1254
		},
		back: {
			src: '/images/drop-01/tee-cutout-back.webp',
			alt: 'The Pineapple Haze tee from the back: the embroidered bud between the shoulders'
		},
		maps: {
			frontNormal: '/images/drop-01/tee-front-normal.webp',
			frontHeight: '/images/drop-01/tee-front-height.webp',
			backNormal: '/images/drop-01/tee-back-normal.webp',
			backHeight: '/images/drop-01/tee-back-height.webp'
		}
	}
};

export function heroShotsFor(dropSlug: string, productSlug: string): HeroShots | null {
	return SHOTS[`${dropSlug}/${productSlug}`] ?? null;
}
