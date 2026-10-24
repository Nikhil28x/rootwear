<script lang="ts">
	import type { Snippet } from 'svelte';
	import { ArrowLeft } from '@lucide/svelte';

	/**
	 * The top of every admin screen: where you are, what this is, and the one
	 * primary action. Exactly one h1 per page, and it is this one.
	 */
	let {
		title,
		description = '',
		back = undefined,
		meta = undefined,
		actions = undefined
	}: {
		title: string;
		description?: string;
		back?: { href: string; label: string };
		meta?: Snippet;
		actions?: Snippet;
	} = $props();
</script>

<header class="flex flex-col gap-3">
	{#if back}
		<a
			href={back.href}
			class="inline-flex w-fit items-center gap-1.5 text-[13px] leading-[18px] text-q-secondary hover:text-q-text"
		>
			<ArrowLeft size={16} strokeWidth={1.5} />
			{back.label}
		</a>
	{/if}
	<div class="flex flex-wrap items-start justify-between gap-4">
		<div class="flex min-w-0 flex-col gap-2">
			<div class="flex flex-wrap items-center gap-3">
				<h1 class="text-[24px] leading-[32px] font-semibold tracking-[-0.01em] text-q-text">
					{title}
				</h1>
				{#if meta}{@render meta()}{/if}
			</div>
			{#if description}
				<p class="max-w-[65ch] text-[14px] leading-[20px] text-q-secondary">{description}</p>
			{/if}
		</div>
		{#if actions}
			<div class="flex flex-wrap items-center gap-2">{@render actions()}</div>
		{/if}
	</div>
</header>
