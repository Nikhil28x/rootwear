<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import { Inbox } from '@lucide/svelte';

	/**
	 * What a screen shows when there is nothing in it yet: what would be here,
	 * one line of help, and the one action that fills it.
	 */
	let {
		title,
		body = '',
		icon = Inbox,
		action = undefined,
		compact = false
	}: {
		title: string;
		body?: string;
		icon?: Component<{ size?: number; strokeWidth?: number }>;
		action?: Snippet;
		compact?: boolean;
	} = $props();

	const Icon = $derived(icon);
</script>

<div
	class="flex flex-col items-center gap-3 text-center {compact ? 'px-6 py-10' : 'px-6 py-16'}"
	role="status"
>
	<span class="flex size-12 items-center justify-center rounded-full bg-q-muted text-q-tertiary">
		<Icon size={24} strokeWidth={1.5} />
	</span>
	<div class="flex max-w-[44ch] flex-col gap-1">
		<p class="text-[16px] leading-[24px] font-semibold text-q-text">{title}</p>
		{#if body}<p class="text-[14px] leading-[20px] text-q-secondary">{body}</p>{/if}
	</div>
	{#if action}<div class="mt-2">{@render action()}</div>{/if}
</div>
