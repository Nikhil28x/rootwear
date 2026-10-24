<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * The heading block for a screen (level 1) or a section in it (level 2).
	 * One h1 per page. Kept for screens written before PageHeader existed;
	 * the eyebrow is dropped in the new style, since the sidebar already says
	 * where you are.
	 */
	let {
		// Accepted for older screens; the sidebar already says where you are.
		eyebrow: _eyebrow = '',
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

<div class="flex flex-wrap items-end justify-between gap-4">
	<div class="flex max-w-[65ch] flex-col gap-2">
		{#if level === 1}
			<h1 class="text-[24px] leading-[32px] font-semibold tracking-[-0.01em] text-q-text">
				{title}
			</h1>
		{:else}
			<h2 class="text-[16px] leading-[24px] font-semibold text-q-text">{title}</h2>
		{/if}
		{#if note}
			<p class="text-[14px] leading-[20px] text-q-secondary">{note}</p>
		{/if}
	</div>
	{#if actions}
		<div class="flex flex-wrap items-center gap-2">{@render actions()}</div>
	{/if}
</div>
