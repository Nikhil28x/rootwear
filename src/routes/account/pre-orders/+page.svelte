<script lang="ts">
	import Eyebrow from '$lib/components/ui/Eyebrow.svelte';
	import Callout from '$lib/components/account/Callout.svelte';
	import Empty from '$lib/components/account/Empty.svelte';
	import PreOrderCard from '$lib/components/account/PreOrderCard.svelte';
	import { formatInr } from '$lib/money';
	import { FIT_DISCLAIMER } from '$lib/drop/sizes';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Pre-orders — Rootwear</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<Eyebrow tone="strong" class="text-forest/70">Account</Eyebrow>
<h1
	class="display mt-6 text-[clamp(2.8rem,6.4vw,5.4rem)] leading-[0.86] tracking-[-0.055em] text-forest"
>
	Pre-orders.
</h1>
<p class="mt-8 max-w-[56ch] text-[16px] leading-[1.85] text-forest/70">
	The pieces you've reserved, and anything left to pay.
</p>

{#if data.outstandingCount > 0}
	<div class="mt-10 max-w-[64ch]">
		<Callout kind="error">
			You have {formatInr(data.outstanding)} to pay on
			{data.outstandingCount === 1 ? 'one pre-order' : `${data.outstandingCount} pre-orders`}. Pay
			by the due date to keep your piece.
		</Callout>
	</div>
{/if}

{#if data.records.length === 0}
	<div class="mt-14 max-w-[52rem]">
		<Empty title="No pre-orders." actionHref="/drops" actionLabel="See the current drop">
			<p>
				Reserve a piece with a deposit before a drop opens, and it will appear here.
			</p>
		</Empty>
	</div>
{:else}
	<!-- §09: the fit disclaimer accompanies every screen that shows a size. -->
	<p class="mt-12 max-w-[54ch] text-[13px] leading-relaxed text-forest/70">{FIT_DISCLAIMER}</p>

	<div class="mt-6 flex flex-col gap-10">
		{#each data.records as record (record.id)}
			<PreOrderCard {record} />
		{/each}
	</div>
{/if}
