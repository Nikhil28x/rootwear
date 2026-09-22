/**
 * The one place the cart data source is chosen, and the one place the cart
 * cookie is read or written.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * PRERENDER CONTRACT — read this before changing anything below.
 *
 * src/routes/+layout.server.ts calls `loadCartView(cookies)` on EVERY route,
 * and some routes prerender (/know-your-roots today, the policy pages next).
 * During prerendering `cookies.get()` is allowed but `cookies.set()` THROWS,
 * which would fail the build rather than fail a request.
 *
 * So: `loadCartView` is STRICTLY READ-ONLY. No cookie is written, no cart row
 * is created, nothing is minted. A visitor with no cart cookie gets `[]` and
 * the build stays green. A token is minted lazily, exactly once, inside the
 * add-to-cart action — the only moment a visitor has actually asked for a
 * cart. Never move that into a load function.
 * ────────────────────────────────────────────────────────────────────────────
 */
import type { Cookies } from '@sveltejs/kit';
import type { CartRepository } from './repository';
import { mockCartRepository } from './mock-repository';
import { supabaseCartRepository } from './supabase-repository';
import { catalogueSource, isSupabaseConfigured } from '$lib/server/env';
import { serverNow } from '$lib/server/clock';
import { CART_HOLD_MINUTES } from '$lib/config/commerce';
import type { CartLineView } from '$lib/cart/cart.svelte';
import type { CartView, PaymentKind, StoredCart } from './types';
import { buildCartView, emptyCartView } from './pricing';

function selectRepository(): CartRepository {
	if (catalogueSource() === 'supabase') {
		if (!isSupabaseConfigured()) {
			throw new Error(
				'CATALOGUE_SOURCE=supabase but PUBLIC_SUPABASE_URL / ' +
					'PUBLIC_SUPABASE_ANON_KEY are not set. See .env.example.'
			);
		}
		return supabaseCartRepository;
	}
	return mockCartRepository;
}

/** Resolved per call so the switch works without a restart in dev. */
export const cartRepository: CartRepository = {
	findCart: (token) => selectRepository().findCart(token),
	createCart: (token, nowMs) => selectRepository().createCart(token, nowMs),
	listLines: (cartId) => selectRepository().listLines(cartId),
	addLine: (cartId, variantId, quantity, heldUntilMs) =>
		selectRepository().addLine(cartId, variantId, quantity, heldUntilMs),
	setQuantity: (cartId, variantId, quantity, heldUntilMs) =>
		selectRepository().setQuantity(cartId, variantId, quantity, heldUntilMs),
	removeLine: (cartId, variantId) => selectRepository().removeLine(cartId, variantId),
	renewHold: (cartId, heldUntilMs) => selectRepository().renewHold(cartId, heldUntilMs),
	countHoldsElsewhere: (variantId, nowMs, exceptCartId) =>
		selectRepository().countHoldsElsewhere(variantId, nowMs, exceptCartId),
	committedUnits: (variantId) => selectRepository().committedUnits(variantId),
	setCoupon: (cartId, code) => selectRepository().setCoupon(cartId, code),
	validateCoupon: (code, subtotal, kind) => selectRepository().validateCoupon(code, subtotal, kind),
	shippingFor: (subtotal) => selectRepository().shippingFor(subtotal),
	pincodeExclusion: (pincode) => selectRepository().pincodeExclusion(pincode),
	listAddresses: (customerId) => selectRepository().listAddresses(customerId),
	findCustomerIdForUser: (userId) => selectRepository().findCustomerIdForUser(userId),
	attachCartToCustomer: (cartId, customerId) =>
		selectRepository().attachCartToCustomer(cartId, customerId),
	commitOrder: (input) => selectRepository().commitOrder(input),
	findOrderByToken: (token) => selectRepository().findOrderByToken(token),
	recordPaymentIntent: (input) => selectRepository().recordPaymentIntent(input),
	capturePayment: (input) => selectRepository().capturePayment(input),
	findPaymentIntent: (input) => selectRepository().findPaymentIntent(input),
	findReservation: (id) => selectRepository().findReservation(id),
	recordWebhookEvent: (input) => selectRepository().recordWebhookEvent(input),
	markWebhookProcessed: (eventId, errorMessage) =>
		selectRepository().markWebhookProcessed(eventId, errorMessage)
};

/**
 * Opaque cookie token. Never a customer id, never guessable, and httpOnly so
 * no script — ours or anyone's — can read it. The cart token is effectively a
 * bearer credential for the cart, so it is treated like one.
 */
export const CART_COOKIE = 'rw_cart';

const COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

/** 32 random bytes, hex. `crypto` is global on every runtime this targets. */
function mintToken(): string {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** READ-ONLY. Safe during prerendering. Returns null when there is no cart. */
export function readCartToken(cookies: Cookies): string | null {
	return cookies.get(CART_COOKIE) ?? null;
}

/** The hold window, in ms, from `now`. §10: released automatically on expiry. */
export function holdUntil(nowMs: number): number {
	return nowMs + CART_HOLD_MINUTES * 60_000;
}

/**
 * Mints a cart token and its row. WRITES A COOKIE — only ever call this from a
 * form action or an endpoint, never from a `load`. See the prerender contract
 * at the top of this file.
 */
export async function openCart(cookies: Cookies, nowMs: number): Promise<StoredCart> {
	const existing = readCartToken(cookies);
	if (existing) {
		const found = await cartRepository.findCart(existing);
		if (found) return found;
	}

	const token = existing ?? mintToken();
	cookies.set(CART_COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: COOKIE_MAX_AGE
	});
	return cartRepository.createCart(token, nowMs);
}

/** Drops the cart cookie. Used once an order commits, so the next add is fresh. */
export function closeCart(cookies: Cookies): void {
	cookies.delete(CART_COOKIE, { path: '/' });
}

/**
 * READ-ONLY. The full priced cart, or an empty view when there is no cookie
 * and no row. Mints nothing.
 */
export async function loadCart(
	cookies: Cookies,
	nowMs: number = serverNow(),
	kind: PaymentKind = 'order'
): Promise<CartView> {
	const token = readCartToken(cookies);
	if (!token) return emptyCartView(nowMs);

	const cart = await cartRepository.findCart(token);
	if (!cart) return emptyCartView(nowMs);

	const lines = await cartRepository.listLines(cart.id);
	return buildCartView(cartRepository, cart, lines, nowMs, kind);
}

/**
 * What the root layout puts in `data.cartLines` and CartState renders as the
 * header badge. READ-ONLY, and deliberately the narrow shape: the header needs
 * a count and a hold, not a priced, stock-checked cart.
 *
 * `nowMs` defaults to the server clock because the root layout load has
 * `cookies` but is not given `locals`. Every route that actually renders the
 * cart passes `locals.now` through `loadCart` instead.
 */
export async function loadCartView(
	cookies: Cookies,
	nowMs: number = serverNow()
): Promise<CartLineView[]> {
	const view = await loadCart(cookies, nowMs);
	return view.lines.map((line) => ({
		variantId: line.variantId,
		sku: line.sku,
		name: line.productName,
		size: line.size,
		quantity: line.quantity,
		unitPrice: line.unitPrice,
		image: line.image,
		heldUntil: line.holdActive ? line.heldUntilMs : null
	}));
}

export type { CartRepository };
export * from './types';
