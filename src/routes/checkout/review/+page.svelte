<script lang="ts">
	/**
	 * §03 template 07 — Checkout, step two.
	 *
	 * Note what this page does NOT post: a total, a discount, a price, a piece
	 * number. It posts a click. Everything that matters is recomputed inside
	 * app.commit_order() (§04), which is also why the button can be pressed
	 * twice with no harm — the second press replays the first order.
	 */
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import Button from '$lib/components/ui/Button.svelte';
	import Eyebrow from '$lib/components/ui/Eyebrow.svelte';
	import CartSummary from '$lib/components/cart/CartSummary.svelte';
	import HoldTimer from '$lib/components/cart/HoldTimer.svelte';
	import { formatInr } from '$lib/money';
	import { RETURNS_WORDING } from '$lib/content/returns';
	import { FIT_DISCLAIMER } from '$lib/drop/sizes';
	import { PAYMENT_NOT_CONFIGURED_MESSAGE } from '$lib/checkout/messages';
	import { SHIP_COUNTRY_LABEL } from '$lib/checkout/address';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let placing = $state(false);
	let problem = $derived(form && 'problem' in form ? form.problem : '');

	const dispatchDate = new Intl.DateTimeFormat('en-GB', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		timeZone: 'Asia/Kolkata'
	});
</script>

