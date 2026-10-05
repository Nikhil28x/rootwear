<script lang="ts">
	/**
	 * §03 template 07 — Checkout, on one page: where it goes, what it is, and
	 * the button that places the order and opens payment. Nothing priced here
	 * is posted: the action recomputes everything (src/lib/server/checkout).
	 *
	 * Every rule on this form is also enforced on the server (§10: "enforce at
	 * the address form AND at order creation, not just in copy"). The `pattern`
	 * attributes below are the browser's copy of the same expressions, so a
	 * mistake is caught before a round trip — not instead of one.
	 */
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import '$lib/components/checkout/checkout.css';
	import CheckoutSteps from '$lib/components/checkout/CheckoutSteps.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import CartSummary from '$lib/components/cart/CartSummary.svelte';
	import HoldTimer from '$lib/components/cart/HoldTimer.svelte';
	import OrderPanel from '$lib/components/checkout/OrderPanel.svelte';
	import { formatInr } from '$lib/money';
	import { RETURNS_WORDING } from '$lib/content/returns';
	import { PAYMENT_NOT_CONFIGURED_MESSAGE } from '$lib/checkout/messages';
	import { FIT_DISCLAIMER } from '$lib/drop/sizes';
	import {
		PINCODE_PATTERN,
		PHONE_PATTERN,
		SHIP_COUNTRY,
		SHIP_COUNTRY_LABEL,
		STATE_OPTIONS,
		type AddressValues
	} from '$lib/checkout/address';
	import { invalidateAll } from '$app/navigation';
	import { srcsetOf } from '$lib/media/responsive';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	/**
	 * With JavaScript off the page re-renders fresh and these initialisers put
	 * the visitor's words back in the boxes. With it on, the component survives
	 * the round trip and the inputs never lost them.
	 */
	const seed = untrack(() => (form && 'values' in form ? form.values : data.values));

	let values = $state<AddressValues>({ ...seed });
	let submitting = $state(false);

	let errors = $derived(form && 'errors' in form ? form.errors : undefined);
	let problem = $derived(form && 'problem' in form ? form.problem : '');
	let payLabel = $derived(
		data.payment.configured ? `Pay ${formatInr(data.cart.totals.total)}` : 'Place order'
	);
	let errorList = $derived(
		Object.entries(errors ?? {}).filter(([, text]) => Boolean(text)) as Array<[string, string]>
	);

	const dispatchDate = new Intl.DateTimeFormat('en-GB', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		timeZone: 'Asia/Kolkata'
	});

	/** Fills the form from a saved address without a round trip. */
	function useSaved(id: string) {
		const saved = data.saved.find((address) => address.id === id);
		if (!saved) return;
		values = {
			...values,
			name: saved.name,
			line1: saved.line1,
			line2: saved.line2 ?? '',
			city: saved.city,
			state: saved.state,
			pincode: saved.pincode,
			phone: saved.phone
		};
	}
</script>

