/**
 * RW-035 — §09 SKU convention: RW-D01-TEE-M.
 * brand · drop · style · size. "Agree it once and never re-cut it."
 */
import { isSize, type Size } from '$lib/drop/sizes';

const BRAND = 'RW';
const SKU_PATTERN = /^RW-D(\d{2})-([A-Z]{2,5})-(XS|S|M|L|XL)$/;

export type SkuParts = { dropNumber: number; style: string; size: Size };

export function buildSku(dropNumber: number, style: string, size: Size): string {
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
	return `${BRAND}-D${String(dropNumber).padStart(2, '0')}-${styleCode}-${size}`;
}

export function parseSku(sku: string): SkuParts | null {
	const match = SKU_PATTERN.exec(sku);
	if (!match) return null;
	return { dropNumber: Number(match[1]), style: match[2], size: match[3] as Size };
}

export function isValidSku(sku: string): boolean {
	return SKU_PATTERN.test(sku);
}
