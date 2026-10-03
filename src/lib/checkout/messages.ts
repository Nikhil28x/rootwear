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
	not_found: "We don't recognise that code. Check the spelling and try again.",
	inactive: 'This code is no longer active.',
	expired: 'This code has expired.',
	not_yet_valid: "This code isn't active yet.",
	exhausted: 'This code has already been used.',
	below_minimum: "Your cart doesn't meet the minimum spend for this code.",
	// §10: "a coupon must NEVER be applicable to a deposit or a balance payment."
	not_applicable_to_deposit: "Codes can't be used on deposits or balance payments."
};

/**
 * The four outcomes app.commit_order() can return. Each needs a real
 * destination, not a shrug: 'replayed' is a SUCCESS (the customer pressed
 * submit twice and gets their one order back), and 'out_of_stock' at a
 * twenty-five-piece drop is an ordinary Tuesday, not an exception.
 */
export const COMMIT_MESSAGE = {
	committed: 'Order placed.',
	replayed: "Here's your order.",
	out_of_stock:
		'Sorry — that size just sold out. You have not been charged. Your cart has been updated ' +
		"with what's still available.",
	empty_cart: 'Your cart is empty.'
} as const;

/** §10: a short cart-reservation window, released automatically. */
export const HOLD_EXPIRED_MESSAGE =
	"Your reservation expired — we've updated your cart with what's still available.";

export const PAYMENT_NOT_CONFIGURED_MESSAGE =
	"Online payment isn't available right now. We'll email you a payment link.";
