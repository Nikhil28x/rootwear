/**
 * Every server status the checkout can return, mapped to the exact words a
 * customer reads.
 *
 * §10 asks for server-side coupon validation; a typed status is only half of
 * that. A status rendered as "error" teaches the customer nothing and costs a
 * support email, so each one gets a specific sentence that says what happened
 * and what to do next.
 *
 * Client-safe on purpose: the same map is used by the form action's return
 * value and by the component, so there is one wording, not two.
 */
import type { CouponStatus } from '$lib/server/cart/types';

export const COUPON_MESSAGE: Record<CouponStatus, string> = {
	ok: 'Applied.',
	not_found: 'We do not recognise that code. Check it for a stray space or a wrong letter.',
	inactive: 'That code is no longer being accepted.',
	expired: 'That code has passed its end date.',
	not_yet_valid: 'That code has not started yet.',
	exhausted: 'That code has been used the number of times it was issued for.',
	below_minimum: 'Your cart is below the minimum this code applies to.',
	// §10: "a coupon must NEVER be applicable to a deposit or a balance payment."
	not_applicable_to_deposit:
		'Codes do not apply to a deposit or a balance payment. This one is kept for a full order.'
};

/**
 * The four outcomes app.commit_order() can return. Each needs a real
 * destination, not a shrug: 'replayed' is a SUCCESS (the customer pressed
 * submit twice and gets their one order back), and 'out_of_stock' at a
 * twenty-five-piece drop is an ordinary Tuesday, not an exception.
 */
export const COMMIT_MESSAGE = {
	committed: 'Order placed.',
	replayed: 'You already placed this order — here it is.',
	out_of_stock:
		'Someone reached the last of that size while you were checking out. Nothing has been ' +
		'charged. Your cart is below with what is still available.',
	empty_cart: 'There is nothing in your cart to order.'
} as const;

/** §10: a short cart-reservation window, released automatically. */
export const HOLD_EXPIRED_MESSAGE =
	'Your hold has lapsed and the stock went back on sale. We have re-checked your cart against ' +
	'what is left.';

export const PAYMENT_NOT_CONFIGURED_MESSAGE =
	'Card payment is not switched on yet. Your order is recorded and unpaid — we will write to ' +
	'you with a payment link before anything is cut.';
