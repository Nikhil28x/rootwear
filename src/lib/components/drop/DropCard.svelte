<script lang="ts">
	/**
	 * §03 template 03 — one card in the chronological grid.
	 *
	 * "Drop number, name, release date, cover art and a clear state mark."
	 * The mark comes from DropState, never from counting stock (§06).
	 *
	 * The whole card is one link. The state mark sits outside the image rather
	 * than floating on top of it, because a word burned over artwork is the
	 * first thing to become unreadable on a dark photograph.
	 */
	import DropStateMark from './DropStateMark.svelte';
	import type { ArchiveCard } from './types';

	let {
		card,
		surface = 'dark',
		eager = false
	}: { card: ArchiveCard; surface?: 'dark' | 'light'; eager?: boolean } = $props();

	const released = new Intl.DateTimeFormat('en-IN', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		timeZone: 'Asia/Kolkata'
	});

	let muted = $derived(surface === 'light' ? 'text-forest/65' : 'text-stone-400');
	let faint = $derived(surface === 'light' ? 'text-forest/45' : 'text-stone-500');
	let plate = $derived(surface === 'light' ? 'bg-forest/5' : 'bg-white/5');
</script>

<article class="group flex flex-col gap-5">
	<a class="flex flex-col gap-5" href="/drops/{card.slug}">
		<div class="relative aspect-[4/5] w-full overflow-hidden {plate}">
			{#if card.cover}
				<img
					class="size-full object-cover object-center transition duration-700 ease-out group-hover:scale-[1.035] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
					src={card.cover.url}
					alt={card.cover.alt}
					loading={eager ? 'eager' : 'lazy'}
					decoding="async"
				/>
			{/if}
		</div>

		<div class="flex items-baseline justify-between gap-4">
			<span class="text-[10px] tracking-[0.28em] uppercase">
				Drop {String(card.number).padStart(2, '0')}
			</span>
			<time
				class="text-[10px] tracking-[0.2em] uppercase {faint}"
				datetime={new Date(card.releasedAt).toISOString()}
			>
				{released.format(card.releasedAt)}
			</time>
		</div>

		<h3 class="display text-3xl leading-none tracking-[-0.03em]">{card.name}</h3>
	</a>

	<div class="flex flex-wrap items-center gap-3">
		<DropStateMark state={card.state} {surface} />
		<span class="text-[10px] tracking-[0.2em] uppercase {faint}">
			{card.editionSize} pieces
		</span>
	</div>

	<p class="max-w-prose text-sm leading-relaxed {muted}">{card.story}</p>
</article>
