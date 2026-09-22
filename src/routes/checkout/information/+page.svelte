<script lang="ts">
	/**
	 * §03 template 07 — Checkout, step one: where it goes.
	 *
	 * Every rule on this form is also enforced on the server (§10: "enforce at
	 * the address form AND at order creation, not just in copy"). The `pattern`
	 * attributes below are the browser's copy of the same expressions, so a
	 * mistake is caught before a round trip — not instead of one.
	 */
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import Button from '$lib/components/ui/Button.svelte';
	import Eyebrow from '$lib/components/ui/Eyebrow.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import HempMotif from '$lib/components/art/HempMotif.svelte';
	import CartSummary from '$lib/components/cart/CartSummary.svelte';
	import HoldTimer from '$lib/components/cart/HoldTimer.svelte';
	import { formatInr } from '$lib/money';
	import { RETURNS_WORDING } from '$lib/content/returns';
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

<main class="relative isolate overflow-hidden bg-cream text-forest">
	<div class="pointer-events-none absolute inset-0 -z-10 select-none" aria-hidden="true">
		<div class="absolute -top-32 -right-40 h-[36rem] w-[36rem] text-forest">
			<HempMotif opacity={0.04} seed={8} />
		</div>
	</div>

	<div class="mx-auto max-w-[1600px] px-5 py-24 sm:px-10 sm:py-32 lg:px-14">
		<Eyebrow tone="strong" class="text-forest/70">Checkout · Step one of two</Eyebrow>
		<h1
			class="display mt-6 text-[clamp(3rem,7vw,7rem)] leading-[0.82] tracking-[-0.055em] text-forest"
		>
			Where it<br />goes.
		</h1>

		<div class="mt-16 grid gap-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-24">
			<div class="max-w-[46rem]">
				{#if problem}
					<p
						role="alert"
						class="mb-10 border-l-2 border-alert bg-alert/[0.06] px-6 py-5 text-[15px] leading-relaxed text-alert"
					>
						{problem}
					</p>
				{/if}

				{#if errorList.length > 0}
					<!-- Errors are announced as a list, not merely coloured field by
					     field: a screen reader gets the whole picture in one place. -->
					<section
						role="alert"
						class="mb-10 border-l-2 border-alert bg-alert/[0.06] px-6 py-5"
						aria-labelledby="errors-title"
					>
						<h2 id="errors-title" class="text-[11px] tracking-[0.28em] text-alert uppercase font-medium">
							{errorList.length}
							{errorList.length === 1 ? 'thing needs' : 'things need'} fixing
						</h2>
						<ul class="mt-3 flex list-none flex-col gap-1 p-0 text-[15px] text-alert">
							{#each errorList as [key, text] (key)}
								<li>{text}</li>
							{/each}
						</ul>
					</section>
				{/if}

				{#if data.saved.length > 0}
					<section class="mb-12 border-b border-forest/15 pb-8" aria-labelledby="saved-title">
						<h2 id="saved-title" class="text-[11px] tracking-[0.28em] text-forest/75 uppercase font-medium">
							Saved addresses
						</h2>
						<div class="mt-5 flex flex-wrap gap-3">
							{#each data.saved as address (address.id)}
								<button
									type="button"
									onclick={() => useSaved(address.id)}
									class="border border-forest/25 px-5 py-3 text-left text-[13px] leading-relaxed text-forest/80 transition hover:border-forest hover:text-forest"
								>
									<span class="block text-[11px] tracking-[0.2em] text-forest uppercase font-medium">
										{address.label}
									</span>
									<span class="mt-1 block">{address.line1}, {address.city} {address.pincode}</span>
								</button>
							{/each}
						</div>
					</section>
				{/if}

				<form
					method="POST"
					class="flex flex-col gap-8"
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

					<fieldset class="flex flex-col gap-8 border-0 p-0">
						<legend class="text-[11px] tracking-[0.28em] text-forest/75 uppercase font-medium">Contact</legend>

						<Field
							label="Email"
							name="email"
							type="email"
							bind:value={values.email}
							required
							autocomplete="email"
							inputmode="email"
							error={errors?.email ?? ''}
							hint="Your order confirmation and dispatch note go here."
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
							hint="Ten digits, starting 6, 7, 8 or 9. The courier calls this on delivery."
						/>
					</fieldset>

					<fieldset class="flex flex-col gap-8 border-0 p-0">
						<legend class="text-[11px] tracking-[0.28em] text-forest/75 uppercase font-medium">
							Delivery address
						</legend>

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

						<div class="grid gap-8 sm:grid-cols-2">
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

						<Field
							label="State or union territory"
							name="state"
							bind:value={values.state}
							required
							options={[...STATE_OPTIONS]}
							error={errors?.state ?? ''}
						/>

						<div class="flex flex-col gap-2">
							<p class="text-[11px] tracking-[0.2em] text-forest/75 uppercase font-medium">Country</p>
							<p class="border-b border-forest/25 py-3 text-[15px] text-forest">
								{SHIP_COUNTRY_LABEL}
							</p>
							<p class="text-[13px] text-forest/70">
								We ship within India only at the moment. Nothing else can be selected, and the same
								rule is applied again when the order is created.
							</p>
						</div>
					</fieldset>

					<fieldset class="flex flex-col gap-8 border-0 p-0">
						<legend class="text-[11px] tracking-[0.28em] text-forest/75 uppercase font-medium">
							Order notes
						</legend>
						<Field
							label="Anything we should know (optional)"
							name="notes"
							rows={4}
							bind:value={values.notes}
							error={errors?.notes ?? ''}
							hint="A gate code, a delivery window, a gift note. Kept with the order and printed on the packing list."
						/>
					</fieldset>

					<div class="flex flex-wrap items-center gap-6 pt-2">
						<Button surface="light" variant="solid" type="submit" disabled={submitting}>
							{submitting ? 'Checking…' : 'Review order'}
						</Button>
						<Button surface="light" variant="quiet" href="/cart">Back to cart</Button>
					</div>
				</form>
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

				<section aria-labelledby="items-heading">
					<h2 id="items-heading" class="text-[11px] tracking-[0.28em] text-forest/75 uppercase font-medium">
						In this order
					</h2>
					<ul class="mt-5 flex list-none flex-col gap-4 p-0">
						{#each data.cart.lines as line (line.variantId)}
							<li class="flex justify-between gap-4 border-b border-forest/10 pb-4 text-[15px]">
								<span class="text-forest/80">
									{line.productName}
									<span class="block text-[11px] tracking-[0.2em] text-forest/70 uppercase font-medium">
										Size {line.size} · {line.quantity} ×
									</span>
								</span>
								<span class="text-forest tabular-nums">{formatInr(line.lineTotal)}</span>
							</li>
						{/each}
					</ul>
					<!-- §09: the fit disclaimer follows the size wherever it appears. -->
					<p class="mt-4 text-[13px] leading-relaxed text-forest/75">{FIT_DISCLAIMER}</p>
				</section>

				<CartSummary totals={data.cart.totals} shipping={data.cart.shipping} />

				{#if data.cart.hasPreOrderLine}
					<!-- §03 template 07: the pre-order dispatch note, where a line is
					     a pre-order. It states the drop instant and nothing more. -->
					<p class="border-l-2 border-gold pl-4 text-[13px] leading-relaxed text-forest/75">
						<span class="block text-[11px] tracking-[0.28em] text-forest uppercase font-medium">
							Pre-order dispatch
						</span>
						<span class="mt-2 block">
							At least one piece here is cut for the drop. Dispatch follows the drop opening on
							{dispatchDate.format(data.launchInstant)}, and the hand number is allocated when
							payment confirms.
						</span>
					</p>
				{/if}

				{#if !data.codEnabled}
					<!-- §10: COD is off for Drop 01. Said before the payment step, not
					     discovered at it. -->
					<p class="text-[13px] leading-relaxed text-forest/75">
						Cash on delivery is not available for this drop.
					</p>
				{/if}

				<!-- §11: the SAME returns wording as the product page, the
				     confirmation email and the returns policy page. -->
				<section class="border-t border-forest/15 pt-6" aria-labelledby="returns-heading">
					<h2 id="returns-heading" class="text-[11px] tracking-[0.28em] text-forest/75 uppercase font-medium">
						Returns
					</h2>
					<p class="mt-4 text-[13px] leading-relaxed text-forest/70">{RETURNS_WORDING}</p>
				</section>
			</div>
		</div>
	</div>
</main>
