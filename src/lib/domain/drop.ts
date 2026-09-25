/**
 * RW-034 — Core catalogue types.
 *
 * These mirror the eventual Supabase tables 1:1 so the DB swap (RW-120+) is a
 * transcription, not a redesign. Rules encoded here:
 *
 * - §04: prices are integer paise and never come from the client.
 * - §06: drop state is an explicit stored value, never inferred from stock.
 * - §09: ONE variant axis (size). There is deliberately no colour axis.
 * - §09: fabric, GSM and care are FIELDS, not prose inside a description,
 *   so they render consistently on the PDP, the size guide and invoices.
 */
import type { Paise } from '$lib/money';
import type { Size } from '$lib/drop/sizes';
import type { DropState } from './drop-state';

/** §09: a numbered piece. Allocated ON PAYMENT CONFIRMATION, never before (§08). */
export type EditionUnit = {
	readonly id: string;
	readonly variantId: string;
	/** 1..editionSize. Null until a payment confirms and claims it. */
	readonly handNumber: number | null;
	readonly status: 'available' | 'reserved' | 'sold';
	/** Set only once a reservation or order owns this piece. */
	readonly ownedByReservationId: string | null;
};

export type Variant = {
	readonly id: string;
	readonly productId: string;
	/** §09 SKU convention RW-D01-TEE-M. */
	readonly sku: string;
	readonly size: Size;
	/** §09: per-size stock count. Authoritative only server-side. */
	readonly stockCount: number;
	/**
	 * §08: reserved pieces are already allocated at the launch instant and are
	 * NOT sellable. Only unreserved stock goes on open sale.
	 */
	readonly reservedCount: number;
};

/** Sellable stock excludes pieces already reserved during the tease (§08). */
export function sellableStock(variant: Variant): number {
	return Math.max(0, variant.stockCount - variant.reservedCount);
}

/** §06: sold-out sizes are GREYED, NOT HIDDEN — the scarcity is the point. */
export function isSizeSoldOut(variant: Variant): boolean {
	return sellableStock(variant) <= 0;
}

export type ProductImage = {
	readonly url: string;
	readonly alt: string;
	/** §09 imagery requirement: a lead shot, 2+ detail shots (one fabric close-up), a worn shot. */
	readonly role: 'lead' | 'detail' | 'fabric' | 'worn';
};

export type Product = {
	readonly id: string;
	readonly dropId: string;
	/** §05: product is nested under its drop — /drops/01-pineapple-haze/tee */
	readonly slug: string;
	readonly name: string;
	readonly summary: string;

	/** §09 — structured fields, not free text. */
	readonly fabric: string;
	readonly gsm: number;
	readonly care: readonly string[];
	readonly fit: string;
	/** §09: model height and worn size, shown next to the imagery. */
	readonly modelHeightCm: number;
	readonly modelWornSize: Size;

	readonly images: readonly ProductImage[];
	readonly variants: readonly Variant[];

	/** §10: two distinct prices so §08's locked-price behaviour has something to lock. */
	readonly launchPrice: Paise;
	readonly prelaunchPrice: Paise;
};

export type Drop = {
	readonly id: string;
	/** §05: numbered with a slug. Immutable once public — the URL never changes. */
	readonly slug: string;
	readonly number: number;
	readonly name: string;
	readonly story: string;

	/** §06: explicit, stored, never derived from stock counts. */
	readonly state: DropState;

	readonly launchInstant: number;
	/** §06: archived drops are "dated as released". Null until archived. */
	readonly archivedAt: number | null;
	/** §08: 25 hand-numbered pieces. */
	readonly editionSize: number;

	readonly products: readonly Product[];
};

/** §07: "14 of 25 claimed" — real, live, and never fabricated. */
export function claimedCount(drop: Drop): number {
	return drop.products.reduce(
		(total, product) =>
			total + product.variants.reduce((n, variant) => n + variant.reservedCount, 0),
		0
	);
}