<svelte:head>
	<title>Checkout — Rootwear</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="co">
	<div class="co-grid">
		<header class="co-mast">
			<div class="co-mast__text">
				<h1 class="co-title">Checkout</h1>
			</div>
			<CheckoutSteps current="checkout" />
		</header>

		<div class="co-main">
			{#if page.url.searchParams.get('payment') === 'cancelled' && !problem && errorList.length === 0}
				<div class="info-notices">
					<p role="status" class="co-note">
						Payment cancelled. Your cart is saved — press Pay when you're ready to try again.
					</p>
				</div>
			{/if}
			{#if problem || errorList.length > 0}
				<div class="info-notices">
					{#if problem}
						<p role="alert" class="co-alert">{problem}</p>
					{/if}

					{#if errorList.length > 0}
						<!-- Errors are announced as a list, not merely coloured field by
						     field: a screen reader gets the whole picture in one place. -->
						<section role="alert" class="co-alert" aria-labelledby="errors-title">
							<h2 id="errors-title" class="info-errors-title">
								{errorList.length}
								{errorList.length === 1 ? 'thing needs' : 'things need'} fixing
							</h2>
							<ul>
								{#each errorList as [key, text] (key)}
									<li>{text}</li>
								{/each}
							</ul>
						</section>
					{/if}
				</div>
			{/if}

			{#if data.saved.length > 0}
				<section aria-labelledby="saved-title">
					<div class="co-head"><h2 id="saved-title">Saved addresses</h2></div>
					<div class="co-saved info-saved">
						{#each data.saved as address (address.id)}
							<button type="button" onclick={() => useSaved(address.id)}>
								<b>{address.label}</b>
								<span>{address.line1}, {address.city} {address.pincode}</span>
							</button>
						{/each}
					</div>
				</section>
			{/if}

			<form
				method="POST"
				class="co-form"
				autocomplete="on"
				use:enhance={() => {
					submitting = true;
					return async ({ update }) => {
						await update();
						submitting = false;
					};
				}}
			>
				<!-- §10: India only. The country is stated and locked, not chosen:
				     a disabled select would post nothing and a free field would
				     invite a value the server has to refuse. -->
				<input type="hidden" name="country" value={SHIP_COUNTRY} />

				<fieldset>
					<legend>Contact</legend>

					<div class="co-form-pair">
						<Field
							label="Email"
							name="email"
							type="email"
							bind:value={values.email}
							required
							autocomplete="email"
							inputmode="email"
							error={errors?.email ?? ''}
							hint="We'll send your order confirmation here."
						/>

						<Field
							label="Mobile number"
							name="phone"
							type="tel"
							bind:value={values.phone}
							required
							autocomplete="tel-national"
							inputmode="tel"
							pattern={PHONE_PATTERN}
							maxlength={10}
							error={errors?.phone ?? ''}
							hint="10-digit mobile number, for delivery updates."
						/>
					</div>
				</fieldset>

				<fieldset>
					<legend>Delivery address</legend>

					<Field
						label="Full name"
						name="name"
						bind:value={values.name}
						required
						autocomplete="name"
						error={errors?.name ?? ''}
					/>

					<Field
						label="Address"
						name="line1"
						bind:value={values.line1}
						required
						autocomplete="address-line1"
						error={errors?.line1 ?? ''}
					/>

					<Field
						label="Apartment, landmark (optional)"
						name="line2"
						bind:value={values.line2}
						autocomplete="address-line2"
						error={errors?.line2 ?? ''}
					/>

					<div class="co-form-pair">
						<Field
							label="Town or city"
							name="city"
							bind:value={values.city}
							required
							autocomplete="address-level2"
							error={errors?.city ?? ''}
						/>

						<Field
							label="Pincode"
							name="pincode"
							bind:value={values.pincode}
							required
							autocomplete="postal-code"
							inputmode="numeric"
							pattern={PINCODE_PATTERN}
							maxlength={6}
							error={errors?.pincode ?? ''}
						/>
					</div>

					<div class="co-form-pair">
						<Field
							label="State or union territory"
							name="state"
							bind:value={values.state}
							required
							autocomplete="address-level1"
							options={[...STATE_OPTIONS]}
							error={errors?.state ?? ''}
						/>

						<div class="co-fixed">
							<p class="co-label">Country</p>
							<p class="co-fixed__value">{SHIP_COUNTRY_LABEL}</p>
							<p class="co-fine">We currently ship within India only.</p>
						</div>
					</div>
				</fieldset>

				<fieldset>
					<legend>Order notes</legend>
					<Field
						label="Anything we should know (optional)"
						name="notes"
						rows={3}
						autocomplete="off"
						bind:value={values.notes}
						error={errors?.notes ?? ''}
						hint="Delivery instructions or a gift note."
					/>
				</fieldset>

				<fieldset>
					<legend>Payment</legend>
					{#if data.payment.configured}
						<p class="co-copy">
							{#if data.payment.name === 'razorpay'}
								You'll pay securely with Razorpay — UPI, cards, netbanking and wallets.
							{:else}
								Payments aren't live in this environment. You'll be able to simulate a payment on
								the next page.
							{/if}
						</p>
					{:else}
						<p class="co-copy">{PAYMENT_NOT_CONFIGURED_MESSAGE}</p>
					{/if}
					{#if !data.codEnabled}
						<!-- §10: COD is off for Drop 01. Said before the payment step, not
						     discovered at it. -->
						<p class="co-fine">Cash on delivery isn't available for this drop.</p>
					{/if}
				</fieldset>

				<div class="info-actions">
					<button class="cta cta--full" type="submit" disabled={submitting}>
						{submitting ? 'Placing your order…' : payLabel}
					</button>
					<a class="link link--soft" href="/cart">Back to cart</a>
				</div>
			</form>
		</div>

		<aside class="co-aside" aria-label="Order summary">
			<OrderPanel total={formatInr(data.cart.totals.total)}>
				<section aria-labelledby="items-heading">
					<div class="co-head">
						<h2 id="items-heading">In this order</h2>
						{#if data.cart.soonestHoldMs !== null}
							<HoldTimer
								expiresAtMs={data.cart.soonestHoldMs}
								serverNowMs={data.cart.pricedAtMs}
								onexpire={() => invalidateAll()}
								surface="light"
							/>
						{/if}
					</div>
					<ul class="co-lines">
						{#each data.cart.lines as line (line.variantId)}
							<li class="co-line">
								<span class="co-line__thumb" aria-hidden="true">
									{#if line.image}<img
											src={line.image}
											srcset={srcsetOf(line.image)}
											sizes="96px"
											alt=""
											loading="lazy"
											decoding="async"
										/>{/if}
								</span>
								<span>
									<span class="co-line__name">{line.productName}</span>
									<span class="co-line__meta">Size {line.size} · {line.quantity} ×</span>
									{#if line.isPreOrder}
										<span class="co-line__meta">
											Pre-order — ships after the drop opens on
											{dispatchDate.format(data.launchInstant)}.
										</span>
									{/if}
									{#if line.overSubscribed}
										<span class="info-line-alert">
											Only {line.availableNow} left in this size. Go back to your cart to reduce the quantity.
										</span>
									{/if}
								</span>
								<span class="co-line__price">{formatInr(line.lineTotal)}</span>
							</li>
						{/each}
					</ul>
					<!-- §09: the fit disclaimer follows the size wherever it appears. -->
					<p class="co-fine info-fit">{FIT_DISCLAIMER}</p>
				</section>

				<CartSummary totals={data.cart.totals} shipping={data.cart.shipping} />

				{#if data.cart.couponCode && !data.cart.couponProblem}
					<p class="co-fine">
						Code <span class="info-code">{data.cart.couponCode}</span> applied
					</p>
				{/if}

				{#if data.cart.hasPreOrderLine}
					<!-- §03 template 07: the pre-order dispatch note, where a line is
					     a pre-order. It states the drop instant and nothing more. -->
					<p class="co-note">
						<b>Pre-order</b>
						Pre-order pieces ship after the drop opens on {dispatchDate.format(data.launchInstant)}.
					</p>
				{/if}

				<!-- §11: the SAME returns wording as the product page, the
				     confirmation email and the returns policy page. -->
				<section class="info-returns" aria-labelledby="returns-heading">
					<h2 id="returns-heading" class="co-label">Returns</h2>
					<p class="co-fine">{RETURNS_WORDING}</p>
				</section>
			</OrderPanel>
		</aside>
	</div>
</main>

<style>
	.info-notices {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.info-errors-title {
		margin: 0;
		font-size: 14px;
		font-weight: 500;
	}
	.info-saved {
		margin-top: 18px;
	}
	.info-actions {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
		margin-top: -8px;
	}
	.info-line-alert {
		display: block;
		margin-top: 4px;
		font-size: 13px;
		line-height: 1.5;
		color: var(--alert);
	}
	.info-code {
		color: var(--ink);
		letter-spacing: 0.06em;
	}
	.info-fit {
		margin-top: 12px;
	}
	.info-returns {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding-top: 18px;
		border-top: 1px solid var(--rule);
	}
	.info-returns h2 {
		margin: 0;
		font-weight: 400;
		color: var(--ink);
	}
</style>
