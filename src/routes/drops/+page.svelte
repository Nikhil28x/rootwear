<script lang="ts">
	/**
	 * §03 template 03 — the archive. The proof-of-history page.
	 *
	 * ONE grid of cards, deliberately. This page previously ran three stacked
	 * movements — growing now, past growth, and a full index — which repeated
	 * every drop up to three times and made the page long for no added fact.
	 * A drop is one card, and the card carries everything: what it is, where it
	 * sits in its life, its date, and the one action available on it.
	 */
	import DropStateMark from '$lib/components/drop/DropStateMark.svelte';
	import RequestDropForm from '$lib/components/drop/RequestDropForm.svelte';
	import Eyebrow from '$lib/components/ui/Eyebrow.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { isOnSale } from '$lib/domain/drop-state';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const day = new Intl.DateTimeFormat('en-IN', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		timeZone: 'Asia/Kolkata'
	});

	/**
	 * One line about where this drop sits in time — the fact people came for.
	 *
	 * The awkward case is a drop on sale AHEAD of its own instant (§06's manual
	 * push). Saying "Opens 24 September" beside a Live mark contradicts itself,
	 * so that case reads as the pre-order it actually is — matching the label
	 * the homepage drop cards carry.
	 */
	function dateLine(card: PageData['cards'][number], now: number) {
		const when = day.format(card.releasedAt);
		if (isOnSale(card.state)) {
			return card.releasedAt > now ? `Open for pre-order · ships after ${when}` : `Live since ${when}`;
		}
		if (card.state === 'TEASE' || card.state === 'REVEALED') return `Opens ${when}`;
		return `Was live ${when}`;
	}
</script>

<svelte:head>
	<title>The Drop — Rootwear</title>
	<meta
		name="description"
		content="Every Rootwear drop, newest first. Each one stays up with its story intact."
	/>
</svelte:head>

<main class="mx-auto max-w-[1600px] px-5 pt-20 pb-24 sm:px-10 lg:px-14">
	<header class="mb-14 flex flex-col gap-4">
		<Eyebrow>The Drop</Eyebrow>
		<h1 class="display text-[clamp(2.6rem,6vw,5.5rem)] leading-[0.86] tracking-[-0.05em]">
			Every growth<br />so far.
		</h1>
		<p class="max-w-[46ch] text-[15px] leading-relaxed text-forest/75">
			Nothing is ever taken down. Ask for a drop to come back and we will know how many of you
			want it, and in which size.
		</p>
	</header>

	<ul class="grid gap-x-10 gap-y-16 sm:grid-cols-2 lg:grid-cols-3">
		{#each data.cards as card, index (card.slug)}
			<li class="flex flex-col gap-5">
				<a class="group flex flex-col gap-5" href="/drops/{card.slug}">
					{#if card.cover}
						<img
							class="aspect-[4/5] w-full object-cover object-center transition duration-700 ease-out group-hover:scale-[1.03]"
							src={card.cover.url}
							alt={card.cover.alt}
							loading={index === 0 ? 'eager' : 'lazy'}
						/>
					{/if}

					<div class="flex flex-col gap-2">
						<div class="flex items-baseline justify-between gap-4">
							<span class="text-[11px] font-medium tracking-[0.2em] uppercase">
								Drop {String(card.number).padStart(2, '0')}
							</span>
							<span class="text-[11px] tracking-[0.16em] text-forest/75 uppercase">
								{card.editionSize} pieces
							</span>
						</div>
						<h2 class="display text-3xl leading-none tracking-[-0.03em]">{card.name}</h2>
					</div>
				</a>

				<div class="flex flex-wrap items-center gap-3">
					<DropStateMark state={card.state} surface="light" />
					<span class="text-[12px] tracking-[0.1em] text-forest/75">
						{dateLine(card, data.now)}
					</span>
				</div>

				{#if isOnSale(card.state)}
					<Button href="/drops/{card.slug}" surface="light" variant="outline">Shop the drop</Button>
				{:else if card.canRequest}
					<!--
						§12 demand board. No money is taken; one row per person per
						size, which is what makes the admin count worth reading.
					-->
					<RequestDropForm
						dropSlug={card.slug}
						dropName={card.name}
						sizeOptions={card.sizeOptions}
						surface="light"
						{form}
					/>
				{/if}
			</li>
		{/each}
	</ul>
</main>
