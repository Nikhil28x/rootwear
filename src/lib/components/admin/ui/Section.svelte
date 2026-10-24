<script lang="ts">
	import type { Snippet } from 'svelte';

	/** A titled block within a screen. Space separates sections, not rules. */
	let {
		title,
		description = '',
		id = undefined,
		actions = undefined,
		children
	}: {
		title: string;
		description?: string;
		id?: string;
		actions?: Snippet;
		children: Snippet;
	} = $props();
</script>

<section class="flex flex-col gap-4" aria-labelledby={id}>
	<div class="flex flex-wrap items-end justify-between gap-3">
		<div class="flex flex-col gap-1">
			<h2 {id} class="text-[16px] leading-[24px] font-semibold text-q-text">{title}</h2>
			{#if description}
				<p class="max-w-[65ch] text-[13px] leading-[18px] text-q-secondary">{description}</p>
			{/if}
		</div>
		{#if actions}<div class="flex flex-wrap items-center gap-2">{@render actions()}</div>{/if}
	</div>
	{@render children()}
</section>
