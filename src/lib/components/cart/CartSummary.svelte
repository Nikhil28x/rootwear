<script lang="ts">
	/**
	 * The money, in one column. §03 template 06.
	 *
	 * Every figure arrives as integer paise and is formatted HERE, at the render
	 * edge, by formatInr(). No server module returns a formatted string, and no
	 * total is added up in the browser — this column displays what the server
	 * computed and nothing else (§04).
	 */
	import { formatInr } from '$lib/money';
	import { GST_POSITION } from '$lib/content/business';
	import type { Snippet } from 'svelte';
	import type { CartTotals, ShippingEstimate } from '$lib/server/cart/types';

	let {
		totals,
		shipping,
		heading = 'Summary',
		children
	}: {
		totals: CartTotals;
		shipping: ShippingEstimate;
		heading?: string;
		children?: Snippet;
	} = $props();

	/** §10: a zero rate is "included", not "₹0" — the latter reads like a bug. */
	let shippingLabel = $derived(totals.shipping === 0 ? 'Included' : formatInr(totals.shipping));
</script>

<section class="flex flex-col gap-5" aria-labelledby="summary-heading">
	<h2 id="summary-heading" class="text-[10px] tracking-[0.28em] text-forest/60 uppercase">
		{heading}
	</h2>

	<dl class="m-0 flex flex-col gap-3 text-sm">
		<div class="flex items-baseline justify-between gap-6">
			<dt class="text-forest/70">Subtotal</dt>
			<dd class="m-0 text-forest tabular-nums">{formatInr(totals.subtotal)}</dd>
		</div>

		{#if totals.discount > 0}
			<div class="flex items-baseline justify-between gap-6">
				<dt class="text-forest/70">Discount</dt>
				<dd class="m-0 text-forest tabular-nums">−{formatInr(totals.discount)}</dd>
			</div>
		{/if}

		<div class="flex items-baseline justify-between gap-6">
			<dt class="text-forest/70">{shipping.label}</dt>
			<dd class="m-0 text-forest tabular-nums">{shippingLabel}</dd>
		</div>

		<div
			class="mt-2 flex items-baseline justify-between gap-6 border-t border-forest/20 pt-4 text-base"
		>
			<dt class="text-forest">Total</dt>
			<dd class="m-0 text-forest tabular-nums">{formatInr(totals.total)}</dd>
		</div>
	</dl>

	<!-- §10: displayed prices are INCLUSIVE of GST. Stated plainly rather than
	     left for the customer to wonder about at the last step. -->
	<p class="text-[10px] tracking-[0.2em] text-forest/50 uppercase">
		{#if GST_POSITION.registered}
			Inclusive of GST · GSTIN {GST_POSITION.gstin}
		{:else}
			All prices inclusive of tax
		{/if}
	</p>

	{#if children}
		<div class="flex flex-col gap-4">{@render children()}</div>
	{/if}
</section>
