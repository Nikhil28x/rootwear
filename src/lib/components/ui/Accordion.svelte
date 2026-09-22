<script lang="ts">
	import type { Snippet } from 'svelte';

	/** Native <details> so it works with no JS and keyboards get it for free. */
	let {
		title,
		children,
		open = false,
		surface = 'light'
	}: { title: string; children: Snippet; open?: boolean; surface?: 'light' | 'dark' } = $props();

	let rule = $derived(surface === 'light' ? 'border-forest/15' : 'border-white/15');
	let tone = $derived(surface === 'light' ? 'text-forest' : 'text-stone-100');
</script>

<details class="group border-b {rule}" {open}>
	<summary
		class="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-[12px] tracking-[0.18em] uppercase {tone} marker:hidden [&::-webkit-details-marker]:hidden font-medium"
	>
		{title}
		<span
			class="shrink-0 text-base transition-transform duration-300 group-open:rotate-45"
			aria-hidden="true">+</span
		>
	</summary>
	<div class="pb-6 text-[15px] leading-relaxed {surface === 'light' ? 'text-forest/75' : 'text-stone-400'}">
		{@render children()}
	</div>
</details>
