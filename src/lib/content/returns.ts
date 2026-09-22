/**
 * §11 — the returns wording, in ONE place.
 *
 * "7 DAYS, DEFECTS ONLY. Stated on the product page, at checkout, in the
 *  confirmation email and on the returns policy page — THE SAME WORDING IN ALL
 *  FOUR PLACES."
 *
 * §18 launch gate checks that the wording is identical in all four. The only
 * way to guarantee that is for all four to read this constant, rather than for
 * four copies to be kept in sync by hand.
 */
export const RETURNS_WORDING =
	'Returns are accepted within 7 days of delivery for manufacturing defects only. ' +
	'We do not accept returns or exchanges for fit, colour or change of mind. ' +
	'Write to us with photographs and your order number and we will make it right.';

/** Shown next to a size selector, where the fit decision is actually made. */
export const RETURNS_SHORT = '7-day returns, defects only.';
