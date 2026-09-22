<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * The one button. Collapses the three near-identical inline treatments that
	 * were scattered across the homepage and drop page.
	 *
	 * `surface` says what it sits ON, not what colour it is — a button on cream
	 * and a button on forest-black need inverted treatments to read the same.
	 */
	let {
		children,
		href = undefined,
		type = 'button',
		variant = 'outline',
		surface = 'dark',
		disabled = false,
		full = false,
		class: klass = '',
		...rest
	}: {
		children: Snippet;
		href?: string;
		type?: 'button' | 'submit' | 'reset';
		variant?: 'outline' | 'solid' | 'quiet';
		surface?: 'dark' | 'light';
		disabled?: boolean;
		full?: boolean;
		class?: string;
		[key: string]: unknown;
	} = $props();

	const base =
		'inline-flex items-center justify-center gap-2 px-7 py-4 text-[11px] ' +
		'tracking-[0.2em] uppercase transition duration-300 ' +
		'disabled:cursor-not-allowed disabled:opacity-40';

	const styles = {
		'outline-dark': 'border border-white/35 text-stone-100 hover:bg-white hover:text-black',
		'outline-light': 'border border-forest text-forest hover:bg-forest hover:text-cream',
		'solid-dark': 'bg-cream text-forest hover:bg-white',
		'solid-light': 'bg-forest text-cream hover:bg-forest-black',
		'quiet-dark': 'text-stone-300 underline-offset-4 hover:text-white hover:underline',
		'quiet-light': 'text-forest/70 underline-offset-4 hover:text-forest hover:underline'
	} as const;

	let cls = $derived(
		[base, styles[`${variant}-${surface}` as keyof typeof styles], full ? 'w-full' : '', klass]
			.filter(Boolean)
			.join(' ')
	);
</script>

{#if href}
	<a {href} class={cls} aria-disabled={disabled || undefined} {...rest}>{@render children()}</a>
{:else}
	<button {type} {disabled} class={cls} {...rest}>{@render children()}</button>
{/if}
