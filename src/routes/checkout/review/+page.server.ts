import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { cartRepository, closeCart, loadCart, readCartToken } from '$lib/server/cart';
import { clearShipTo, readShipTo, readShipValues } from '$lib/server/cart/ship-session';
import { paymentProvider } from '$lib/server/payments';
import { COMMIT_MESSAGE } from '$lib/checkout/messages';
import { validateAddress, hasErrors } from '$lib/checkout/address';
import { LAUNCH_INSTANT } from '$lib/drop/schedule';

/**
 * §03 template 07 — Checkout, step two: confirm and place.
 *
 * THE ORDER TOTAL IS NOT POSTED FROM HERE. app.commit_order() takes no amount
 * parameter at all: it locks the cart and every variant, re-resolves each
 * price from the drop's own launch instant, snapshots it onto the order line
 * and computes the total in the same transaction (§04). What this action
 * sends is an address, a shipping rate read from public.shipping_rates, a
 * coupon CODE, and an idempotency key.
 *
 * THE IDEMPOTENCY KEY IS DERIVED SERVER-SIDE from the cart token, never posted
 * by the browser. A client-supplied key would be a guess away from returning
 * somebody else's order: app.commit_order() replays by key and hands back that
 * order's public token. Deriving it from an httpOnly, 32-random-byte cart
 * token makes it unguessable, and dropping the cart cookie on success means
 * the next basket gets a fresh key rather than replaying this order forever.
 */

export const load: PageServerLoad = async ({ cookies, locals }) => {
	const cart = await loadCart(cookies, locals.now);
	if (cart.lines.length === 0) redirect(303, '/cart');

	// The address is re-validated on the way out of the cookie as well as on
	// the way in. A hand-edited cookie sends the visitor back to the form.
	const ship = readShipTo(cookies);
	if (!ship) redirect(303, '/checkout/information');

	const provider = paymentProvider();

	return {
		cart,
		ship,
		launchInstant: LAUNCH_INSTANT,
		serverNow: locals.now,
		payment: {
			name: provider.name,
			configured: provider.isConfigured
		}
	};
};

export const actions: Actions = {
	place: async ({ cookies, locals }) => {
		const token = readCartToken(cookies);
		if (!token) redirect(303, '/cart');

		/**
		 * Priced one last time from the catalogue, on the server clock. The
		 * shipping rate that goes to commit_order comes from here, not the page.
		 *
		 * An EMPTY cart is deliberately not short-circuited. A double-submit
		 * arrives with the same cart token after the first commit already
		 * emptied the cart, and bailing out here would send the customer to an
		 * empty basket instead of the order they just placed.
		 * app.commit_order() checks its idempotency key BEFORE it looks at the
		 * cart, so letting the call through is what produces 'replayed'. A
		 * genuinely empty cart with no prior order comes back 'empty_cart'.
		 */
		const view = await loadCart(cookies, locals.now);

		const values = readShipValues(cookies);
		const ship = readShipTo(cookies);
		if (!values || !ship || hasErrors(validateAddress(values))) {
			redirect(303, '/checkout/information');
		}

		// §10 again, at order creation and not only at the form: serviceability
		// can change between the two steps.
		const exclusion = await cartRepository.pincodeExclusion(ship.pincode);
		if (exclusion) {
			return fail(409, { problem: exclusion, status: 'out_of_stock' as const });
		}

		const outcome = await cartRepository.commitOrder({
			idempotencyKey: `cart:${token}`,
			cartToken: token,
			ship,
			shipping: view.totals.shipping,
			// A CODE. app.redeem_coupon() re-validates it against the order's own
			// stored subtotal — this is never an amount (§10).
			couponCode: view.couponCode
		});

		if (outcome.status === 'empty_cart') {
			// No lines and no prior order under this key. The cart page explains
			// the empty state; an address form for nothing does not.
			closeCart(cookies);
			clearShipTo(cookies);
			redirect(303, '/cart');
		}

		if (outcome.status === 'out_of_stock') {
			// A real outcome with a real destination: the cart is still intact,
			// nothing was charged, and the page says which piece went.
			return fail(409, {
				problem: COMMIT_MESSAGE.out_of_stock,
				status: 'out_of_stock' as const
			});
		}

		if (!outcome.publicToken) {
			return fail(500, {
				problem: 'The order was not recorded. Nothing has been charged — please try again.',
				status: 'out_of_stock' as const
			});
		}

		/**
		 * §04: the gateway order is created only on a FRESH commit. A replay is
		 * the same order arriving twice, and minting a second payment intent for
		 * it is how a customer ends up charged twice.
		 */
		if (outcome.status === 'committed' && outcome.orderId) {
			const provider = paymentProvider();
			if (provider.isConfigured) {
				// The amount comes off the ORDER, which the database computed.
				const order = await cartRepository.findOrderByToken(outcome.publicToken);
				if (order) {
					try {
						const gatewayOrder = await provider.createOrder({
							amount: order.total,
							reference: order.orderNumber,
							kind: 'order',
							email: order.email
						});

						await cartRepository.recordPaymentIntent({
							orderId: outcome.orderId,
							reservationId: null,
							kind: 'order',
							gateway: gatewayOrder.gateway,
							gatewayOrderId: gatewayOrder.gatewayOrderId,
							amount: gatewayOrder.amount
						});
					} catch (cause) {
						// The order exists and is unpaid, which is a recoverable state.
						// Losing the gateway handoff must not lose the order.
						console.error('[checkout] gateway order failed', cause);
					}
				}
			}
		}

		// The cart is spent. Dropping the cookie retires its idempotency key, so
		// the next basket is a new order rather than a replay of this one.
		closeCart(cookies);
		clearShipTo(cookies);

		redirect(303, `/checkout/processing?order=${outcome.publicToken}`);
	}
};
