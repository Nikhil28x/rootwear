<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * Every wide table in the admin area scrolls INSIDE ITS OWN CONTAINER. The
	 * page body must never scroll sideways: an admin screen is read on a laptop
	 * and a phone, and a by-size table with eight numeric columns does not fit
	 * on the second.
	 *
	 * The caption is a real <caption>, not a heading above the table, so a
	 * screen reader announces what the table is when it enters it.
	 */
	let {
		children,
		caption,
		captionVisible = true,
		note = ''
	}: { children: Snippet; caption: string; captionVisible?: boolean; note?: string } = $props();
</script>

<div class="border border-white/10">
	{#if captionVisible}
		<div class="flex flex-wrap items-baseline justify-between gap-3 border-b border-white/10 px-5 py-4">
			<p class="text-[10px] tracking-[0.28em] text-stone-300 uppercase">{caption}</p>
			{#if note}<p class="text-xs text-stone-500">{note}</p>{/if}
		</div>
	{/if}
	<div class="admin-scroll overflow-x-auto">
		<table class="w-full min-w-[46rem] border-collapse text-sm">
			<caption class="sr-only">{caption}</caption>
			{@render children()}
		</table>
	</div>
</div>

<style>
	/* A visible, quiet scrollbar: a table that scrolls should look like it does. */
	.admin-scroll {
		scrollbar-width: thin;
		scrollbar-color: color-mix(in srgb, var(--color-cream) 28%, transparent) transparent;
	}
</style>
