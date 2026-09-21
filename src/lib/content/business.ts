/**
 * RW-022 — Business identity and support channels, in one place.
 *
 * §14 requires the registered business name and address in the footer and on
 * every invoice. §11 requires email and Instagram DM on the contact page, in
 * the footer and in every transactional email. Nothing else in the codebase
 * may hardcode these values — a correction must be a one-line change here.
 *
 * Values marked PLACEHOLDER are §15 open items. `isPlaceholder()` reports
 * them, and the launch-gate check (RW-167) fails while any remain.
 */

/** Sentinel prefix for values still awaiting a §15 answer. */
const TBC = 'TBC::';

export type GstPosition =
	| { readonly registered: true; readonly gstin: string }
	| { readonly registered: false };

/** §14: sole proprietorship. */
export const ENTITY_TYPE = 'Sole proprietorship' as const;

export const BUSINESS_NAME = 'Rootwear Clothing';

/** §15 open item — "Business address", owner Aaron, was due 15 Sep. */
export const BUSINESS_ADDRESS = `${TBC}registered business address`;

/** §13: sending address on the registered domain. */
export const SUPPORT_EMAIL = 'hi@rootwear.in';

export const INSTAGRAM_HANDLE = '@rootwear';
export const INSTAGRAM_URL = 'https://instagram.com/rootwear';

/**
 * §15 open item — "GST registration position", owner Aaron, was due 15 Sep.
 * §10: displayed prices are INCLUSIVE either way. If registered, the invoice
 * must show the break-up and the GSTIN in the footer.
 */
export const GST_POSITION: GstPosition = { registered: false };

/** True when a value is still an unanswered §15 placeholder. */
export function isPlaceholder(value: string): boolean {
	return value.startsWith(TBC);
}

/** Render a placeholder visibly rather than silently shipping an empty string. */
export function displayValue(value: string): string {
	return isPlaceholder(value) ? `[${value.slice(TBC.length)} — to be supplied]` : value;
}

/** Every identity value the launch gate must confirm is real. RW-167 consumes this. */
export function outstandingPlaceholders(): string[] {
	const checked: Array<[string, string]> = [
		['BUSINESS_ADDRESS', BUSINESS_ADDRESS],
		['BUSINESS_NAME', BUSINESS_NAME],
		['SUPPORT_EMAIL', SUPPORT_EMAIL]
	];
	return checked.filter(([, v]) => isPlaceholder(v)).map(([k]) => k);
}
