<script lang="ts">
	import Eyebrow from '$lib/components/ui/Eyebrow.svelte';
	import Empty from '$lib/components/account/Empty.svelte';
	import RecordState from '$lib/components/account/RecordState.svelte';
	import { ORDER_COPY, shortDate } from '$lib/components/account/state-labels';
	import { formatInr } from '$lib/money';
	import { RETURNS_WORDING } from '$lib/content/returns';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Orders — Rootwear</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<Eyebrow tone="strong" class="text-forest/70">Account</Eyebrow>
<h1
	class="display mt-6 text-[clamp(2.8rem,6.4vw,5.4rem)] leading-[0.86] tracking-[-0.055em] text-forest"
>
	Orders.
</h1>
<p class="mt-8 max-w-[54ch] text-[16px] leading-[1.85] text-forest/70">
	Every order, with the price you actually paid on the day. We keep the archive intact, so a piece
	bought during the tease still shows its locked price here long after the drop has closed.
</p>

{#if data.orders.length === 0}
	<div class="mt-14 max-w-[52rem]">
		<Empty title="No orders yet." actionHref="/drops" actionLabel="See the current drop">
			<p>
				If you ordered as a guest with a different email address, that history sits under that
				address. Write to us and we will attach it to this account.
			</p>
		</Empty>
	</div>
{:else}
	<!-- A wide table scrolls INSIDE its own container; the page body never does. -->
	<div class="mt-14 border border-forest/20">
		<div class="account-scroll overflow-x-auto">
			<table class="w-full min-w-[44rem] border-collapse text-[15px]">
				<caption class="sr-only">Your orders, most recent first</caption>
				<thead>
					<tr class="border-b border-forest/20 text-left">
						<th scope="col" class="px-5 py-4 text-[11px] tracking-[0.2em] text-forest/70 uppercase font-medium">
							Order
						</th>
						<th scope="col" class="px-5 py-4 text-[11px] tracking-[0.2em] text-forest/70 uppercase font-medium">
							Placed
						</th>
						<th scope="col" class="px-5 py-4 text-[11px] tracking-[0.2em] text-forest/70 uppercase font-medium">
							State
						</th>
						<th scope="col" class="px-5 py-4 text-[11px] tracking-[0.2em] text-forest/70 uppercase font-medium">
							Pieces
						</th>
						<th scope="col" class="px-5 py-4 text-[11px] tracking-[0.2em] text-forest/70 uppercase font-medium">
							Tracking
						</th>
						<th
							scope="col"
							class="px-5 py-4 text-right text-[11px] tracking-[0.2em] text-forest/70 uppercase font-medium"
						>
							Total
						</th>
					</tr>
				</thead>
				<tbody>
					{#each data.orders as order (order.id)}
						{@const copy = ORDER_COPY[order.state]}
						<tr class="border-b border-forest/10 last:border-b-0">
							<th scope="row" class="px-5 py-5 text-left font-normal">
								<a
									class="text-forest underline underline-offset-4 hover:text-forest/70"
									href="/account/orders/{order.orderNumber}"
								>
									{order.orderNumber}
								</a>
							</th>
							<td class="px-5 py-5 whitespace-nowrap text-forest/70">{shortDate(order.placedAt)}</td
							>
							<td class="px-5 py-5">
								<RecordState label={copy.label} tone={copy.tone} title={copy.sentence} />
							</td>
							<td class="px-5 py-5 text-forest/70">{order.itemCount}</td>
							<td class="px-5 py-5 text-forest/70">
								{#if order.trackingRef}
									<span class="block text-[13px] text-forest/70">{order.courierName ?? 'Courier'}</span>
									{order.trackingRef}
								{:else}
									<span class="text-forest/65">—</span>
								{/if}
							</td>
							<td class="px-5 py-5 text-right whitespace-nowrap text-forest">
								{formatInr(order.total)}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>

	<!-- §11: the SAME returns wording as the product page, checkout and policy. -->
	<p class="mt-10 max-w-[62ch] text-[13px] leading-[1.9] text-forest/70">{RETURNS_WORDING}</p>
{/if}

<style>
	/* A table that scrolls should look like it does. */
	.account-scroll {
		scrollbar-width: thin;
		scrollbar-color: color-mix(in srgb, var(--color-forest) 28%, transparent) transparent;
	}
</style>
