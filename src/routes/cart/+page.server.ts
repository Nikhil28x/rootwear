import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	cartRepository,
	closeCart,
	holdUntil,
	loadCart,
	openCart,
	readCartToken
} from '$lib/server/cart';
import { catalogueIndex } from '$lib/server/cart/pricing';
import { isOnSale } from '$lib/domain/drop-state';
import { sellableStock } from '$lib/domain/drop';
import { LAUNCH_INSTANT } from '$lib/drop/schedule';
import type { CouponStatus } from '$lib/server/cart/types';

/**
 * §03 template 06 — the cart. Guest by default (§10: guest checkout stays on,
 * an account is offered AFTER a purchase, never before it).
 *
 * EVERY action here is a real form action, so the cart works with JavaScript
 * disabled: the browser posts, the server decides, the page re-renders.
 * `use:enhance` in the components only removes the navigation.
 *
 * Three rules are enforced here and nowhere else:
 *
 *  §04  The client never supplies a price or a quantity the server does not
 *       re-check. Adding names a VARIANT; the price is resolved on read.
 *  §10  Stock is held for CART_HOLD_MINUTES from add-to-cart and released
 *       automatically. A hold in one cart removes the piece from open sale in
 *       every other cart until it lapses.
 *  §06  A drop that is not on sale cannot be added to, whatever the page that
 *       posted here believed. The PDP hides the form; this refuses the post.
 */

const field = (data: FormData, key: string) => (data.get(key) ?? '').toString().trim();

function parseQuantity(raw: string): number | null {
	const value = Number(raw);
	if (!Number.isInteger(value) || value < 0 || value > 99) return null;
	return value;
}

export const load: PageServerLoad = async ({ cookies, locals }) => {
	// READ-ONLY. Mints nothing — a visitor who has never added anything must
	// not acquire a cart cookie merely by looking at this page.
	const cart = await loadCart(cookies, locals.now);

	return {
		cart,
		/** §08: what a pre-order line dispatches after. */
		launchInstant: LAUNCH_INSTANT,
		serverNow: locals.now
	};
};

