/**
 * The idempotency-key namespace of one cart.
 *
 * Every order a cart places is committed under `cart:<token>:<fingerprint>`
 * (src/lib/server/checkout/place.ts). The prefix is therefore how the server
 * finds "this cart's own orders" without a cart_id column on app.orders: the
 * superseded-order sweep, the double-submit fallback and the coupon rule
 * ("a redemption held by this cart's own unpaid order does not count against
 * it") all key on it. Change the format here and nowhere else.
 */
export function cartKeyPrefix(cartToken: string): string {
	return `cart:${cartToken}:`;
}
