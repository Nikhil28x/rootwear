/**
 * RW-058 groundwork — §07: "STAGE ASSETS loaded from a MANIFEST so creative can
 * be swapped without a deploy; preload the next stage so the daily change is
 * instant."
 *
 * Today this is a typed module; RW-058 moves the source to Supabase Storage so
 * creative can swap assets without a deploy. The SHAPE here is the shape the
 * Storage-backed loader returns, so that swap is mechanical.
 *
 * §07 also requires every stage to read as a composed still, because the page
 * is meant to be screenshotted and shared.
 */

export type StageAsset = {
	/** Zero-based stage index. */
	readonly index: number;
	readonly label: string;
	/** A few lines, not a paragraph wall (§07). */
	readonly note: string;
	readonly image: string;
	readonly srcset: string;
	readonly video: string | null;
	readonly alt: string;
	/** True while this stage is still running on placeholder art (§07 risk note). */
	readonly isPlaceholder: boolean;
};

function stageImage(i: number) {
	return {
		image: `/images/drop-growth/hd/stage-${i}-1920.webp`,
		srcset:
			`/images/drop-growth/hd/stage-${i}-960.webp 960w, ` +
			`/images/drop-growth/hd/stage-${i}-1920.webp 1920w, ` +
			`/images/drop-growth/hd/stage-${i}-3840.webp 3840w`,
		video: `/video/drop-growth/hd/stage-${i}.mp4`
	};
}

const COPY: ReadonlyArray<{ label: string; note: string }> = [
	{ label: 'Seedling', note: 'Every story starts small.' },
	{ label: 'Taking root', note: 'Quiet strength, beneath the surface.' },
	{ label: 'Rising', note: 'A little taller. A little closer.' },
	{ label: 'Branching', note: 'Our first growth is taking shape.' },
	{ label: 'Reaching', note: 'New branches. The same roots.' },
	{ label: 'Almost there', note: 'The final days before the first drop.' },
	{ label: 'Full growth', note: 'The wait is over. Meet Drop 001.' }
];

/**
 * §14 constrains this alt text: hemp and sustainability claims stay provable,
 * and no unsupported environmental claim appears anywhere "including in
 * campaign copy and ALT TEXT". These describe what is pictured, nothing more.
 */
export const STAGE_MANIFEST: ReadonlyArray<StageAsset> = COPY.map((copy, i) => ({
	index: i,
	label: copy.label,
	note: copy.note,
	...stageImage(i),
	alt: `${copy.label}: the hemp plant in the forest, at stage ${i + 1} of ${COPY.length}.`,
	isPlaceholder: false
}));

export const STAGE_COUNT = STAGE_MANIFEST.length;

export function stageAt(index: number): StageAsset {
	return STAGE_MANIFEST[Math.min(Math.max(index, 0), STAGE_COUNT - 1)];
}

/** §07: preload one ahead so the daily change is instant. */
export function nextStageAsset(index: number): StageAsset | null {
	return index + 1 < STAGE_COUNT ? STAGE_MANIFEST[index + 1] : null;
}
