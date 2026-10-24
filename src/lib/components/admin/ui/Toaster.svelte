<script lang="ts">
	import { CircleAlert, CircleCheck, X } from '@lucide/svelte';
	import type { Toaster } from '../toast.svelte';

	let { toaster }: { toaster: Toaster } = $props();
</script>

<div
	class="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:items-end"
	role="status"
	aria-live="polite"
>
	{#each toaster.items as toast (toast.id)}
		<div
			class="toast pointer-events-auto flex w-full max-w-[400px] items-center gap-3 rounded-[10px] bg-q-inverse py-3 pr-2 pl-4 text-[14px] leading-[20px] text-q-on-inverse"
		>
			{#if toast.tone === 'success'}
				<CircleCheck size={16} strokeWidth={1.5} class="flex-none text-[#4ade80]" />
			{:else if toast.tone === 'danger'}
				<CircleAlert size={16} strokeWidth={1.5} class="flex-none text-[#f87171]" />
			{/if}
			<p class="min-w-0 flex-1">{toast.message}</p>
			{#if toast.action}
				<button
					type="button"
					class="rounded-[8px] px-2 py-1 font-medium text-q-on-inverse underline underline-offset-2 hover:bg-white/10"
					onclick={async () => {
						const action = toast.action;
						toaster.dismiss(toast.id);
						await action?.run();
					}}>{toast.action.label}</button
				>
			{/if}
			<button
				type="button"
				class="flex size-8 flex-none items-center justify-center rounded-[8px] hover:bg-white/10"
				aria-label="Dismiss"
				onclick={() => toaster.dismiss(toast.id)}
			>
				<X size={16} strokeWidth={1.5} />
			</button>
		</div>
	{/each}
</div>

<style>
	.toast {
		animation: toast-in 200ms ease-out;
	}
	@keyframes toast-in {
		from {
			transform: translateY(8px);
			opacity: 0;
		}
	}
</style>
