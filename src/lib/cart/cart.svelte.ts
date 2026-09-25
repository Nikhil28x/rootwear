/**
 * Client-side cart state.
 *
 * CRITICAL: this is a class instantiated per request and shared through
 * context — NOT a module-level `$state`. On the server a module-level rune is
 * shared across every concurrent request, so one visitor's cart would leak
 * into another's page. Always create it in +layout.svelte and read it with
 * `getCart()`; never export a singleton from here.
 *
 * The numbers here are for DISPLAY ONLY. The authoritative cart lives in the
 * database and every total is recomputed server-side at order creation (§04).
 */
import { getContext, setContext } from 'svelte';
import type { Paise } from '$lib/money';

export type CartLineView = {
	variantId: string;
	sku: string;
	name: string;
	size: string;
	quantity: number;
	unitPrice: Paise;
	image: string | null;
	/** §10: the cart-reservation window. Null when nothing is held. */
	heldUntil: number | null;
};

export class CartState {
	/**
	 * The server's view of the cart, read as a function rather than copied in.
	 *
	 * A snapshot taken in the constructor would be correct once and then stale:
	 * the badge has to update after an add, a removal, and any client-side
	 * navigation. Holding the SOURCE and deriving from it means server-rendered
	 * HTML already carries the right count — which a $effect-based sync could
	 * not do, because effects do not run during SSR, so the badge was missing
	 * on first paint and never appeared at all without JavaScript.
	 */
	#source: () => CartLineView[] = () => [];

	/** Set while a mutation is in flight, so the UI can stay honest. */
	pending = $state(false);

	lines = $derived(this.#source());
	count = $derived(this.lines.reduce((n, l) => n + l.quantity, 0));
	subtotal = $derived(this.lines.reduce((n, l) => n + l.unitPrice * l.quantity, 0));

	/** Earliest hold expiry across the cart — what the countdown shows. */
	soonestHold = $derived(
		this.lines.reduce<number | null>((soonest, line) => {
			if (line.heldUntil === null) return soonest;
			return soonest === null ? line.heldUntil : Math.min(soonest, line.heldUntil);
		}, null)
	);

	constructor(source: () => CartLineView[]) {
		this.#source = source;
	}
}

const KEY = Symbol('rootwear-cart');

/**
 * Create the per-request cart and put it in context.
 *
 * `source` is a function so the state tracks the layout's `data` rather than a
 * copy of it — call it as `setCart(() => data.cartLines ?? [])`.
 */
export function setCart(source: () => CartLineView[]): CartState {
	const cart = new CartState(source);
	setContext(KEY, cart);
	return cart;
}

export function getCart(): CartState {
	const cart = getContext<CartState | undefined>(KEY);
	if (!cart) throw new Error('setCart() must run in a parent component first.');
	return cart;
}
