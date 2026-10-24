/**
 * RW-035 — §09 SKU convention: RW-D01-TEE-M.
 * brand · drop · style · [colour ·] size. "Agree it once and never re-cut it."
 *
 * Drop 01 has no colour part. A product with colourways adds the colourway's
 * code before the size: RW-D02-TEE-BLK-XXL.
 */
import { isSize, type Size } from '$lib/drop/sizes';

const BRAND = 'RW';
const SKU_PATTERN = /^RW-D(\d{2})-([A-Z]{2,5})(?:-([A-Z]{2,4}))?-([A-Z0-9]{1,5})$/;

export type SkuParts = { dropNumber: number; style: string; colour: string | null; size: Size };

export function buildSku(dropNumber: number, style: string, size: Size, colour?: string | null): string {
	if (!Number.isInteger(dropNumber) || dropNumber < 1 || dropNumber > 99) {
		throw new RangeError(`Drop number must be 1-99, received ${dropNumber}`);
	}
	const styleCode = style.toUpperCase();
	if (!/^[A-Z]{2,5}$/.test(styleCode)) {
		throw new TypeError(`Style code must be 2-5 letters, received "${style}"`);
	}
	if (!isSize(size)) {
		throw new TypeError(`Unknown size "${size}"`);
	}
	const colourCode = colour ? colour.toUpperCase() : null;
	if (colourCode && !/^[A-Z]{2,4}$/.test(colourCode)) {
		throw new TypeError(`Colour code must be 2-4 letters, received "${colour}"`);
	}
	return [BRAND, `D${String(dropNumber).padStart(2, '0')}`, styleCode, colourCode, size]
		.filter(Boolean)
		.join('-');
}

export function parseSku(sku: string): SkuParts | null {
	const match = SKU_PATTERN.exec(sku);
	if (!match) return null;
	return {
		dropNumber: Number(match[1]),
		style: match[2],
		colour: match[3] ?? null,
		size: match[4]
	};
}

export function isValidSku(sku: string): boolean {
	return SKU_PATTERN.test(sku);
}
