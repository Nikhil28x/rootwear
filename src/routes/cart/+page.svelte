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
	import Button from '$lib/components/ui/Button.svelte';
	import Eyebrow from '$lib/components/ui/Eyebrow.svelte';
	import HempMotif from '$lib/components/art/HempMotif.svelte';
	import RootSystem from '$lib/components/art/RootSystem.svelte';
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

<main class="relative isolate overflow-hidden bg-cream text-forest">
	<div class="pointer-events-none absolute inset-0 -z-10 select-none" aria-hidden="true">
		<div class="absolute -top-32 -right-40 h-[38rem] w-[38rem] text-forest">
			<HempMotif opacity={0.05} seed={3} />
		</div>
		<div class="absolute -bottom-28 -left-32 hidden h-[26rem] w-[46rem] text-forest sm:block">
			<RootSystem opacity={0.06} depth={5} />
		</div>
	</div>

	<div class="mx-auto max-w-[1600px] px-5 py-24 sm:px-10 sm:py-32 lg:px-14">
		<Eyebrow tone="strong" class="text-forest/50">Cart</Eyebrow>
		<h1
			class="display mt-6 text-[clamp(3rem,7vw,7rem)] leading-[0.82] tracking-[-0.055em] text-forest"
		>
			Your<br />basket.
		</h1>

		{#if problem}
			<!-- Announced, not merely coloured. -->
			<p
				role="alert"
				class="mt-10 max-w-[56ch] border-l-2 border-alert bg-alert/[0.06] px-6 py-5 text-sm leading-relaxed text-alert"
			>
				{problem}
			</p>
		{/if}

		{#if holdLapsed && !empty}
			<p
				role="status"
				class="mt-10 max-w-[56ch] border-l-2 border-gold px-6 py-5 text-sm leading-relaxed text-forest/75"
			>
				{HOLD_EXPIRED_MESSAGE}
			</p>
		{/if}

		{#if empty}
			<div class="mt-16 max-w-[52ch]">
				<p class="text-[15px] leading-[1.85] text-forest/70">
					Nothing here yet. Pieces are cut in small numbered editions, so a drop is either open or
					it is not — the archive keeps every piece on its page either way.
				</p>
				<div class="mt-10 flex flex-wrap gap-4">
					<Button surface="light" variant="solid" href="/drops">See the drops</Button>
					<Button surface="light" variant="outline" href="/know-your-roots">Know your roots</Button>
				</div>
			</div>
		{:else}
			<div class="mt-16 grid gap-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-24">
				<div>
					{#if cart.soonestHoldMs !== null}
						<div
							class="flex flex-wrap items-baseline justify-between gap-4 border-b border-forest/15 pb-5"
						>
							<HoldTimer
								expiresAtMs={cart.soonestHoldMs}
								serverNowMs={cart.pricedAtMs}
								onexpire={onHoldExpired}
								surface="light"
							/>
							<p class="max-w-[46ch] text-xs leading-relaxed text-forest/60">
								A drop is {cart.holdMinutes} minutes of held stock, then it goes back on sale. It keeps
								a full basket from blocking a piece somebody is waiting for.
							</p>
						</div>
					{/if}

					<ul class="m-0 list-none p-0">
						{#each cart.lines as line (line.variantId)}
							<CartLine {line} launchInstant={data.launchInstant} />
						{/each}
					</ul>
				</div>

				<div class="flex flex-col gap-8 lg:sticky lg:top-28 lg:self-start">
					<CouponField
						appliedCode={cart.couponCode}
						discount={cart.totals.discount}
						problem={cart.couponProblem}
						status={couponStatus}
					/>

					<CartSummary totals={cart.totals} shipping={cart.shipping}>
						<Button surface="light" variant="solid" full href="/checkout/information">
							Checkout
						</Button>
						<Button surface="light" variant="quiet" href="/drops">Keep looking</Button>
					</CartSummary>

					{#if cart.hasPreOrderLine}
						<p class="border-l-2 border-gold pl-4 text-xs leading-relaxed text-forest/75">
							<span class="block text-[10px] tracking-[0.28em] text-forest uppercase">
								Pre-order in this basket
							</span>
							<span class="mt-2 block">
								At least one piece here is made for the drop rather than taken off a shelf. Dispatch
								follows the drop opening, and the hand number is allocated when payment confirms.
							</span>
						</p>
					{/if}

					<!-- §11: the SAME returns wording as the product page, the
					     confirmation email and the returns policy. Imported from one
					     module, never retyped. -->
					<section class="border-t border-forest/15 pt-6" aria-labelledby="returns-heading">
						<h2 id="returns-heading" class="text-[10px] tracking-[0.28em] text-forest/60 uppercase">
							Returns
						</h2>
						<p class="mt-4 text-xs leading-relaxed text-forest/70">{RETURNS_WORDING}</p>
					</section>
				</div>
			</div>
		{/if}
	</div>
</main>
