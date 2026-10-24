<script lang="ts">
	import type { Snippet } from 'svelte';
	import { X } from '@lucide/svelte';

	/**
	 * A side panel for a record's details or a quick edit, on the native
	 * <dialog> so focus is trapped and Escape closes it without extra code.
	 */
	let {
		open = $bindable(false),
		title,
		description = '',
		width = 480,
		children,
		footer = undefined,
		onclose = undefined
	}: {
		open?: boolean;
		title: string;
		description?: string;
		width?: number;
		children: Snippet;
		footer?: Snippet;
		onclose?: () => void;
	} = $props();

	let dialog: HTMLDialogElement | undefined = $state();

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	});

	function closed() {
		open = false;
		onclose?.();
	}
</script>

<dialog
	bind:this={dialog}
	onclose={closed}
	onclick={(event) => {
		if (event.target === dialog) dialog?.close();
	}}
	class="drawer m-0 ml-auto h-dvh max-h-dvh w-full bg-q-raised p-0 text-q-body"
	style="max-width: min({width}px, 100vw)"
	aria-labelledby="drawer-title"
>
	<div class="flex h-full flex-col">
		<div class="flex items-start justify-between gap-4 border-b border-q-border px-6 py-4">
			<div class="flex flex-col gap-1">
				<h2 id="drawer-title" class="text-[18px] leading-[26px] font-semibold text-q-text">{title}</h2>
				{#if description}<p class="text-[13px] leading-[18px] text-q-secondary">{description}</p>{/if}
			</div>
			<button
				type="button"
				class="q-btn q-btn-ghost q-btn-icon -mr-2"
				aria-label="Close"
				onclick={() => dialog?.close()}
			>
				<X size={20} strokeWidth={1.5} />
			</button>
		</div>
		<div class="min-h-0 flex-1 overflow-y-auto px-6 py-6">{@render children()}</div>
		{#if footer}
			<div class="flex flex-wrap justify-end gap-2 border-t border-q-border px-6 py-4">
				{@render footer()}
			</div>
		{/if}
	</div>
</dialog>

<style>
	.drawer {
		box-shadow: var(--q-shadow-modal);
		border: 0;
	}
	.drawer::backdrop {
		background: rgba(24, 24, 27, 0.32);
	}
	.drawer[open] {
		animation: drawer-in 300ms ease-out;
	}
	@keyframes drawer-in {
		from {
			transform: translateX(8px);
			opacity: 0;
		}
	}
</style>
