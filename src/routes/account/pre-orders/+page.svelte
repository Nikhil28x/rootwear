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

<Eyebrow tone="strong" class="text-forest/50">Account</Eyebrow>
<h1
	class="display mt-6 text-[clamp(2.8rem,6.4vw,5.4rem)] leading-[0.86] tracking-[-0.055em] text-forest"
>
	Pre-orders.
</h1>
<p class="mt-8 max-w-[56ch] text-[15px] leading-[1.85] text-forest/70">
	One card for each piece you have reserved. The deposit, the balance, the piece number and the
	order it becomes are all one record here, because that is what they are — a reservation does not
	turn into a separate order behind your back.
</p>

{#if data.outstandingCount > 0}
	<div class="mt-10 max-w-[64ch]">
		<Callout kind="error">
			{formatInr(data.outstanding)} still to clear across
			{data.outstandingCount === 1 ? 'one reservation' : `${data.outstandingCount} reservations`}. A
			piece whose balance is not cleared in time is released to the next person in the queue.
		</Callout>
	</div>
{/if}

{#if data.records.length === 0}
	<div class="mt-14 max-w-[52rem]">
		<Empty title="No pre-orders." actionHref="/drops" actionLabel="See the current drop">
			<p>
				During a tease you can reserve a piece with a deposit. Its number is allocated the moment
				that deposit clears, and never before. Anything you reserve will appear here.
			</p>
		</Empty>
	</div>
{:else}
	<!-- §09: the fit disclaimer accompanies every screen that shows a size. -->
	<p class="mt-12 max-w-[54ch] text-xs leading-relaxed text-forest/55">{FIT_DISCLAIMER}</p>

	<div class="mt-6 flex flex-col gap-10">
		{#each data.records as record (record.id)}
			<PreOrderCard {record} />
		{/each}
	</div>

	<p class="mt-12 max-w-[62ch] text-xs leading-[1.9] text-forest/50">
		Cards are ordered by what needs you first, then by when you reserved. Nothing is ever removed
		from this list — a cancelled or released reservation stays, so the history stays readable.
	</p>
{/if}
