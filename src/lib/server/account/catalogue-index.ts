/**
 * RW-130 — Variant → catalogue lookup, built once per request.
 *
 * Reservations, notify-me rows and waitlist entries all store a `variant_id`
 * and nothing else about the garment. The account screens need the drop name,
 * the product name and the size next to each one.
 *
 * Rather than joining `app` to `public` in SQL — the two schemas are separated
 * on purpose (0001), and `app` is not exposed to PostgREST — this stitches in
 * TypeScript through the SAME catalogue seam the storefront uses. One
 * consequence worth the trade: mock and Supabase account repositories share
 * this file verbatim, so the fixture path and the database path cannot drift
 * in how they describe a piece.
 */
import { drops } from '$lib/server/drops';
import type { Size } from '$lib/drop/sizes';

export type VariantFacts = {
	readonly variantId: string;
	readonly sku: string;
	readonly size: Size;
	readonly productName: string;
	readonly dropId: string;
	readonly dropSlug: string;
	readonly dropName: string;
	readonly dropNumber: number;
	readonly editionSize: number;
};

export type CatalogueIndex = {
	byVariantId(variantId: string): VariantFacts | null;
};

/**
 * Built per call, never cached at module scope: a module-level cache would
 * serve a stale drop state after an admin edit, and `drops` already resolves
 * its own source per call.
 */
export async function loadCatalogueIndex(): Promise<CatalogueIndex> {
	const all = await drops.listDrops();
	const index = new Map<string, VariantFacts>();

	for (const drop of all) {
		for (const product of drop.products) {
			for (const variant of product.variants) {
				index.set(variant.id, {
					variantId: variant.id,
					sku: variant.sku,
					size: variant.size,
					productName: product.name,
					dropId: drop.id,
					dropSlug: drop.slug,
					dropName: drop.name,
					dropNumber: drop.number,
					editionSize: drop.editionSize
				});
			}
		}
	}

	return {
		byVariantId: (variantId: string) => index.get(variantId) ?? null
	};
}
