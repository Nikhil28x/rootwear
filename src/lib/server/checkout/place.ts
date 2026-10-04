import { fail, redirect, type Cookies } from '@sveltejs/kit';
import { cartRepository, closeCart, holdUntil, loadCart, readCartToken } from '$lib/server/cart';
import { clearShipTo } from '$lib/server/cart/ship-session';
import { cartKeyPrefix } from '$lib/server/cart/keys';
import { expireUnpaidOrders } from '$lib/server/checkout/expiry';
import type { OrderRecord, ShipTo, StoredCartLine } from '$lib/server/cart/types';
import { paymentProvider } from '$lib/server/payments';
import { COMMIT_MESSAGE } from '$lib/checkout/messages';

/**
 * §03 template 07 — place the order. One implementation, called by the
 * one-page checkout's action once the address has passed §10.
 *
 * THE ORDER TOTAL IS NOT POSTED. app.commit_order() takes no amount
 * parameter at all: it locks the cart and every variant, re-resolves each
 * price from the drop's own launch instant, snapshots it onto the order line
 * and computes the total in the same transaction (§04). What this sends is an
 * address, a shipping rate read from public.shipping_rates, a coupon CODE, and
 * an idempotency key.
 *
 * THE IDEMPOTENCY KEY IS DERIVED SERVER-SIDE from the cart token, never posted
 * by the browser. A client-supplied key would be a guess away from returning
 * somebody else's order: app.commit_order() replays by key and hands back that
 * order's public token. Deriving it from an httpOnly, 32-random-byte cart
 * token makes it unguessable.
 *
 * THE CART OUTLIVES AN UNPAID ORDER. app.commit_order() empties the cart's
 * lines in its transaction; this module puts them straight back, so a buyer
 * who closes the payment window comes back to the same cart. The key also
 * carries a fingerprint of what is being bought (lines, code, address): the
 * same cart checked out again replays the SAME pending order — no second
 * order, no second stock decrement — while a changed cart or address gets a
 * new key and a new order. The cart is retired only once the order is paid
 * (settleCheckout, below).
 *
 * AN UNPAID ORDER DOES NOT KEEP ITS STOCK. A new order from the same cart
 * cancels the cart's other unpaid orders first (stock, coupon use and key
 * released; a paid order is never touched), and orders left unpaid past
 * ORDER_PAYMENT_WINDOW_MINUTES are expired here and by cron
 * (./expiry.ts, supabase/migrations/0020).
 *
 * Ends in a redirect (thrown) on every success path; returns an ActionFailure
 * carrying `problem` on the failures the page has to explain.
 */
export async function placeOrder({
	cookies,
	now,
	ship
}: {
	cookies: Cookies;
	now: number;
	/** An address that has already passed validateAddress(). */
	ship: ShipTo;
}) {
	const token = readCartToken(cookies);
	if (!token) redirect(303, '/cart');

	// Lapsed unpaid orders give their stock back before this one is checked.
	await expireUnpaidOrders({ force: true });

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
	const view = await loadCart(cookies, now);

	// §10 again, at order creation and not only at the form: serviceability
	// can change between the two steps.
	const exclusion = await cartRepository.pincodeExclusion(ship.pincode);
	if (exclusion) {
		return fail(409, { problem: exclusion, status: 'out_of_stock' as const });
	}

	// What is being bought, as stored, before the commit empties it.
	const cart = await cartRepository.findCart(token);
	const lines = cart ? await cartRepository.listLines(cart.id) : [];

	const keyPrefix = cartKeyPrefix(token);
	const idempotencyKey = `${keyPrefix}${await fingerprint(lines, view.couponCode, ship)}`;

	/**
	 * A changed cart or address is a new order, so the cart's earlier unpaid
	 * order is superseded: cancelled BEFORE the commit, so its pieces (and
	 * its coupon use) are back for this one. The same basket keeps its key
	 * and is left alone, which is what lets a replay replay.
	 *
	 * Never with no lines: an empty read here is a double-submit landing
	 * between the first submit's commit and its restore, and cancelling then
	 * would cancel the order the customer just placed.
	 */
	if (cart && lines.length > 0) {
		await cartRepository.cancelSupersededOrders({ keyPrefix, keepKey: idempotencyKey });
	}

	const outcome = await cartRepository.commitOrder({
		idempotencyKey,
		cartToken: token,
		ship,
		shipping: view.totals.shipping,
		// A CODE. app.redeem_coupon() re-validates it against the order's own
		// stored subtotal — this is never an amount (§10).
		couponCode: view.couponCode
	});

	if (outcome.status === 'empty_cart') {
		/**
		 * Double-submit without JavaScript: the second post can read the cart
		 * in the moment between the first post's commit (which empties it)
		 * and the restore, and so arrives with a different, empty key. If this
		 * cart placed an order a moment ago that is still awaiting payment,
		 * that is the order this submit meant.
		 */
		const recent = await cartRepository.findRecentPendingOrder(
			keyPrefix,
			Date.now() - DOUBLE_SUBMIT_WINDOW_MS
		);
		if (recent) {
			await rememberPending(cookies, recent, cart?.id ?? null);
			redirect(303, `/checkout/processing?order=${recent}`);
		}

		// No lines and no prior order under this key. The cart page explains
		// the empty state; an address form for nothing does not.
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
			problem: "We couldn't place your order. You haven't been charged — please try again.",
			status: 'out_of_stock' as const
		});
	}

	// Unpaid is not done: the lines go back into the cart straight away, so an
	// abandoned payment leaves the basket as it was. Before the gateway call,
	// not after it, to keep the window in which the cart reads empty short.
	// The coupon goes back first: a double-submit that reads the restored
	// lines must also read the code, or it fingerprints a different basket.
	// Checking out again replays this order by its key; paying for it retires
	// the cart (settleCheckout).
	if (outcome.status === 'committed' && cart) {
		if (view.couponCode) await cartRepository.setCoupon(cart.id, view.couponCode);
		await cartRepository.restoreLines(cart.id, lines, holdUntil(now));
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

	cookies.set(PENDING_COOKIE, `${outcome.publicToken}.${await linesSignature(lines)}`, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: PENDING_MAX_AGE
	});

	redirect(303, `/checkout/processing?order=${outcome.publicToken}`);
}

