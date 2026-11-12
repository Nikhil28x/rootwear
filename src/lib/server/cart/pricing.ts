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
import { isOnSale, acceptsDeposits } from '$lib/domain/drop-state';
import type { Drop, Product, Variant } from '$lib/domain/drop';
import { sellableStock, colourOf, variantLabel, offerRemaining } from '$lib/domain/drop';
import { drops } from '$lib/server/drops';
import { ZERO, addPaise, multiplyPaise, paise, subPaise, type Paise } from '$lib/money';
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
 * Why this piece can't be bought right now, or null when it can. The one
 * rule for adding to a cart, restoring a cart and placing an order, so a line
 * carted while a drop was open can't be ordered after it closes, after the
 * piece is taken off the site, or while its price is hidden.
 */
export function purchaseRefusal(entry: CatalogueEntry | undefined): string | null {
	if (!entry) return 'This piece is no longer available.';
	if (!isOnSale(entry.drop.state)) return `${entry.drop.name} isn't on sale right now.`;
	// Pre-order mode (admin) takes signups instead of selling: the page offers
	// Pre-order, and a cart post made around it must not buy.
	if (entry.drop.preorderMode) return `${entry.drop.name} is taking pre-orders, not sales.`;
	if (!entry.product.priceVisible) return `${entry.product.name} isn't on sale yet.`;
	return null;
}

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
	for (const drop of await drops.listStorefrontDrops()) {
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
	/** The launch price, to strike through while a founder's price applies. */
	readonly regularPrice: Paise | null;
	/** Founder's pieces left at unitPrice, before this purchase. */
	readonly offerLeft: number;
};

/**
 * The one price rule. Mirrors app.commit_order() line for line.
 *
 * `offerUsed` is how many founder's pieces earlier lines of the same cart
 * already take, so the cart allocates them in the order commit_order does.
 */
export function resolvePrice(
	drop: Drop,
	product: Product,
	nowMs: number,
	offerUsed = 0
): ResolvedPrice {
	/**
	 * Price follows the drop's STATE, not the clock alone.
	 *
	 * These two normally agree, because RW-041 opens a drop the moment its
	 * launch instant passes. They disagree on a MANUAL PUSH — §06 state 2's
	 * override, where an operator opens a drop early. Keying on the clock there
	 * sold openly at the pre-launch price: §08 locks the pre-launch price for
	 * someone who RESERVES DURING THE TEASE, not for a walk-up buyer.
	 *
	 * isPreOrder is likewise a property of the tease, not of the calendar: a
	 * deposit reserves a piece only while the drop is actually in TEASE (§08).
	 */
	const onSale = isOnSale(drop.state);
	const preOrder = acceptsDeposits(drop.state);

	// Belt and braces: a drop still in a pre-launch state after its instant has
	// passed should never be cheaper than the launch price.
	const pastInstant = nowMs >= drop.launchInstant;
	const atLaunchPrice = onSale || pastInstant;

	// 0036: at launch, the founder's pieces go first, then the launch price.
	const offerLeft = atLaunchPrice ? Math.max(0, offerRemaining(product.offer) - offerUsed) : 0;
	if (offerLeft > 0 && product.offer) {
		return {
			unitPrice: product.offer.price,
			priceSource: 'offer',
			isPreOrder: preOrder,
			regularPrice: product.launchPrice,
			offerLeft
		};
	}

	return {
		unitPrice: atLaunchPrice ? product.launchPrice : product.prelaunchPrice,
		priceSource: atLaunchPrice ? 'launch' : 'prelaunch_locked',
		isPreOrder: preOrder,
		regularPrice: null,
		offerLeft: 0
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
	// Founder's pieces this cart has allocated so far, per product. Lines are
	// walked in variant id order, as app.commit_order() walks them.
	const offerUsed = new Map<string, number>();

	for (const line of [...lines].sort((a, b) => (a.variantId < b.variantId ? -1 : 1))) {
		const entry = index.get(line.variantId);
		// A line whose variant has left the catalogue is dropped from the view
		// rather than rendered half-built. Nothing is deleted in the database —
		// §06 — it simply stops being sellable.
		if (!entry) continue;

		const { drop, product, variant } = entry;
		const used = offerUsed.get(product.id) ?? 0;
		const resolved = resolvePrice(drop, product, nowMs, used);
		const { isPreOrder } = resolved;
		// A line that crosses the last founder's piece is charged as
		// commit_order splits it: some at the offer, the rest at launch.
		const atOffer = Math.min(line.quantity, resolved.offerLeft);
		offerUsed.set(product.id, used + atOffer);
		const mixed = atOffer > 0 && atOffer < line.quantity;
		const unitPrice = mixed ? product.launchPrice : resolved.unitPrice;
		const priceSource: PriceSource = mixed ? 'launch' : resolved.priceSource;
		const lineTotal = mixed
			? addPaise(
					multiplyPaise(resolved.unitPrice, atOffer),
					multiplyPaise(product.launchPrice, line.quantity - atOffer)
				)
			: multiplyPaise(unitPrice, line.quantity);
		const image = leadImage(product);

		// Carts hold nothing; stock is taken when the order is placed. Only
		// placed orders reduce what this line can have.
		const committed = await repo.committedUnits(line.variantId);
		const availableNow = Math.max(0, sellableStock(variant) - committed);

		priced.push({
			variantId: line.variantId,
			sku: variant.sku,
			size: variant.size,
			colour: colourOf(product, variant),
			quantity: line.quantity,
			unitPrice,
			lineTotal,
			productName: product.name,
			productSlug: product.slug,
			dropSlug: drop.slug,
			dropName: drop.name,
			dropState: drop.state,
			dropLaunchInstant: drop.launchInstant,
			image: image?.url ?? null,
			imageAlt: image?.alt ?? `${product.name}, ${variantLabel(product, variant)}`,
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
	// The coupon check and the shipping rate both depend only on the subtotal:
	// asked at once. The cart's own unpaid order does not count against its code.
	const [outcome, shipping] = await Promise.all([
		cart.couponCode
			? repo.validateCoupon(cart.couponCode, subtotal, kind, cart.token)
			: Promise.resolve(null),
		repo.shippingFor(subtotal)
	]);
	if (outcome) {
		if (outcome.status === 'ok') discount = outcome.discount;
		else couponProblem = outcome.status;
	}
	const total = subPaise(addPaise(subtotal, shipping.rate), discount);

	return {
		token: cart.token,
		lines: priced,
		totals: { subtotal, discount, shipping: shipping.rate, total: paise(Math.max(0, total)) },
		shipping,
		couponCode: cart.couponCode,
		couponProblem,
		hasPreOrderLine: priced.some((line) => line.isPreOrder),
		pricedAtMs: nowMs
	};
}
