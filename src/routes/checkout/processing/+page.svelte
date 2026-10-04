<script lang="ts">
	/**
	 * §04 — the pay step: first the payment itself, then waiting on the
	 * gateway, not on the browser.
	 *
	 * The poll below asks the SERVER whether the order has been paid. It never
	 * decides that itself, because the only thing that can decide it is the
	 * webhook. A visitor who closes this tab still gets a paid order; a visitor
	 * who sits here sees it land.
	 */
	import { goto, invalidateAll } from '$app/navigation';
	import { enhance } from '$app/forms';
	import '$lib/components/checkout/checkout.css';
	import CheckoutSteps from '$lib/components/checkout/CheckoutSteps.svelte';
	import RazorpayCheckout from '$lib/components/checkout/RazorpayCheckout.svelte';
	import { formatInr, multiplyPaise } from '$lib/money';
	import { SUPPORT_EMAIL } from '$lib/content/business';
	import { PAYMENT_NOT_CONFIGURED_MESSAGE } from '$lib/checkout/messages';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let problem = $derived(form && 'problem' in form ? form.problem : '');
	let elapsed = $state(0);
	/** Razorpay's modal reported success. Still not "paid" until the webhook lands. */
	let handedOff = $state(false);

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

	/**
	 * Closing the payment window cancels this order straight away, so its
	 * pieces go back on sale. The cart is kept; the checkout page explains and
	 * places a fresh order on the next Pay.
	 */
	async function abandon() {
		if (handedOff) return;
		const body = new FormData();
		body.set('order', data.order.publicToken);
		try {
			await fetch('?/abandon', { method: 'POST', body, headers: { 'x-sveltekit-action': 'true' } });
		} catch {
			// The expiry sweep cancels it later regardless.
		}
		await goto('/checkout/information?payment=cancelled', { invalidateAll: true });
	}

	/** The test payment went through; the webhook is on its way. */
	let settled = $derived(Boolean(form && 'settled' in form && form.settled));
	let notWired = $derived(data.payment.gatewayOrderId === null);
	/**
	 * Nothing has been paid yet: the buyer still has the payment to make. Only
	 * after the gateway's success handler (or the test payment) does the page
	 * say it is confirming anything.
	 */
	let awaiting = $derived(
		!notWired &&
			!handedOff &&
			!settled &&
			(data.payment.name === 'mock' ||
				(data.payment.name === 'razorpay' && Boolean(data.payment.keyId)))
	);
	let title = $derived(
		notWired ? 'Order placed' : awaiting ? 'Complete your payment' : 'Confirming your payment'
	);
</script>

