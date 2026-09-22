<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * The heading block every admin screen opens with. `level` exists because
	 * one page carries exactly one h1 — the screen title — and every section
	 * inside it is an h2.
	 */
	let {
		eyebrow = '',
		title,
		note = '',
		level = 2,
		actions = undefined
	}: {
		eyebrow?: string;
		title: string;
		note?: string;
		level?: 1 | 2;
		actions?: Snippet;
	} = $props();
</script>

<div class="flex flex-wrap items-end justify-between gap-6">
	<div class="flex flex-col gap-3">
		{#if eyebrow}
			<p class="text-[10px] tracking-[0.28em] text-stone-500 uppercase">{eyebrow}</p>
		{/if}
		{#if level === 1}
			<h1 class="display text-[clamp(2.2rem,4.4vw,3.6rem)] leading-[0.9] tracking-[-0.045em] text-cream">
				{title}
			</h1>
		{:else}
			<h2 class="display text-[clamp(1.6rem,2.6vw,2.3rem)] leading-[0.95] tracking-[-0.035em] text-cream">
				{title}
			</h2>
		{/if}
		{#if note}
			<p class="max-w-[46rem] text-sm leading-relaxed text-stone-400">{note}</p>
		{/if}
	</div>
	{#if actions}
		<div class="flex flex-wrap items-center gap-3">{@render actions()}</div>
	{/if}
</div>
