/**
 * RW-032 — §09: one variant axis only, XS · S · M · L · XL.
 *
 * Explicitly NO colour axis: §09 instructs that a colour axis "would sit
 * unused and complicate every screen". The repo previously advertised
 * "XS — XXL", which is a size that does not exist in this drop.
 */
export const SIZES = ['XS', 'S', 'M', 'L', 'XL'] as const;

export type Size = (typeof SIZES)[number];

export function isSize(value: string): value is Size {
	return (SIZES as readonly string[]).includes(value);
}

/** Human-readable range for spec tables. */
export const SIZE_RANGE_LABEL = `${SIZES[0]} — ${SIZES[SIZES.length - 1]}`;

/**
 * §09 — MANDATORY wherever a size is shown, on product detail and the size
 * guide. Fit mistakes are the single biggest returns driver in this category
 * and returns here are defects-only, so a bad fit becomes a support problem.
 */
export const FIT_DISCLAIMER =
	'The fit is oversized. Women may want to size down.';

/**
 * §09 — the size guide must carry REAL measurements in cm, chest and length,
 * per size. "Oversized" without numbers is what causes the returns.
 * Figures are placeholders until the garment spec lands with the asset pack.
 */
export type SizeMeasurement = { chestCm: number; lengthCm: number };

export const SIZE_CHART: Record<Size, SizeMeasurement> = {
	XS: { chestCm: 104, lengthCm: 68 },
	S: { chestCm: 110, lengthCm: 70 },
	M: { chestCm: 116, lengthCm: 72 },
	L: { chestCm: 122, lengthCm: 74 },
	XL: { chestCm: 128, lengthCm: 76 }
};

/** The measurements above are provisional until the spec sheet is supplied. */
export const SIZE_CHART_IS_PROVISIONAL = true;
