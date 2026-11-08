/**
 * Studio front and back shots for the 3D hero, by drop and product slug.
 *
 * Both are transparent WebPs cropped to one shared box, so front and back
 * stay registered (prepared from the T-pose shots in "new images/"). A
 * product without an entry keeps the single-photo cloth hero.
 *
 * Kept here while the hero is being chosen; once a mode is settled these
 * belong on the product record as image roles, managed from admin.
 */
export type TeeShots = {
	front: string;
	back: string;
	/** Smaller copies for low-power devices. */
	frontSmall: string;
	backSmall: string;
	width: number;
	height: number;
	alt: string;
	/**
	 * The 3D tee's own first frame, rendered once (see docs/tee-model.md).
	 * Shown while the 3D loads, so the swap to the live canvas is invisible.
	 */
	poster: string;
	posterSmall: string;
};

const SHOTS: Record<string, TeeShots> = {
	'01-pineapple-haze/tee': {
		front: '/images/drop-01/tee-front-1024.webp',
		back: '/images/drop-01/tee-back-1024.webp',
		frontSmall: '/images/drop-01/tee-front-640.webp',
		backSmall: '/images/drop-01/tee-back-640.webp',
		width: 1024,
		height: 783,
		alt: 'The Pineapple Haze tee: script and tree on the chest, the embroidered bud across the back',
		poster: '/images/drop-01/tee-poster-1600.webp',
		posterSmall: '/images/drop-01/tee-poster-800.webp'
	}
};

export function teeShotsFor(dropSlug: string, productSlug: string): TeeShots | null {
	return SHOTS[`${dropSlug}/${productSlug}`] ?? null;
}
