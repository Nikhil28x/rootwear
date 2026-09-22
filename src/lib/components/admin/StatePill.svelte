<script lang="ts">
	import type { Tone } from './tone';

	/**
	 * A state, rendered so it can be picked out of a table without reading it.
	 * Fill and border weight carry the meaning; the text carries it too, so
	 * nothing here depends on colour vision (§ accessibility).
	 */
	let {
		label,
		tone = 'quiet',
		title = undefined
	}: { label: string; tone?: Tone; title?: string } = $props();

	const styles: Record<Tone, string> = {
		solid: 'bg-cream text-forest-black border-cream',
		attention: 'border-gold text-gold',
		outline: 'border-stone-500 text-stone-200',
		quiet: 'border-stone-700 text-stone-400'
	};
</script>

<span
	{title}
	class="inline-flex items-center border px-2.5 py-1 text-[11px] leading-none tracking-[0.18em] whitespace-nowrap uppercase {styles[
		tone
	]} font-medium"
>
	{label}
</span>