/** The order this browser's cart is waiting to pay for. */
const PENDING_COOKIE = 'rw_pending';
const PENDING_MAX_AGE = 60 * 60 * 24 * 7;

/** How recent a pending order must be to count as "the one just submitted". */
const DOUBLE_SUBMIT_WINDOW_MS = 2 * 60_000;

/**
 * Sets rw_pending for an order found by the double-submit fallback. The
 * first submit restores the lines within moments; wait briefly for them so
 * the cookie carries the real lines signature (settleCheckout compares it).
 * If they never show, the cookie carries no signature and settleCheckout
 * keeps the cart rather than guessing.
 */
async function rememberPending(cookies: Cookies, publicToken: string, cartId: string | null) {
	let lines: StoredCartLine[] = [];
	for (let attempt = 0; cartId && attempt < 20; attempt += 1) {
		lines = await cartRepository.listLines(cartId);
		if (lines.length > 0) break;
		await new Promise((resolve) => setTimeout(resolve, 100));
	}
	const signature = lines.length > 0 ? await linesSignature(lines) : '';
	cookies.set(PENDING_COOKIE, `${publicToken}.${signature}`, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: PENDING_MAX_AGE
	});
}

/** Order states that mean the buyer's money has landed. */
const PAID_STATES = new Set<OrderRecord['state']>(['paid', 'packed', 'dispatched', 'delivered']);

/** SHA-256 (Web Crypto), shortened: a fingerprint, not a secret. */
async function digest(value: unknown): Promise<string> {
	const bytes = new TextEncoder().encode(JSON.stringify(value));
	const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
	return Array.from(hash.slice(0, 12), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** The lines alone, order-independent. */
function linesSignature(lines: readonly StoredCartLine[]): Promise<string> {
	return digest(
		lines
			.map((line) => [line.variantId, line.quantity] as const)
			.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
	);
}

/**
 * A short, stable fingerprint of an order-to-be. Same lines, code and address
 * → same key → app.commit_order() replays; anything changed → a new order.
 */
async function fingerprint(
	lines: readonly StoredCartLine[],
	couponCode: string | null,
	ship: ShipTo
): Promise<string> {
	return digest({
		lines: await linesSignature(lines),
		code: couponCode?.trim().toUpperCase() ?? null,
		ship
	});
}

/**
 * Retires the cart once ITS order is paid. Called from the pay and order
 * pages; does nothing for any other order, or for one still awaiting payment.
 * Writes cookies, so only ever call it from a dynamic route's server code.
 */
export async function settleCheckout(cookies: Cookies, order: OrderRecord): Promise<void> {
	const [pendingToken, pendingLines] = (cookies.get(PENDING_COOKIE) ?? '').split('.');
	if (pendingToken !== order.publicToken) return;
	if (order.state === 'pending_payment') return;

	cookies.delete(PENDING_COOKIE, { path: '/' });
	if (!PAID_STATES.has(order.state)) return;

	const token = readCartToken(cookies);
	const cart = token ? await cartRepository.findCart(token) : null;
	const lines = cart ? await cartRepository.listLines(cart.id) : [];

	// A cart changed since this order was placed is a new basket: keep it.
	// No signature means it was never known (double-submit fallback): keep it.
	if (
		cart &&
		lines.length > 0 &&
		(!pendingLines || (await linesSignature(lines)) !== pendingLines)
	) {
		return;
	}

	if (cart) {
		// The restored lines still hold stock; release it before letting go.
		for (const line of lines) await cartRepository.removeLine(cart.id, line.variantId);
	}
	closeCart(cookies);
	clearShipTo(cookies);
}
