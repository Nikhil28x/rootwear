/**
 * What a shopper can actually add, size by size.
 *
 * ONE answer for every surface: the product page and the cart both call
 * this, so a size can never show "2 left" on the page and be refused by the
 * cart.
 */
import { sellableStock, type Product, type Variant } from '$lib/domain/drop';
import type { SizeOffer } from '$lib/components/drop/types';
import { cartRepository } from './index';

/**
 * Units of one variant open to this cart: stock, less committed orders.
 *
 * A cart holds nothing. Stock is checked and taken when the order is placed,
 * just before payment (app.commit_order locks the variant, verifies stock and
 * decrements it), and an unpaid order gives it back when its payment window
 * lapses. Other people's carts never make a size look sold out.
 */
export async function availableUnits(variant: Variant): Promise<number> {
	const committed = await cartRepository.committedUnits(variant.id);
	return Math.max(0, sellableStock(variant) - committed);
}

/** Every size of a product with its live availability. Sold-out sizes stay in the list. */
export async function sizeOffers(product: Product): Promise<SizeOffer[]> {
	return Promise.all(
		product.variants.map(async (variant) => {
			const remaining = await availableUnits(variant);
			return {
				variantId: variant.id,
				size: variant.size,
				colourwayId: variant.colourwayId,
				sku: variant.sku,
				soldOut: remaining <= 0,
				remaining
			};
		})
	);
}
