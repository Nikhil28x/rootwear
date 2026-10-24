<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * A titled table. The caption is also the table's accessible name, so a
	 * screen reader announces which of several tables on a page it is in.
	 */
	let {
		children,
		caption,
		captionVisible = true,
		note = ''
	}: { children: Snippet; caption: string; captionVisible?: boolean; note?: string } = $props();
</script>

<div class="q-table-wrap legacy-table">
	{#if captionVisible}
		<div
			class="flex flex-wrap items-baseline justify-between gap-3 border-b border-q-border px-4 py-3"
		>
			<p class="text-[14px] leading-[20px] font-semibold text-q-text">{caption}</p>
			{#if note}<p class="text-[13px] text-q-secondary">{note}</p>{/if}
		</div>
	{/if}
	<table class="q-table min-w-[46rem]">
		<caption class="sr-only">{caption}</caption>
		{@render children()}
	</table>
</div>

<style>
	/*
	 * Screens written before the CMS put uppercase, wide-tracked utility
	 * classes on their own <th> cells. Neutralised here so every table reads
	 * the same without rewriting each screen's markup.
	 */
	.legacy-table :global(th) {
		text-transform: none !important;
		letter-spacing: 0 !important;
		font-size: 13px !important;
		font-weight: 500 !important;
	}
	.legacy-table :global(td) {
		font-size: 14px;
	}
</style>
