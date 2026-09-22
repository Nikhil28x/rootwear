<script lang="ts">
	import type { Snippet } from 'svelte';
	import Button from '$lib/components/ui/Button.svelte';

	/**
	 * An empty list is a real state, not a blank. §10 keeps guest checkout on
	 * and offers an account after purchase, so "nothing here" is the FIRST
	 * thing most account holders see — it has to say why, and where to go.
	 */
	let {
		title,
		children,
		actionHref = '',
		actionLabel = ''
	}: {
		title: string;
		children: Snippet;
		actionHref?: string;
		actionLabel?: string;
	} = $props();
</script>

<div class="border border-forest/15 px-7 py-12 sm:px-10 sm:py-16">
	<p class="display text-[clamp(1.6rem,2.6vw,2.2rem)] leading-[1.1] text-forest">{title}</p>
	<div class="mt-4 max-w-[46ch] text-sm leading-[1.85] text-forest/70">
		{@render children()}
	</div>
	{#if actionHref && actionLabel}
		<div class="mt-8">
			<Button href={actionHref} surface="light">{actionLabel}</Button>
		</div>
	{/if}
</div>
