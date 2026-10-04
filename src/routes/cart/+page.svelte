<script lang="ts">
	/**
	 * §03 template 06 — Cart.
	 *
	 * "Guest cart, coupon field, cart-reservation window during the drop rush,
	 *  shipping estimate."
	 *
	 * Nothing on this page is computed in the browser. The prices were resolved
	 * server-side a moment ago (app.cart_lines carries no price), the discount
	 * came back from app.apply_coupon(), and the hold expiry is a server
	 * instant. The client's only jobs are to render it and to ask again when
	 * the hold runs out.
	 */
	import { invalidateAll } from '$app/navigation';
	import '$lib/components/checkout/checkout.css';
	import CheckoutSteps from '$lib/components/checkout/CheckoutSteps.svelte';
	import CartLine from '$lib/components/cart/CartLine.svelte';
	import CartSummary from '$lib/components/cart/CartSummary.svelte';
	import CouponField from '$lib/components/cart/CouponField.svelte';
	import HoldTimer from '$lib/components/cart/HoldTimer.svelte';
	import { RETURNS_WORDING } from '$lib/content/returns';
	import { HOLD_EXPIRED_MESSAGE } from '$lib/checkout/messages';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let cart = $derived(data.cart);
	let empty = $derived(cart.lines.length === 0);

	let problem = $derived(form && 'problem' in form ? form.problem : '');
	let couponStatus = $derived(form && 'coupon' in form ? form.coupon : null);

	/** Set once a hold lapses, so the page says why it just changed. */
	let holdLapsed = $state(false);

	/**
	 * §10 — when the window closes the client does NOT decide the stock is
	 * gone. It re-asks the server, which is the only thing that knows.
	 */
	async function onHoldExpired() {
		holdLapsed = true;
		await invalidateAll();
	}
</script>

<svelte:head>
	<title>Cart — Rootwear</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="co">
	{#if empty}
		<header class="co-mast">
			<div class="co-mast__text">
				<h1 class="co-title">Cart</h1>
			</div>
			<CheckoutSteps current="cart" />
		</header>
		<div class="co-single">
			{#if problem}
				<p role="alert" class="co-alert">{problem}</p>
			{/if}
			<p class="co-lede">Your cart is empty.</p>
			<div class="co-actions">
				<a class="cta" href="/drops">See the drops</a>
				<a class="link" href="/know-your-roots">Know your roots</a>
			</div>
		</div>
	{:else}
		<div class="co-grid co-grid--after">
			<header class="co-mast">
				<div class="co-mast__text">
					<h1 class="co-title">Cart</h1>
				</div>
				<CheckoutSteps current="cart" />
			</header>
			<div class="co-main">
				{#if problem || holdLapsed}
					<div class="cart-notices">
						{#if problem}
							<!-- Announced, not merely coloured. -->
							<p role="alert" class="co-alert">{problem}</p>
						{/if}
						{#if holdLapsed && !empty}
							<p role="status" class="co-note">{HOLD_EXPIRED_MESSAGE}</p>
						{/if}
					</div>
				{/if}

				<div>
					<div class="co-head">
						<h2>Pieces</h2>
						{#if cart.soonestHoldMs !== null}
							<HoldTimer
								expiresAtMs={cart.soonestHoldMs}
								serverNowMs={cart.pricedAtMs}
								onexpire={onHoldExpired}
								surface="light"
							/>
						{/if}
					</div>

					<ul class="co-lines">
						{#each cart.lines as line (line.variantId)}
							<CartLine {line} launchInstant={data.launchInstant} />
						{/each}
					</ul>
				</div>
			</div>

			<aside class="co-aside co-card" aria-label="Order summary">
				<CartSummary totals={cart.totals} shipping={cart.shipping}>
					<a class="cta cta--full" href="/checkout/information">Checkout</a>
					<a class="link link--soft" href="/drops">Keep looking</a>
				</CartSummary>

				<CouponField
					appliedCode={cart.couponCode}
					discount={cart.totals.discount}
					problem={cart.couponProblem}
					status={couponStatus}
				/>

				{#if cart.hasPreOrderLine}
					<p class="co-note">
						<b>Includes a pre-order</b>
						Pre-order pieces ship after the drop opens.
					</p>
				{/if}

				<!-- §11: the SAME returns wording as the product page, the
				     confirmation email and the returns policy. Imported from one
				     module, never retyped. -->
				<section class="cart-returns" aria-labelledby="returns-heading">
					<h2 id="returns-heading" class="co-label">Returns</h2>
					<p class="co-fine">{RETURNS_WORDING}</p>
				</section>
			</aside>
		</div>
	{/if}
</main>

<style>
	.cart-notices {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.cart-returns {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding-top: 18px;
		border-top: 1px solid var(--rule);
	}
	.cart-returns h2 {
		margin: 0;
		font-weight: 400;
		color: var(--ink);
	}
</style>
