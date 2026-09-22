<script lang="ts">
	/**
	 * §04 — waiting on the gateway, not on the browser.
	 *
	 * The poll below asks the SERVER whether the order has been paid. It never
	 * decides that itself, because the only thing that can decide it is the
	 * webhook. A visitor who closes this tab still gets a paid order; a visitor
	 * who sits here sees it land.
	 */
	import { invalidateAll } from '$app/navigation';
	import { enhance } from '$app/forms';
	import Button from '$lib/components/ui/Button.svelte';
	import Eyebrow from '$lib/components/ui/Eyebrow.svelte';
	import { formatInr } from '$lib/money';
	import { SUPPORT_EMAIL } from '$lib/content/business';
	import { PAYMENT_NOT_CONFIGURED_MESSAGE } from '$lib/checkout/messages';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let problem = $derived(form && 'problem' in form ? form.problem : '');
	let elapsed = $state(0);

	const POLL_MS = 3000;
	/** After two minutes the poll stops and the page says what to do instead. */
	const GIVE_UP_MS = 120_000;

	$effect(() => {
		// Re-created whenever the load data changes, which is what stops the
		// poll the moment the server redirects to the confirmation.
		void data.order.publicToken;

		const started = performance.now();
		const id = setInterval(() => {
			elapsed = performance.now() - started;
			if (elapsed > GIVE_UP_MS) {
				clearInterval(id);
				return;
			}
			void invalidateAll();
		}, POLL_MS);

		return () => clearInterval(id);
	});

	let givenUp = $derived(elapsed > GIVE_UP_MS);
</script>

<svelte:head>
	<title>Confirming your payment — Rootwear</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="relative isolate overflow-hidden bg-cream text-forest">
	<div class="mx-auto max-w-[1600px] px-5 py-24 sm:px-10 sm:py-32 lg:px-14">
		<div class="max-w-[46rem]">
			<Eyebrow tone="strong" class="text-forest/50">Order {data.order.orderNumber}</Eyebrow>
			<h1
				class="display mt-6 text-[clamp(3rem,7vw,7rem)] leading-[0.82] tracking-[-0.055em] text-forest"
			>
				Confirming<br />with the bank.
			</h1>

			<p class="mt-8 max-w-[54ch] text-[15px] leading-[1.85] text-forest/70" aria-live="polite">
				{#if givenUp}
					This is taking longer than it should. Your order is recorded as
					{data.order.orderNumber} and nothing is lost. Write to {SUPPORT_EMAIL} with that reference and
					we will confirm it by hand.
				{:else}
					Your order is placed and we are waiting for the payment notification. This page updates
					itself — you do not need to refresh, and closing it will not lose the order.
				{/if}
			</p>

			<dl class="mt-12 flex list-none flex-col gap-3 border-t border-forest/15 pt-8 text-sm">
				<div class="flex justify-between gap-6">
					<dt class="text-forest/70">Order</dt>
					<dd class="m-0 text-forest tabular-nums">{data.order.orderNumber}</dd>
				</div>
				<div class="flex justify-between gap-6">
					<dt class="text-forest/70">Total</dt>
					<dd class="m-0 text-forest tabular-nums">{formatInr(data.order.total)}</dd>
				</div>
				<div class="flex justify-between gap-6">
					<dt class="text-forest/70">Confirmation to</dt>
					<dd class="m-0 text-forest">{data.order.email}</dd>
				</div>
			</dl>

			{#if problem}
				<p
					role="alert"
					class="mt-10 border-l-2 border-alert bg-alert/[0.06] px-6 py-5 text-sm leading-relaxed text-alert"
				>
					{problem}
				</p>
			{/if}

			{#if data.payment.gatewayOrderId === null}
				<p class="mt-10 border-l-2 border-gold pl-4 text-sm leading-relaxed text-forest/75">
					{PAYMENT_NOT_CONFIGURED_MESSAGE}
				</p>
			{:else if data.payment.name === 'mock'}
				<!-- The stand-in gateway. It posts a signed body to the real webhook
				     route, so the path exercised here is the path that runs live. -->
				<section class="mt-12 border-t border-forest/15 pt-8" aria-labelledby="mock-heading">
					<h2 id="mock-heading" class="text-[10px] tracking-[0.28em] text-forest/60 uppercase">
						Stand-in gateway
					</h2>
					<p class="mt-4 max-w-[54ch] text-sm leading-relaxed text-forest/70">
						Razorpay is not switched on in this environment. Settling here posts a signed
						notification to the same webhook the live gateway calls — raw body, HMAC, event-id
						de-duplication and all. No money moves.
					</p>
					<form method="POST" action="?/settleMock" class="mt-6" use:enhance>
						<input type="hidden" name="order" value={data.order.publicToken} />
						<Button surface="light" variant="outline" type="submit">Settle this payment</Button>
					</form>
				</section>
			{/if}

			<div class="mt-12 flex flex-wrap items-center gap-6">
				<!-- A link, not a button: with JavaScript off this is the whole poll. -->
				<a
					href="/checkout/processing?order={data.order.publicToken}"
					class="text-[10px] tracking-[0.2em] text-forest/60 uppercase underline-offset-4 hover:text-forest hover:underline"
				>
					Check again
				</a>
				<a
					href="mailto:{SUPPORT_EMAIL}"
					class="text-[10px] tracking-[0.2em] text-forest/60 uppercase underline-offset-4 hover:text-forest hover:underline"
				>
					{SUPPORT_EMAIL}
				</a>
			</div>
		</div>
	</div>
</main>
