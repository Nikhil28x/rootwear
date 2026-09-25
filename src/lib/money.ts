/**
 * RW-031 — Money.
 *
 * Every money value in this build is INTEGER PAISE. Never a float, never a
 * rupee decimal, never a pre-formatted string in a data layer (§04: "never
 * accept a price from the client"; the order total is recomputed server-side).
 *
 * `Paise` is branded so a bare `number` cannot be assigned to a money field
 * without going through `paise()` or `fromRupees()`. That makes this module
 * the only legitimate place a money value is constructed.
 */

declare const PAISE: unique symbol;

/** An integer number of paise. 100 paise = ₹1. */
export type Paise = number & { readonly [PAISE]: true };

/** Construct Paise from an integer paise amount. */
export function paise(value: number): Paise {
	if (!Number.isInteger(value)) {
		throw new TypeError(`Paise must be an integer, received ${value}`);
	}
	return value as Paise;
}

/** Construct Paise from whole rupees. `fromRupees(4100)` -> 410000 paise. */
export function fromRupees(rupees: number): Paise {
	if (!Number.isInteger(rupees)) {
		throw new TypeError(`Use paise() for sub-rupee amounts, received ${rupees}`);
	}
	return paise(rupees * 100);
}

export const ZERO: Paise = paise(0);

export function addPaise(...values: Paise[]): Paise {
	return paise(values.reduce((sum, v) => sum + v, 0));
}

export function subPaise(a: Paise, b: Paise): Paise {
	return paise(a - b);
}

export function multiplyPaise(amount: Paise, quantity: number): Paise {
	if (!Number.isInteger(quantity)) {
		throw new TypeError(`Quantity must be an integer, received ${quantity}`);
	}
	return paise(amount * quantity);
}

/**
 * ROUNDING DIRECTION — half up, applied here and nowhere else.
 *
 * Used for the deposit split (§08), percentage coupons (§10) and GST
 * back-calculation (§10). `splitByPercent` is the only safe way to divide a
 * money value: it derives the remainder by subtraction so the two parts always
 * sum back to the original to the exact paise.
 */
function roundHalfUp(value: number): number {
	return Math.floor(value + 0.5);
}

export function percentOf(amount: Paise, percent: number): Paise {
	if (percent < 0 || percent > 100) {
		throw new RangeError(`Percent must be 0-100, received ${percent}`);
	}
	return paise(roundHalfUp((amount * percent) / 100));
}

/**
 * Split an amount into [part, remainder] by percentage.
 * `part + remainder === amount` holds exactly, for every percentage.
 * This is what guarantees deposit + balance === locked price (§08).
 */
export function splitByPercent(amount: Paise, percent: number): [Paise, Paise] {
	const part = percentOf(amount, percent);
	return [part, subPaise(amount, part)];
}

const INR_WHOLE = new Intl.NumberFormat('en-IN', {
	style: 'currency',
	currency: 'INR',
	minimumFractionDigits: 0,
	maximumFractionDigits: 0
});

const INR_FRACTION = new Intl.NumberFormat('en-IN', {
	style: 'currency',
	currency: 'INR',
	minimumFractionDigits: 2,
	maximumFractionDigits: 2
});

/**
 * Render for display ONLY. Call this at the render edge — no server module
 * returns a pre-formatted money string.
 *
 * formatInr(410000) -> "₹4,100"   formatInr(340000) -> "₹3,400"
 * Indian digit grouping applies above ₹99,999: 12345600 -> "₹1,23,456".
 */
export function formatInr(amount: Paise): string {
	const rupees = amount / 100;
	return amount % 100 === 0 ? INR_WHOLE.format(rupees) : INR_FRACTION.format(rupees);
}
