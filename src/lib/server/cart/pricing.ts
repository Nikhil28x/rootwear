/**
 * §04 — Cart pricing. The reason app.cart_lines has no price column.
 *
 * "NEVER ACCEPT A PRICE FROM THE CLIENT. Order total is recomputed
 *  server-side from the drop's own price at the moment of order creation."
 *
 * A price captured at add-to-cart would charge a stale figure if the drop
 * crossed its launch instant while the item sat in the cart. So the stored
 * line carries a variant id and a quantity, and EVERY read re-resolves the
 * price here, against the request-scoped server clock, using exactly the rule
 * app.commit_order() uses in SQL:
 *
 *     now >= drop.launch_instant  ->  launch price,      source 'launch'
 *     now <  drop.launch_instant  ->  prelaunch price,   source 'prelaunch_locked'
 *
 * The two implementations must not drift: if one changes, the other is wrong.
 */
import type { Drop, Product, Variant } from '$lib/domain/drop';
import { sellableStock } from '$lib/domain/drop';
import { drops } from '$lib/server/drops';
import { ZERO, addPaise, multiplyPaise, paise, subPaise, type Paise } from '$lib/money';
import { CART_HOLD_MINUTES } from '$lib/config/commerce';
import type { CartRepository } from './repository';
import type {
	CartTotals,
	CartView,
	CouponStatus,
	PaymentKind,
	PricedCartLine,
	PriceSource,
	ShippingEstimate,
	StoredCart,
	StoredCartLine
} from './types';

export type CatalogueEntry = {
	readonly drop: Drop;
	readonly product: Product;
	readonly variant: Variant;
};

/**
 * variantId -> the drop, product and variant it belongs to.
 *
 * Built from the SAME DropRepository the storefront reads, so a cart can never
 * hold a variant id the catalogue has never heard of. Rebuilt per call rather
 * than cached: under CATALOGUE_SOURCE=supabase the catalogue is live, and a
 * stale cache here would price a cart against yesterday's drop state.
 */
export async function catalogueIndex(): Promise<Map<string, CatalogueEntry>> {
	const index = new Map<string, CatalogueEntry>();
	for (const drop of await drops.listDrops()) {
		for (const product of drop.products) {
			for (const variant of product.variants) {
				index.set(variant.id, { drop, product, variant });
			}
		}
	}
	return index;
}

export type ResolvedPrice = {
	readonly unitPrice: Paise;
	readonly priceSource: PriceSource;
	/** §07/§08: bought before the drop opens, so it is made for the drop. */
	readonly isPreOrder: boolean;
};

/** The one price rule. Mirrors app.commit_order() line for line. */
export function resolvePrice(drop: Drop, product: Product, nowMs: number): ResolvedPrice {
	const launched = nowMs >= drop.launchInstant;
	return {
		unitPrice: launched ? product.launchPrice : product.prelaunchPrice,
		priceSource: launched ? 'launch' : 'prelaunch_locked',
		isPreOrder: !launched
	};
}

/** The lead image, falling back to whatever the product has. §14 applies to alt text. */
function leadImage(product: Product) {
	return product.images.find((image) => image.role === 'lead') ?? product.images[0] ?? null;
}

const EMPTY_TOTALS: CartTotals = {
	subtotal: ZERO,
	discount: ZERO,
	shipping: ZERO,
	total: ZERO
};

export const EMPTY_SHIPPING: ShippingEstimate = { label: 'Shipping', rate: ZERO };

/** The view a visitor with no cart cookie gets. Mints nothing, reads nothing. */
export function emptyCartView(nowMs: number): CartView {
	return {
		token: null,
		lines: [],
		totals: EMPTY_TOTALS,
		shipping: EMPTY_SHIPPING,
		couponCode: null,
		couponProblem: null,
		soonestHoldMs: null,
		holdMinutes: CART_HOLD_MINUTES,
		hasPreOrderLine: false,
		pricedAtMs: nowMs
	};
}

/**
 * Turn stored lines into a priced, stock-checked view.
 *
 * `kind` exists because §10 forbids a coupon on a deposit or a balance
 * payment. The cart itself is always an 'order', but the same assembly is used
 * by the checkout surfaces, and passing the kind through means the refusal
 * comes from app.apply_coupon() rather than from a branch in a component.
 */
export async function buildCartView(
	repo: CartRepository,
	cart: StoredCart,
	lines: readonly StoredCartLine[],
	nowMs: number,
	kind: PaymentKind = 'order'
): Promise<CartView> {
	if (lines.length === 0) {
		return { ...emptyCartView(nowMs), token: cart.token, couponCode: null };
	}

	const index = await catalogueIndex();
	const priced: PricedCartLine[] = [];

	for (const line of lines) {
		const entry = index.get(line.variantId);
		// A line whose variant has left the catalogue is dropped from the view
		// rather than rendered half-built. Nothing is deleted in the database —
		// §06 — it simply stops being sellable.
		if (!entry) continue;

		const { drop, product, variant } = entry;
		const { unitPrice, priceSource, isPreOrder } = resolvePrice(drop, product, nowMs);
		const image = leadImage(product);

		// §10 — what makes the hold real rather than decorative: stock already
		// held in OTHER carts is not available to this one.
		const heldElsewhere = await repo.countHoldsElsewhere(line.variantId, nowMs, cart.id);
		const committed = await repo.committedUnits(line.variantId);
		const availableNow = Math.max(0, sellableStock(variant) - heldElsewhere - committed);

		priced.push({
			variantId: line.variantId,
			sku: variant.sku,
			size: variant.size,
			quantity: line.quantity,
			unitPrice,
			lineTotal: multiplyPaise(unitPrice, line.quantity),
			productName: product.name,
			productSlug: product.slug,
			dropSlug: drop.slug,
			dropName: drop.name,
			dropState: drop.state,
			image: image?.url ?? null,
			imageAlt: image?.alt ?? `${product.name}, ${variant.size}`,
			priceSource,
			isPreOrder,
			heldUntilMs: line.heldUntilMs,
			holdActive: line.heldUntilMs > nowMs,
			availableNow,
			overSubscribed: availableNow < line.quantity
		});
	}

	const subtotal = addPaise(...priced.map((line) => line.lineTotal));

	// §10: the client sends a CODE and receives an AMOUNT. It can never set a
	// discount, and a coupon that stopped validating is reported, not silently
	// dropped — the visitor is told why their code no longer applies.
	let discount: Paise = ZERO;
	let couponProblem: CouponStatus | null = null;
	if (cart.couponCode) {
		const outcome = await repo.validateCoupon(cart.couponCode, subtotal, kind);
		if (outcome.status === 'ok') discount = outcome.discount;
		else couponProblem = outcome.status;
	}

	const shipping = await repo.shippingFor(subtotal);
	const total = subPaise(addPaise(subtotal, shipping.rate), discount);

	const liveHolds = priced.filter((line) => line.holdActive).map((line) => line.heldUntilMs);

	return {
		token: cart.token,
		lines: priced,
		totals: { subtotal, discount, shipping: shipping.rate, total: paise(Math.max(0, total)) },
		shipping,
		couponCode: cart.couponCode,
		couponProblem,
		soonestHoldMs: liveHolds.length > 0 ? Math.min(...liveHolds) : null,
		holdMinutes: CART_HOLD_MINUTES,
		hasPreOrderLine: priced.some((line) => line.isPreOrder),
		pricedAtMs: nowMs
	};
}
