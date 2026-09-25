<script lang="ts">
	import Eyebrow from '$lib/components/ui/Eyebrow.svelte';
	import RecordState from '$lib/components/account/RecordState.svelte';
	import { ORDER_COPY, shortDate, shortDateTime } from '$lib/components/account/state-labels';
	import { formatInr } from '$lib/money';
	import { FIT_DISCLAIMER } from '$lib/drop/sizes';
	import { RETURNS_WORDING } from '$lib/content/returns';
	import { GST_POSITION, SUPPORT_EMAIL } from '$lib/content/business';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let order = $derived(data.order);
	let copy = $derived(ORDER_COPY[order.state]);

	/**
	 * §10: displayed prices are INCLUSIVE of tax. The break-up is shown only if
	 * the business is GST-registered, which is a §15 open item — so this is
	 * read from one constant rather than assumed either way.
	 */
	let showTaxBreakUp = $derived(GST_POSITION.registered && order.tax > 0);
</script>

<svelte:head>
	<title>{order.orderNumber} — Rootwear</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<p class="text-[11px] tracking-[0.2em] uppercase font-medium">
	<a
		class="text-forest/70 underline-offset-4 hover:text-forest hover:underline"
		href="/account/orders"
	>
		Orders
	</a>
</p>

<Eyebrow tone="strong" class="mt-8 text-forest/70">Order</Eyebrow>
<h1
	class="display mt-5 text-[clamp(2.4rem,5.4vw,4.4rem)] leading-[0.9] tracking-[-0.05em] text-forest"
>
	{order.orderNumber}
</h1>

<div class="mt-8 flex flex-wrap items-center gap-5">
	<RecordState label={copy.label} tone={copy.tone} />
	<p class="text-[15px] text-forest/70">{copy.sentence}</p>
</div>

<p class="mt-4 text-[13px] text-forest/70">Placed {shortDate(order.placedAt)}</p>

