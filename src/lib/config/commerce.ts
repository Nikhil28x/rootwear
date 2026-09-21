/**
 * RW-032 / RW-006 — Settled commercial figures from §08 and §10.
 *
 * The repo previously showed ₹3,490 in six places, which is a third number
 * matching neither settled price. These are the only price constants.
 */
import { fromRupees, splitByPercent, type Paise } from '$lib/money';

/** §10: ₹4,100 at launch. */
export const LAUNCH_PRICE: Paise = fromRupees(4100);

/** §10: ₹3,400 pre-launch, LOCKED for anyone who reserves during the tease (§08). */
export const PRELAUNCH_PRICE: Paise = fromRupees(3400);

/** §08: Drop 01 is 25 hand-numbered pieces. */
export const EDITION_SIZE = 25;

/**
 * §15 BLOCKING open item — "Deposit percentage", owner Aaron, was due 10 Sep.
 *
 * The requirements state this two contradictory ways: §B "half deposit to
 * reserve" and §F "60% upfront, 40% offline / later". Both cannot be printed.
 * Trone's reading, pending Aaron's written answer: 50% is the deposit shown to
 * the customer and 60/40 is the internal cash split.
 *
 * Shipped as ONE configurable value. Until RW-006 is answered, no percentage
 * is rendered anywhere in the UI — see `DEPOSIT_PERCENT_CONFIRMED`.
 */
export const DEPOSIT_PERCENT = 50;

/** Flip to true only when Aaron's written answer lands. Gates printing the %. */
export const DEPOSIT_PERCENT_CONFIRMED = false;

/** §10: COD off for Drop 01. §15 open item — the toggle exists either way. */
export const COD_ENABLED = false;

/** §10: India only. Enforced at the address form AND at order creation. */
export const ALLOWED_COUNTRIES = ['IN'] as const;

/** §10: short cart-reservation window during the drop rush, released automatically. */
export const CART_HOLD_MINUTES = 15;

/**
 * §08: deposit and balance, derived so they always sum back to the locked
 * price exactly. Never compute these two independently.
 */
export function depositAndBalance(lockedPrice: Paise): { deposit: Paise; balance: Paise } {
	const [deposit, balance] = splitByPercent(lockedPrice, DEPOSIT_PERCENT);
	return { deposit, balance };
}
