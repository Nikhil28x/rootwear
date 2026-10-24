<script lang="ts">
	import type { Snippet } from 'svelte';
	import { X } from '@lucide/svelte';

	/**
	 * A focused task, or confirmation of something that cannot be undone.
	 * Native <dialog>: focus trap, Escape and the backdrop come with it.
	 */
	let {
		open = $bindable(false),
		title,
		description = '',
		children,
		footer = undefined,
		onclose = undefined
	}: {
		open?: boolean;
		title: string;
		description?: string;
		children?: Snippet;
		footer?: Snippet;
		onclose?: () => void;
	} = $props();

	let dialog: HTMLDialogElement | undefined = $state();

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	});
</script>

<dialog
	bind:this={dialog}
	onclose={() => {
		open = false;
		onclose?.();
	}}
	class="modal m-auto w-[calc(100vw-32px)] max-w-[520px] rounded-[20px] bg-q-raised p-0 text-q-body"
	aria-labelledby="modal-title"
>
	<div class="flex flex-col gap-4 p-6">
		<div class="flex items-start justify-between gap-4">
			<div class="flex flex-col gap-1">
				<h2 id="modal-title" class="text-[18px] leading-[26px] font-semibold text-q-text">
					{title}
				</h2>
				{#if description}<p class="text-[14px] leading-[20px] text-q-secondary">
						{description}
					</p>{/if}
			</div>
			<button
				type="button"
				class="q-btn q-btn-ghost q-btn-icon -mt-1 -mr-2"
				aria-label="Close"
				onclick={() => dialog?.close()}
			>
				<X size={20} strokeWidth={1.5} />
			</button>
		</div>
		{#if children}{@render children()}{/if}
		{#if footer}<div class="flex flex-wrap justify-end gap-2 pt-2">{@render footer()}</div>{/if}
	</div>
</dialog>

<style>
	.modal {
		box-shadow: var(--q-shadow-modal);
		border: 0;
	}
	.modal::backdrop {
		background: rgba(24, 24, 27, 0.32);
	}
	.modal[open] {
		animation: modal-in 300ms ease-out;
	}
	@keyframes modal-in {
		from {
			transform: translateY(8px);
			opacity: 0;
		}
	}
</style>
