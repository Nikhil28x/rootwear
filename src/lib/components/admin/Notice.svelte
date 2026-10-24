<script lang="ts">
	import type { Snippet } from 'svelte';
	import { CircleAlert, CircleCheck, Info, TriangleAlert } from '@lucide/svelte';

	/**
	 * Form results and standing warnings. `role="alert"` on failure and success
	 * so the outcome of a submit is announced, not merely drawn. A warning is a
	 * standing condition, so it is a plain region: announcing it on every
	 * render would be noise.
	 */
	let {
		children,
		kind = 'info'
	}: { children: Snippet; kind?: 'info' | 'warning' | 'error' | 'success' } = $props();

	const tone = {
		info: 'bg-q-muted text-q-body',
		warning: 'bg-q-warning-tint text-q-warning-text',
		error: 'bg-q-danger-tint text-q-danger-text',
		success: 'bg-q-success-tint text-q-success-text'
	} as const;

	let live = $derived(kind === 'error' || kind === 'success');
</script>

<div
	class="flex items-start gap-3 rounded-[10px] px-4 py-3 text-[14px] leading-[20px] {tone[kind]}"
	role={live ? 'alert' : undefined}
>
	<span class="mt-0.5 flex-none">
		{#if kind === 'error'}<CircleAlert size={16} strokeWidth={1.5} />
		{:else if kind === 'warning'}<TriangleAlert size={16} strokeWidth={1.5} />
		{:else if kind === 'success'}<CircleCheck size={16} strokeWidth={1.5} />
		{:else}<Info size={16} strokeWidth={1.5} />{/if}
	</span>
	<p class="min-w-0">{@render children()}</p>
</div>
