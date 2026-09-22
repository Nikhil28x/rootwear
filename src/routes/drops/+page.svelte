<script lang="ts">
	/**
	 * §03 template 03 — the archive. The proof-of-history page.
	 *
	 * Three movements, in the order they are read:
	 *   Growing now   — the drop that is alive, if one is.
	 *   Past growth   — every finished drop, kept alive, each with the §12
	 *                   request form beside it.
	 *   The index     — every drop ever, dated and marked. Nothing is deleted.
	 */
	import DropCard from '$lib/components/drop/DropCard.svelte';
	import DropStateMark from '$lib/components/drop/DropStateMark.svelte';
	import RequestDropForm from '$lib/components/drop/RequestDropForm.svelte';
	import Eyebrow from '$lib/components/ui/Eyebrow.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import RootSystem from '$lib/components/art/RootSystem.svelte';
	import HempMotif from '$lib/components/art/HempMotif.svelte';
	import { DROP_STATE_DESCRIPTION } from '$lib/domain/drop-state';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const released = new Intl.DateTimeFormat('en-IN', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		timeZone: 'Asia/Kolkata'
	});
</script>

<svelte:head>
	<title>Drops — Rootwear</title>
	<meta
		name="description"
		content="Every Rootwear drop, newest first. Each one stays up with its story, its imagery and its price intact."
	/>
</svelte:head>

<main class="mx-auto max-w-[1600px] px-5 py-24 sm:px-10 sm:py-32 lg:px-14">
	<header class="relative mb-24 flex flex-col gap-5 overflow-hidden">
		<div class="pointer-events-none absolute inset-x-0 -top-16 h-64 text-cream" aria-hidden="true">
			<RootSystem opacity={0.1} depth={7} />
		</div>

		<Eyebrow>The archive</Eyebrow>
		<h1 class="display text-[clamp(3rem,7vw,7rem)] leading-[0.82] tracking-[-0.055em]">
			Every growth<br />so far.
		</h1>
		<p class="max-w-md text-[15px] leading-relaxed text-stone-400">
			Nothing is ever taken down. A drop keeps its story, its imagery and its price long after the
			last piece has gone — and if you missed one, you can tell us the size you wanted.
		</p>
	</header>

	{#if data.growing}
		<section class="mb-28 border-t border-white/12 pt-12" aria-labelledby="growing-title">
			<div class="mb-10 flex flex-wrap items-baseline justify-between gap-4">
				<h2 id="growing-title" class="text-[11px] tracking-[0.28em] text-stone-400 uppercase font-medium">
					Growing now
				</h2>
				<DropStateMark state={data.growing.state} />
			</div>

			<div class="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
				<a class="group block overflow-hidden bg-white/5" href="/drops/{data.growing.slug}">
					{#if data.growing.cover}
						<img
							class="aspect-[16/11] w-full object-cover object-center transition duration-700 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
							src={data.growing.cover.url}
							alt={data.growing.cover.alt}
							loading="eager"
							decoding="async"
						/>
					{/if}
				</a>

				<div class="flex flex-col justify-center gap-6">
					<p class="text-[11px] tracking-[0.28em] text-stone-400 uppercase font-medium">
						Drop {String(data.growing.number).padStart(2, '0')} ·
						{data.growing.editionSize} numbered pieces
					</p>
					<p class="display text-[clamp(2.5rem,5vw,4.5rem)] leading-[0.88] tracking-[-0.045em]">
						{data.growing.name}
					</p>
					<p class="max-w-prose text-[15px] leading-relaxed text-stone-400">{data.growing.story}</p>
					<p class="max-w-prose text-[13px] leading-relaxed text-stone-400">
						{DROP_STATE_DESCRIPTION[data.growing.state]}
					</p>
					<div>
						<Button href="/drops/{data.growing.slug}" variant="solid">Open the drop</Button>
					</div>
				</div>
			</div>
		</section>
	{/if}

	<section class="relative border-t border-white/12 pt-12" aria-labelledby="past-title">
		<div
			class="pointer-events-none absolute inset-x-0 top-0 h-[32rem] text-cream"
			aria-hidden="true"
		>
			<HempMotif opacity={0.04} seed={3} />
		</div>

		<div class="relative mb-12 flex flex-col gap-4">
			<h2 id="past-title" class="text-[11px] tracking-[0.28em] text-stone-400 uppercase font-medium">
				Past growth
			</h2>
			<p class="max-w-lg text-[15px] leading-relaxed text-stone-400">
				Finished drops stay exactly as they were. Ask for one back and tell us your size — that is
				the number we cut against.
			</p>
		</div>

		{#if data.history.length === 0}
			<div class="relative border border-white/12 p-8 sm:p-12">
				<p class="display text-2xl leading-tight">The history starts with Drop 01.</p>
				<p class="mt-4 max-w-prose text-[15px] leading-relaxed text-stone-400">
					Nothing has finished yet. When a drop closes it moves here, with its lookbook and story
					intact, and a request form on every size.
				</p>
			</div>
		{:else}
			<ul class="relative flex flex-col gap-20">
				{#each data.history as entry (entry.card.slug)}
					<li class="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
						<DropCard card={entry.card} />

						<div class="flex flex-col gap-6">
							{#if entry.demand}
								<p class="text-[11px] tracking-[0.28em] text-stone-400 uppercase font-medium">
									<span class="text-gold tabular-nums">{entry.demand.total}</span>
									{entry.demand.total === 1 ? 'person has' : 'people have'} asked for this drop{#if entry.demand.topSize},
										most often in {entry.demand.topSize}{/if}.
								</p>
							{/if}

							{#if entry.card.canRequest}
								<RequestDropForm
									dropSlug={entry.card.slug}
									dropName={entry.card.name}
									sizeOptions={entry.card.sizeOptions}
									{form}
									source="drop_archive"
								/>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section class="mt-28 border-t border-white/12 pt-12" aria-labelledby="index-title">
		<h2 id="index-title" class="mb-8 text-[11px] tracking-[0.28em] text-stone-400 uppercase font-medium">
			The index
		</h2>

		<div class="overflow-x-auto">
			<table class="w-full min-w-[34rem] border-collapse text-left">
				<caption class="sr-only">Every Rootwear drop, newest first</caption>
				<thead>
					<tr
						class="border-b border-white/12 text-[11px] tracking-[0.28em] text-stone-400 uppercase font-medium"
					>
						<th scope="col" class="py-3 pr-4 font-normal">No.</th>
						<th scope="col" class="py-3 pr-4 font-normal">Drop</th>
						<th scope="col" class="py-3 pr-4 font-normal">Released</th>
						<th scope="col" class="py-3 font-normal">State</th>
					</tr>
				</thead>
				<tbody>
					{#each data.cards as card (card.slug)}
						<tr class="border-b border-white/8">
							<td class="py-4 pr-4 text-[13px] text-stone-400 tabular-nums">
								{String(card.number).padStart(2, '0')}
							</td>
							<th scope="row" class="py-4 pr-4 font-normal">
								<a class="story-link text-[15px] text-stone-100" href="/drops/{card.slug}"
									>{card.name}</a
								>
							</th>
							<td class="py-4 pr-4 text-[13px] text-stone-400">
								<time datetime={new Date(card.releasedAt).toISOString()}>
									{released.format(card.releasedAt)}
								</time>
							</td>
							<td class="py-4"><DropStateMark state={card.state} /></td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>
</main>