<svelte:head>
	<title>Review your order — Rootwear</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="relative isolate overflow-hidden bg-cream text-forest">
	<div class="mx-auto max-w-[1600px] px-5 py-24 sm:px-10 sm:py-32 lg:px-14">
		<Eyebrow tone="strong" class="text-forest/50">Checkout · Step two of two</Eyebrow>
		<h1
			class="display mt-6 text-[clamp(3rem,7vw,7rem)] leading-[0.82] tracking-[-0.055em] text-forest"
		>
			Look it<br />over.
		</h1>

		{#if problem}
			<p
				role="alert"
				class="mt-10 max-w-[60ch] border-l-2 border-alert bg-alert/[0.06] px-6 py-5 text-sm leading-relaxed text-alert"
			>
				{problem}
			</p>
		{/if}

		<div class="mt-16 grid gap-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-24">
			<div class="max-w-[46rem]">
				<section aria-labelledby="ship-heading">
					<div class="flex items-baseline justify-between gap-6 border-b border-forest/15 pb-4">
						<h2 id="ship-heading" class="text-[10px] tracking-[0.28em] text-forest/60 uppercase">
							Delivering to
						</h2>
						<a
							href="/checkout/information"
							class="text-[10px] tracking-[0.2em] text-forest/60 uppercase underline-offset-4 hover:text-forest hover:underline"
						>
							Change
						</a>
					</div>
					<address class="mt-5 text-sm leading-[1.9] text-forest/80 not-italic">
						{data.ship.name}<br />
						{data.ship.line1}<br />
						{#if data.ship.line2}{data.ship.line2}<br />{/if}
						{data.ship.city}, {data.ship.state}
						{data.ship.pincode}<br />
						{SHIP_COUNTRY_LABEL}<br />
						{data.ship.phone} · {data.ship.email}
					</address>

					{#if data.ship.notes}
						<div class="mt-6 border-l-2 border-forest/20 pl-4">
							<p class="text-[10px] tracking-[0.28em] text-forest/60 uppercase">Your notes</p>
							<p class="mt-2 text-sm leading-relaxed text-forest/75">{data.ship.notes}</p>
						</div>
					{/if}
				</section>

				<section class="mt-14" aria-labelledby="pieces-heading">
					<h2 id="pieces-heading" class="text-[10px] tracking-[0.28em] text-forest/60 uppercase">
						Pieces
					</h2>
					<ul class="mt-5 flex list-none flex-col p-0">
						{#each data.cart.lines as line (line.variantId)}
							<li class="flex justify-between gap-6 border-b border-forest/10 py-5">
								<div>
									<p class="text-sm text-forest">{line.productName}</p>
									<p class="mt-1 text-[10px] tracking-[0.2em] text-forest/50 uppercase">
										{line.dropName} · Size {line.size} · {line.sku} · {line.quantity} ×
									</p>
									{#if line.isPreOrder}
										<p class="mt-2 text-xs leading-relaxed text-forest/70">
											Pre-order — dispatch follows the drop opening on
											{dispatchDate.format(data.launchInstant)}.
										</p>
									{/if}
									{#if line.overSubscribed}
										<p class="mt-2 text-xs leading-relaxed text-alert">
											Only {line.availableNow} of this size remain. Go back and reduce the quantity.
										</p>
									{/if}
								</div>
								<p class="shrink-0 text-sm text-forest tabular-nums">{formatInr(line.lineTotal)}</p>
							</li>
						{/each}
					</ul>
					<p class="mt-4 text-xs leading-relaxed text-forest/60">{FIT_DISCLAIMER}</p>
				</section>

				<section class="mt-14 border-t border-forest/15 pt-8" aria-labelledby="pay-heading">
					<h2 id="pay-heading" class="text-[10px] tracking-[0.28em] text-forest/60 uppercase">
						Payment
					</h2>

					{#if data.payment.configured}
						<p class="mt-4 max-w-[54ch] text-sm leading-relaxed text-forest/75">
							{#if data.payment.name === 'razorpay'}
								You will be handed to Razorpay to pay. Your order is confirmed by the gateway's own
								notification, not by the page you land back on — so a dropped connection cannot lose
								a paid order.
							{:else}
								This environment is running the stand-in gateway. It creates a real payment record
								and settles it through the same webhook the live gateway uses; it never moves money.
							{/if}
						</p>
					{:else}
						<p class="mt-4 max-w-[54ch] text-sm leading-relaxed text-forest/75">
							{PAYMENT_NOT_CONFIGURED_MESSAGE}
						</p>
					{/if}

					<form
						method="POST"
						action="?/place"
						class="mt-8"
						use:enhance={() => {
							placing = true;
							return async ({ update }) => {
								await update();
								placing = false;
							};
						}}
					>
						<Button surface="light" variant="solid" type="submit" disabled={placing} full>
							{placing ? 'Placing your order…' : 'Place order'}
						</Button>
					</form>

					<p class="mt-4 text-xs leading-relaxed text-forest/60">
						Pressing this twice is safe. A repeated submission returns the order you already placed
						rather than making a second one.
					</p>
				</section>
			</div>

			<div class="flex flex-col gap-8 lg:sticky lg:top-28 lg:self-start">
				{#if data.cart.soonestHoldMs !== null}
					<HoldTimer
						expiresAtMs={data.cart.soonestHoldMs}
						serverNowMs={data.cart.pricedAtMs}
						onexpire={() => invalidateAll()}
						surface="light"
					/>
				{/if}

				<CartSummary totals={data.cart.totals} shipping={data.cart.shipping} heading="Total">
					<Button surface="light" variant="quiet" href="/cart">Back to cart</Button>
				</CartSummary>

				{#if data.cart.couponCode && !data.cart.couponProblem}
					<p class="text-[10px] tracking-[0.2em] text-forest/60 uppercase">
						Code {data.cart.couponCode} applied
					</p>
				{/if}

				<!-- §11: the SAME returns wording, at checkout, as on the product
				     page, in the confirmation email and on the policy page. -->
				<section class="border-t border-forest/15 pt-6" aria-labelledby="returns-heading">
					<h2 id="returns-heading" class="text-[10px] tracking-[0.28em] text-forest/60 uppercase">
						Returns
					</h2>
					<p class="mt-4 text-xs leading-relaxed text-forest/70">{RETURNS_WORDING}</p>
				</section>
			</div>
		</div>
	</div>
</main>