export const actions: Actions = {
	/**
	 * Add to cart. The ONLY place a cart token is minted (see the prerender
	 * contract in $lib/server/cart/index.ts — a load function must never mint).
	 */
	add: async ({ request, cookies, locals }) => {
		const data = await request.formData();
		const variantId = field(data, 'variantId');
		const quantity = parseQuantity(field(data, 'quantity') || '1');

		if (!variantId) return fail(400, { problem: 'Choose a size first.' });
		if (quantity === null || quantity < 1) {
			return fail(400, { problem: 'That is not a quantity we can order.' });
		}

		const entry = (await catalogueIndex()).get(variantId);
		if (!entry) return fail(404, { problem: 'That piece is no longer in the catalogue.' });

		// §06: the drop's own state decides, not the page that posted. During a
		// tease a visitor reserves with a deposit (§08); they do not buy.
		if (!isOnSale(entry.drop.state)) {
			return fail(409, {
				problem: `${entry.drop.name} is not open for sale yet. Nothing has been added.`
			});
		}

		const cart = await openCart(cookies, locals.now);
		const existing = (await cartRepository.listLines(cart.id)).find(
			(line) => line.variantId === variantId
		);

		// §10: what is genuinely available to THIS cart — sellable stock, less
		// every live hold in another cart, less anything already committed.
		const [heldElsewhere, committed] = await Promise.all([
			cartRepository.countHoldsElsewhere(variantId, locals.now, cart.id),
			cartRepository.committedUnits(variantId)
		]);
		const available = sellableStock(entry.variant) - heldElsewhere - committed;
		const wanted = (existing?.quantity ?? 0) + quantity;

		if (available < wanted) {
			return fail(409, {
				problem:
					available <= 0
						? `Size ${entry.variant.size} is spoken for right now. Sold-out sizes stay on the page — try notify-me.`
						: `Only ${available} left in size ${entry.variant.size} at this moment.`
			});
		}

		// Adding re-stamps the hold: the visitor has just shown intent.
		await cartRepository.addLine(cart.id, variantId, quantity, holdUntil(locals.now));

		// A signed-in visitor's cart is linked to their customer record, so a
		// cart survives a device change. A guest's is not, by design.
		const { user } = await locals.safeGetSession();
		if (user) {
			const customerId = await cartRepository.findCustomerIdForUser(user.id);
			if (customerId) await cartRepository.attachCartToCustomer(cart.id, customerId);
		}

		redirect(303, '/cart');
	},

	updateQuantity: async ({ request, cookies, locals }) => {
		const data = await request.formData();
		const variantId = field(data, 'variantId');
		const quantity = parseQuantity(field(data, 'quantity'));

		if (quantity === null) return fail(400, { problem: 'That is not a quantity we can order.' });

		const token = readCartToken(cookies);
		const cart = token ? await cartRepository.findCart(token) : null;
		if (!cart) return fail(404, { problem: 'Your cart has expired. Nothing was changed.' });

		const lines = await cartRepository.listLines(cart.id);
		const line = lines.find((candidate) => candidate.variantId === variantId);
		if (!line) return fail(404, { problem: 'That piece is no longer in your cart.' });

		if (quantity === 0) {
			// Zero is a removal, not a quantity. Handled here so the number input
			// behaves the same way the Remove button does.
			await cartRepository.removeLine(cart.id, variantId);
			if ((await cartRepository.listLines(cart.id)).length === 0) closeCart(cookies);
			return { updated: true };
		}

		const entry = (await catalogueIndex()).get(variantId);
		if (!entry) return fail(404, { problem: 'That piece is no longer in the catalogue.' });

		const [heldElsewhere, committed] = await Promise.all([
			cartRepository.countHoldsElsewhere(variantId, locals.now, cart.id),
			cartRepository.committedUnits(variantId)
		]);
		const available = sellableStock(entry.variant) - heldElsewhere - committed;

		if (available < quantity) {
			return fail(409, {
				problem: `Only ${Math.max(0, available)} left in size ${entry.variant.size} at this moment.`
			});
		}

		/**
		 * §10 — the hold window exists so a full cart cannot block a sale
		 * INDEFINITELY. Claiming MORE units restamps it, because those units
		 * were just claimed. Reducing the quantity keeps the original expiry:
		 * otherwise a visitor could hold a piece forever by nudging the number
		 * up and down, which is precisely the behaviour the window prevents.
		 */
		const heldUntilMs = quantity > line.quantity ? holdUntil(locals.now) : line.heldUntilMs;
		await cartRepository.setQuantity(cart.id, variantId, quantity, heldUntilMs);

		return { updated: true };
	},

	remove: async ({ request, cookies }) => {
		const data = await request.formData();
		const variantId = field(data, 'variantId');

		const token = readCartToken(cookies);
		const cart = token ? await cartRepository.findCart(token) : null;
		if (!cart) return fail(404, { problem: 'Your cart has expired. Nothing was changed.' });

		await cartRepository.removeLine(cart.id, variantId);

		// Nothing left to hold and nothing left to price: drop the cookie so the
		// next add starts a clean cart rather than reviving this one.
		const remaining = await cartRepository.listLines(cart.id);
		if (remaining.length === 0) closeCart(cookies);

		return { updated: true };
	},

	/**
	 * §10 — "Validation SERVER-SIDE; a coupon must NEVER be applicable to a
	 * deposit or a balance payment." The client posts a CODE. It receives an
	 * AMOUNT, or a specific reason it got none. It can never set a discount.
	 */
	applyCoupon: async ({ request, cookies, locals }) => {
		const data = await request.formData();
		const code = field(data, 'code').toUpperCase();

		if (!code) return fail(400, { coupon: 'not_found' as CouponStatus });

		const token = readCartToken(cookies);
		const cart = token ? await cartRepository.findCart(token) : null;
		if (!cart) return fail(404, { problem: 'Your cart has expired. Nothing was changed.' });

		// Validated against the SERVER's subtotal, recomputed a moment ago from
		// the catalogue — never against a figure the browser sent.
		const view = await loadCart(cookies, locals.now);
		const outcome = await cartRepository.validateCoupon(code, view.totals.subtotal, 'order');

		if (outcome.status !== 'ok') {
			return fail(400, { coupon: outcome.status });
		}

		// The CODE is stored, never the amount: a stored discount would go stale
		// the moment the cart, the price or the coupon changed.
		await cartRepository.setCoupon(cart.id, code);
		return { coupon: 'ok' as CouponStatus };
	},

	removeCoupon: async ({ cookies }) => {
		const token = readCartToken(cookies);
		const cart = token ? await cartRepository.findCart(token) : null;
		if (!cart) return fail(404, { problem: 'Your cart has expired. Nothing was changed.' });

		await cartRepository.setCoupon(cart.id, null);
		return { updated: true };
	}
};
