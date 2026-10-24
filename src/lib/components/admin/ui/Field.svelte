<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * Label above, control, then helper or error below. The control is passed
	 * in and must carry `id={id}` plus `aria-describedby={describedBy}` so the
	 * helper and error are read with it.
	 */
	let {
		label,
		id,
		help = '',
		error = '',
		optional = false,
		class: className = '',
		children
	}: {
		label: string;
		id: string;
		help?: string;
		error?: string | null;
		optional?: boolean;
		class?: string;
		children: Snippet<[{ describedBy: string | undefined; invalid: boolean }]>;
	} = $props();

	let describedBy = $derived(
		[error ? `${id}-error` : '', help ? `${id}-help` : ''].filter(Boolean).join(' ') || undefined
	);
</script>

<div class="flex flex-col gap-2 {className}">
	<label class="q-label" for={id}>
		{label}
		{#if optional}<span class="font-normal text-q-tertiary"> (optional)</span>{/if}
	</label>
	{@render children({ describedBy, invalid: Boolean(error) })}
	{#if error}
		<p class="q-error" id="{id}-error">{error}</p>
	{:else if help}
		<p class="q-help" id="{id}-help">{help}</p>
	{/if}
</div>
