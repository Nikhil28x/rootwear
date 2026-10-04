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

<section class="summary" aria-labelledby="summary-heading">
	<h2 id="summary-heading" class="summary__head">{heading}</h2>

	<dl class="summary__sheet">
		<div class="summary__row">
			<dt>Subtotal</dt>
			<span class="summary__dots" aria-hidden="true"></span>
			<dd>{formatInr(totals.subtotal)}</dd>
		</div>

		{#if totals.discount > 0}
			<div class="summary__row">
				<dt>Discount</dt>
				<span class="summary__dots" aria-hidden="true"></span>
				<dd>−{formatInr(totals.discount)}</dd>
			</div>
		{/if}

		<div class="summary__row">
			<dt>{shipping.label}</dt>
			<span class="summary__dots" aria-hidden="true"></span>
			<dd>{shippingLabel}</dd>
		</div>

		<div class="summary__row summary__row--total">
			<dt>Total</dt>
			<dd>{formatInr(totals.total)}</dd>
		</div>
	</dl>

	<!-- §10: displayed prices are INCLUSIVE of GST. Stated plainly rather than
	     left for the customer to wonder about at the last step. -->
	<p class="summary__tax">
		{#if GST_POSITION.registered}
			Inclusive of GST · GSTIN {GST_POSITION.gstin}
		{:else}
			All prices inclusive of tax
		{/if}
	</p>

	{#if children}
		<div class="summary__actions">{@render children()}</div>
	{/if}
</section>

<style>
	/* A spec sheet, as on the homepage: label, dotted leader, value. */
	.summary {
		display: flex;
		flex-direction: column;
	}
	.summary__head {
		margin: 0;
		padding-bottom: 12px;
		border-bottom: 1px solid var(--color-forest-black);
		font-family: var(--font-display);
		font-weight: 400;
		font-size: clamp(1.45rem, 1.9vw, 1.75rem);
		line-height: 1.05;
		letter-spacing: -0.02em;
		color: var(--color-forest-black);
	}
	.summary__sheet {
		margin: 0;
	}
	.summary__row {
		display: flex;
		align-items: baseline;
		gap: 10px;
		padding: 12px 0;
		border-bottom: 1px solid rgb(11 15 11 / 0.14);
		font-size: 14px;
		color: var(--color-forest-black);
	}
	.summary__row dt {
		color: rgb(11 15 11 / 0.62);
		white-space: nowrap;
	}
	.summary__dots {
		flex: 1;
		min-width: 16px;
		border-bottom: 1px dotted rgb(11 15 11 / 0.35);
		transform: translateY(-4px);
	}
	.summary__row dd {
		margin: 0;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.summary__row--total {
		justify-content: space-between;
		padding: 18px 0 16px;
		border-bottom-color: var(--color-forest-black);
	}
	.summary__row--total dt {
		color: var(--color-forest-black);
		font-size: 15px;
	}
	.summary__row--total dd {
		font-family: var(--font-display);
		font-size: clamp(2rem, 2.8vw, 2.5rem);
		line-height: 1;
		letter-spacing: -0.025em;
		font-variant-numeric: lining-nums tabular-nums;
	}
	.summary__tax {
		margin-top: 10px;
		font-size: 13px;
		color: rgb(11 15 11 / 0.62);
	}
	.summary__actions {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 14px;
		margin-top: 22px;
		text-align: center;
	}
</style>