<svelte:head>
	<title>{title} — Rootwear</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="co">
	<div class="co-grid co-grid--after">
		<header class="co-mast">
			<div class="co-mast__text">
				<h1 class="co-title">{title}</h1>
			</div>
			<CheckoutSteps current="pay" />
		</header>

		<div class="co-main proc">
			{#if notWired}
				<p class="co-lede">
					Your order {data.order.orderNumber} is placed.
				</p>
				<p class="co-note">{PAYMENT_NOT_CONFIGURED_MESSAGE}</p>
			{:else if awaiting}
				<p class="co-lede">
					Your order <span class="co-num">{data.order.orderNumber}</span> is reserved. Pay
					<span class="co-num">{formatInr(data.payment.amount)}</span> to confirm it.
				</p>
			{:else}
				<p class="co-lede proc-wait" aria-live="polite">
					{#if !givenUp}<span class="co-dot co-dot--pulse" aria-hidden="true"></span>{/if}
					<span>
						{#if givenUp}
							This is taking longer than usual. Your order number is {data.order.orderNumber} — if you've
							been charged, email {SUPPORT_EMAIL} and we'll sort it out.
						{:else}
							Confirming your payment… This usually takes a few seconds. You can safely close this
							page — we'll email your confirmation.
						{/if}
					</span>
				</p>
			{/if}

			{#if problem}
				<p role="alert" class="co-alert">{problem}</p>
			{/if}

			{#if !notWired && data.payment.name === 'mock' && !settled}
				<!-- The stand-in gateway. It posts a signed body to the real webhook
				     route, so the path exercised here is the path that runs live. -->
				<section class="proc-mock" aria-labelledby="mock-heading">
					<div>
						<h2 id="mock-heading" class="proc-mock__head">Test payment</h2>
						<p class="co-copy">
							Payments aren't live in this environment. Use this to simulate a successful payment.
						</p>
					</div>
					<form method="POST" action="?/settleMock" use:enhance>
						<input type="hidden" name="order" value={data.order.publicToken} />
						<button class="cta cta--full" type="submit">Simulate payment</button>
					</form>
				</section>
			{:else if !notWired && data.payment.name === 'razorpay' && data.payment.keyId && !handedOff}
				<div class="proc-pay">
					<RazorpayCheckout
						keyId={data.payment.keyId}
						gatewayOrderId={data.payment.gatewayOrderId!}
						amount={data.payment.amount}
						description="Order {data.order.orderNumber}"
						email={data.order.email}
						name={data.order.name}
						contact={data.order.phone}
						autoOpen
						verifyAction="?/verifyPayment"
						fields={{ order: data.order.publicToken }}
						timeoutSeconds={data.payment.secondsLeft}
						onPaid={() => {
							handedOff = true;
							void invalidateAll();
						}}
						onDismiss={abandon}
					/>
				</div>
			{/if}

			{#if awaiting}
				<p class="co-fine">
					Having trouble? Email <a class="link proc-inline" href="mailto:{SUPPORT_EMAIL}"
						>{SUPPORT_EMAIL}</a
					>.
				</p>
			{:else}
				<div class="proc-links">
					<!-- A link, not a button: with JavaScript off this is the whole poll. -->
					<a href="/checkout/processing?order={data.order.publicToken}" class="link">Check again</a>
					<a href="mailto:{SUPPORT_EMAIL}" class="link link--soft">{SUPPORT_EMAIL}</a>
				</div>
			{/if}
		</div>

		<aside class="co-aside co-card" aria-label="Order summary">
			<div class="co-head proc-head">
				<h2>Order</h2>
				<span class="co-label co-num">{data.order.orderNumber}</span>
			</div>
			<ul class="co-lines proc-lines">
				{#each data.order.lines as line (line.sku)}
					<li class="co-line proc-line">
						<span>
							<span class="co-line__name">{line.name}</span>
							<span class="co-line__meta"
								>{line.size ? `Size ${line.size} · ` : ''}{line.quantity} ×</span
							>
						</span>
						<span class="co-line__price"
							>{formatInr(multiplyPaise(line.unitPrice, line.quantity))}</span
						>
					</li>
				{/each}
			</ul>
			<dl class="co-spec">
				<div class="co-spec__row">
					<dt>Subtotal</dt>
					<span class="co-spec__dots" aria-hidden="true"></span>
					<dd>{formatInr(data.order.subtotal)}</dd>
				</div>
				{#if data.order.discount > 0}
					<div class="co-spec__row">
						<dt>Discount</dt>
						<span class="co-spec__dots" aria-hidden="true"></span>
						<dd>−{formatInr(data.order.discount)}</dd>
					</div>
				{/if}
				<div class="co-spec__row">
					<dt>Shipping</dt>
					<span class="co-spec__dots" aria-hidden="true"></span>
					<dd>{data.order.shipping === 0 ? 'Included' : formatInr(data.order.shipping)}</dd>
				</div>
				<div class="co-spec__row co-spec__row--total">
					<dt>Total</dt>
					<dd>{formatInr(data.order.total)}</dd>
				</div>
			</dl>
			<p class="co-fine proc-to">Confirmation to {data.order.email}</p>
		</aside>
	</div>
</main>

<style>
	.proc-wait {
		display: flex;
		align-items: baseline;
		gap: 12px;
	}
	.proc-wait .co-dot {
		transform: translateY(-2px);
	}
	.proc-mock {
		display: flex;
		flex-direction: column;
		gap: 20px;
		padding: 24px;
		border: 1px solid var(--rule);
	}
	.proc-mock__head {
		margin: 0 0 6px;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 1.5rem;
		letter-spacing: -0.02em;
	}
	.proc-pay :global(.pay) {
		max-width: none;
	}
	.proc-pay :global(> div) {
		margin-top: 0;
	}
	.proc-inline {
		font-size: inherit;
	}
	.proc-links {
		display: flex;
		flex-wrap: wrap;
		gap: 12px 28px;
	}
	.proc-head {
		border-bottom-color: var(--ink);
	}
	.proc-lines {
		margin-top: -16px;
	}
	.proc-line {
		grid-template-columns: minmax(0, 1fr) auto;
	}
	.proc-to {
		margin-top: -16px;
		overflow-wrap: anywhere;
	}
</style>