<!-- §11: no carrier API in this phase. We show the reference we were given. -->
<section class="mt-14 border border-forest/20 px-6 py-7 sm:px-8" aria-labelledby="tracking-title">
	<h2 id="tracking-title" class="text-[11px] tracking-[0.28em] text-forest/65 uppercase font-medium">
		Tracking
	</h2>
	{#if order.trackingRef}
		<p class="mt-5 text-[15px] leading-[1.8] text-forest">
			<span class="block text-[13px] text-forest/70">{order.courierName ?? 'Courier'}</span>
			<span class="display text-[1.4rem] leading-none">{order.trackingRef}</span>
		</p>
		<p class="mt-4 max-w-[54ch] text-[13px] leading-[1.9] text-forest/75">
			Track this with {order.courierName ?? 'the courier'} using the reference above.
			{#if order.dispatchedAt !== null}
				Handed over {shortDateTime(order.dispatchedAt)}.
			{/if}
			{#if order.deliveredAt !== null}
				Marked delivered {shortDateTime(order.deliveredAt)}.
			{/if}
		</p>
	{:else}
		<p class="mt-5 max-w-[54ch] text-[15px] leading-[1.8] text-forest/70">
			Nothing to track yet. A courier and a reference appear here the moment this order is handed
			over, and we email them to you at the same time.
		</p>
	{/if}
</section>

<section class="mt-14" aria-labelledby="lines-title">
	<h2 id="lines-title" class="text-[11px] tracking-[0.28em] text-forest/65 uppercase font-medium">
		What is in it
	</h2>
	<p class="mt-4 max-w-[54ch] text-[13px] leading-relaxed text-forest/70">{FIT_DISCLAIMER}</p>

	<div class="mt-6 border border-forest/20">
		<div class="account-scroll overflow-x-auto">
			<table class="w-full min-w-[42rem] border-collapse text-[15px]">
				<caption class="sr-only">The pieces on order {order.orderNumber}</caption>
				<thead>
					<tr class="border-b border-forest/20 text-left">
						<th scope="col" class="px-5 py-4 text-[11px] tracking-[0.2em] text-forest/70 uppercase font-medium">
							Piece
						</th>
						<th scope="col" class="px-5 py-4 text-[11px] tracking-[0.2em] text-forest/70 uppercase font-medium">
							Size
						</th>
						<th scope="col" class="px-5 py-4 text-[11px] tracking-[0.2em] text-forest/70 uppercase font-medium">
							Price paid
						</th>
						<th scope="col" class="px-5 py-4 text-[11px] tracking-[0.2em] text-forest/70 uppercase font-medium">
							Qty
						</th>
						<th
							scope="col"
							class="px-5 py-4 text-right text-[11px] tracking-[0.2em] text-forest/70 uppercase font-medium"
						>
							Line total
						</th>
					</tr>
				</thead>
				<tbody>
					{#each order.lines as line (line.id)}
						<tr class="border-b border-forest/10 last:border-b-0">
							<th scope="row" class="px-5 py-5 text-left font-normal text-forest">
								{line.name}
								<span class="block text-[13px] text-forest/70">{line.sku}</span>
								{#if line.pieceNumber !== null}
									<span class="block text-[13px] text-forest/75">
										Hand-numbered piece {String(line.pieceNumber).padStart(2, '0')}
									</span>
								{/if}
							</th>
							<td class="px-5 py-5 text-forest/70">{line.size ?? '—'}</td>
							<td class="px-5 py-5 whitespace-nowrap text-forest">
								{formatInr(line.unitPrice)}
								<span class="block text-[13px] text-forest/70">
									{line.priceSource === 'prelaunch_locked' ? 'Pre-launch, locked' : 'Launch price'}
								</span>
							</td>
							<td class="px-5 py-5 text-forest/70">{line.quantity}</td>
							<td class="px-5 py-5 text-right whitespace-nowrap text-forest">
								{formatInr(line.lineTotal)}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>

	<p class="mt-5 max-w-[62ch] text-[13px] leading-[1.9] text-forest/70">
		These are the prices charged on the day this order was placed, kept as they were. They are not
		re-read from today's catalogue.
	</p>
</section>

<div class="mt-14 grid gap-14 lg:grid-cols-2 lg:gap-20">
	<section aria-labelledby="totals-title">
		<h2 id="totals-title" class="text-[11px] tracking-[0.28em] text-forest/65 uppercase font-medium">Total</h2>
		<dl class="mt-6 flex flex-col gap-px border-t border-forest/15">
			<div class="flex items-baseline justify-between gap-6 border-b border-forest/15 py-4">
				<dt class="text-[15px] text-forest/70">Pieces</dt>
				<dd class="text-[15px] text-forest">{formatInr(order.subtotal)}</dd>
			</div>
			<div class="flex items-baseline justify-between gap-6 border-b border-forest/15 py-4">
				<dt class="text-[15px] text-forest/70">Shipping</dt>
				<dd class="text-[15px] text-forest">
					{order.shipping > 0 ? formatInr(order.shipping) : 'Included'}
				</dd>
			</div>
			{#if order.discount > 0}
				<div class="flex items-baseline justify-between gap-6 border-b border-forest/15 py-4">
					<dt class="text-[15px] text-forest/70">Discount</dt>
					<dd class="text-[15px] text-forest">−{formatInr(order.discount)}</dd>
				</div>
			{/if}
			<div class="flex items-baseline justify-between gap-6 border-b border-forest/15 py-5">
				<dt class="text-[11px] tracking-[0.2em] text-forest uppercase font-medium">Paid</dt>
				<dd class="display text-[1.6rem] leading-none text-forest">{formatInr(order.total)}</dd>
			</div>
		</dl>
		<p class="mt-5 max-w-[46ch] text-[13px] leading-[1.9] text-forest/70">
			{#if showTaxBreakUp}
				Inclusive of {formatInr(order.tax)} GST. The break-up and our GSTIN are on the invoice.
			{:else}
				All prices are inclusive of tax.
			{/if}
		</p>
	</section>

	<section aria-labelledby="address-title">
		<h2 id="address-title" class="text-[11px] tracking-[0.28em] text-forest/65 uppercase font-medium">
			Delivered to
		</h2>
		<address class="mt-6 text-[15px] leading-[1.9] text-forest/80 not-italic">
			{order.shipTo.name}<br />
			{order.shipTo.line1}<br />
			{#if order.shipTo.line2}{order.shipTo.line2}<br />{/if}
			{order.shipTo.city}, {order.shipTo.state}
			{order.shipTo.pincode}<br />
			{order.shipTo.country}<br />
			{order.shipTo.phone}
		</address>
		{#if order.notes}
			<p class="mt-6 max-w-[46ch] text-[13px] leading-[1.9] text-forest/75">
				<span class="block text-[11px] tracking-[0.28em] text-forest/65 uppercase font-medium">Your note</span>
				{order.notes}
			</p>
		{/if}
	</section>
</div>

<!-- §11: the SAME returns wording as the product page, checkout and policy. -->
<section class="mt-16 border-t border-forest/15 pt-10" aria-labelledby="returns-title">
	<h2 id="returns-title" class="text-[11px] tracking-[0.28em] text-forest/65 uppercase font-medium">Returns</h2>
	<p class="mt-5 max-w-[62ch] text-[15px] leading-[1.9] text-forest/70">{RETURNS_WORDING}</p>
	<p class="mt-4 text-[13px] text-forest/70">
		Write to
		<a class="underline underline-offset-4" href="mailto:{SUPPORT_EMAIL}">{SUPPORT_EMAIL}</a>
		with {order.orderNumber} in the subject line.
	</p>
</section>

<style>
	.account-scroll {
		scrollbar-width: thin;
		scrollbar-color: color-mix(in srgb, var(--color-forest) 28%, transparent) transparent;
	}
</style>
