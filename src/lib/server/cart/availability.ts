/**
 * What a shopper can actually add, size by size.
 *
 * ONE answer for every surface. The product page used to read the raw
 * catalogue count while the cart subtracted live holds in other carts, so a
 * size could show "2 left" on the page and be refused by the cart. Both now
 * call this.
 */
import type { Cookies } from '@sveltejs/kit';
import { sellableStock, type Product, type Variant } from '$lib/domain/drop';
import type { SizeOffer } from '$lib/components/drop/types';
import { cartRepository, readCartToken } from './index';

/**
 * Stands in for "no cart yet" in the holds query. A real uuid, so the
 * Postgres comparison against cart_lines.cart_id stays well-typed.
 */
const NO_CART = '00000000-0000-0000-0000-000000000000';

/** Units of one variant open to this cart: stock, less other carts' live holds and committed orders. */
export async function availableUnits(
	variant: Variant,
	nowMs: number,
	cartId: string | null
): Promise<number> {
	const [heldElsewhere, committed] = await Promise.all([
		cartRepository.countHoldsElsewhere(variant.id, nowMs, cartId ?? NO_CART),
		cartRepository.committedUnits(variant.id)
	]);
	return Math.max(0, sellableStock(variant) - heldElsewhere - committed);
}

/** The visitor's cart id, without minting one — a page load must never create a cart. */
export async function currentCartId(cookies: Cookies): Promise<string | null> {
	const token = readCartToken(cookies);
	if (!token) return null;
	return (await cartRepository.findCart(token))?.id ?? null;
}

/** Every size of a product with its live availability. Sold-out sizes stay in the list. */
export async function sizeOffers(
	product: Product,
	nowMs: number,
	cartId: string | null
): Promise<SizeOffer[]> {
	return Promise.all(
		product.variants.map(async (variant) => {
			const remaining = await availableUnits(variant, nowMs, cartId);
			return {
				variantId: variant.id,
				size: variant.size,
				sku: variant.sku,
				soldOut: remaining <= 0,
				remaining
			};
		})
	);
}
