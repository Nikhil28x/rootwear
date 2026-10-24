/**
 * RW-032 — sizes.
 *
 * §09 began with one fixed axis, XS · S · M · L · XL, and Drop 01 still
 * uses exactly that. Later drops pick their own sizes from public.sizes
 * (XXS to 5XL, and One size), edited in admin, so a size is a short code
 * string rather than a member of a fixed union.
 *
 * SIZES and SIZE_CHART remain as Drop 01's run and measurements: the fixtures
 * use them, and a product without a size chart of its own falls back to them.
 */
export type Size = string;

/** Drop 01's run. New drops choose their own sizes in admin. */
export const SIZES = ['XS', 'S', 'M', 'L', 'XL'] as const;

/** Every size code the catalogue knows, in display order. Mirrors public.sizes. */
export const SIZE_ORDER = [
	'XXS',
	'XS',
	'S',
	'M',
	'L',
	'XL',
	'XXL',
	'3XL',
	'4XL',
	'5XL',
	'OS'
] as const;

const SIZE_CODE = /^[A-Z0-9]{1,5}$/;

/** A well-formed size code: 1–5 capitals or digits. */
export function isSize(value: string): value is Size {
	return SIZE_CODE.test(value);
}

/** Display order: known sizes by SIZE_ORDER, anything else after them alphabetically. */
export function compareSizes(a: Size, b: Size): number {
	const ia = (SIZE_ORDER as readonly string[]).indexOf(a);
	const ib = (SIZE_ORDER as readonly string[]).indexOf(b);
	if (ia === -1 && ib === -1) return a.localeCompare(b);
	if (ia === -1) return 1;
	if (ib === -1) return -1;
	return ia - ib;
}

/** "XS — XL" for any run of sizes; "One size" for a single OS. */
export function sizeRangeLabel(sizes: readonly Size[]): string {
	const sorted = [...new Set(sizes)].sort(compareSizes);
	if (sorted.length === 0) return '';
	if (sorted.length === 1) return sorted[0] === 'OS' ? 'One size' : sorted[0];
	return `${sorted[0]} — ${sorted[sorted.length - 1]}`;
}

/** Human-readable range for Drop 01's spec tables. */
export const SIZE_RANGE_LABEL = sizeRangeLabel(SIZES);

/**
 * §09 — MANDATORY wherever a size is shown, on product detail and the size
 * guide. Fit mistakes are the single biggest returns driver in this category
 * and returns here are defects-only, so a bad fit becomes a support problem.
 */
export const FIT_DISCLAIMER = 'The fit is oversized. Women may want to size down.';

/**
 * §09 — the size guide must carry REAL measurements in cm, chest and length,
 * per size. "Oversized" without numbers is what causes the returns.
 */
export type SizeMeasurement = { chestCm: number; lengthCm: number };

/** Drop 01's measurements, and the fallback for a product with no chart of its own. */
export const SIZE_CHART: Record<string, SizeMeasurement> = {
	XS: { chestCm: 104, lengthCm: 68 },
	S: { chestCm: 110, lengthCm: 70 },
	M: { chestCm: 116, lengthCm: 72 },
	L: { chestCm: 122, lengthCm: 74 },
	XL: { chestCm: 128, lengthCm: 76 }
};

/** The measurements above are provisional until the spec sheet is supplied. */
export const SIZE_CHART_IS_PROVISIONAL = true;

/** One row of a product's size guide. */
export type SizeChartRow = {
	readonly size: Size;
	readonly chestCm: number;
	readonly lengthCm: number;
};

/**
 * The size guide for a product: its own chart where it has one, otherwise
 * Drop 01's figures for whichever of its sizes they cover. Always in display
 * order, one row per size the product is actually cut in.
 */
export function chartFor(product: {
	readonly sizeChart?: readonly SizeChartRow[];
	readonly variants: readonly { readonly size: Size }[];
}): SizeChartRow[] {
	const sizes = [...new Set(product.variants.map((v) => v.size))].sort(compareSizes);
	const own = new Map((product.sizeChart ?? []).map((row) => [row.size, row]));
	return sizes
		.map((size) => {
			const row = own.get(size);
			if (row) return row;
			const fallback = SIZE_CHART[size];
			return fallback ? { size, chestCm: fallback.chestCm, lengthCm: fallback.lengthCm } : null;
		})
		.filter((row): row is SizeChartRow => row !== null);
}
