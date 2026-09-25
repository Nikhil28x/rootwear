<script lang="ts">
	/**
	 * One figure, with the thing it measures above it and the qualification
	 * below it. §12 asks for "summary before detail": these sit in a row at the
	 * top of a report and the tables underneath explain them.
	 *
	 * `severity` draws a left stripe. It is the second signal on the same fact
	 * — the number is already there in words — so a reader who cannot see the
	 * stripe loses nothing.
	 */
	let {
		label,
		value,
		note = '',
		severity = 'none'
	}: {
		label: string;
		value: string;
		note?: string;
		severity?: 'none' | 'watch' | 'act';
	} = $props();

	let stripe = $derived(
		severity === 'act'
			? 'border-l-2 border-l-cream'
			: severity === 'watch'
				? 'border-l-2 border-l-gold'
				: 'border-l border-l-white/10'
	);
</script>

<div class="flex flex-col gap-3 bg-forest/40 {stripe} px-5 py-6">
	<p class="text-[11px] tracking-[0.28em] text-stone-400 uppercase font-medium">{label}</p>
	<p class="display text-[clamp(1.9rem,3.2vw,2.9rem)] leading-[0.9] tracking-[-0.03em] text-paper tabular-nums">
		{value}
	</p>
	{#if note}
		<p class="text-[13px] leading-relaxed text-stone-400">{note}</p>
	{/if}
</div>
