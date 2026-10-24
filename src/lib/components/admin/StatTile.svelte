<script lang="ts">
	/**
	 * One figure, with the thing it measures above it and the qualification
	 * below it. Summary before detail: these sit in a row at the top of a
	 * report and the tables underneath explain them.
	 *
	 * `severity` marks a figure that needs attention. It is carried by a chip
	 * with words in it, never by colour alone.
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
</script>

<div class="q-card flex flex-col gap-2 p-5">
	<div class="flex items-center justify-between gap-3">
		<p class="text-[13px] leading-[18px] text-q-secondary">{label}</p>
		{#if severity === 'act'}
			<span class="q-chip" data-tone="danger">Act now</span>
		{:else if severity === 'watch'}
			<span class="q-chip" data-tone="warning">Watch</span>
		{/if}
	</div>
	<p class="text-[24px] leading-[32px] font-semibold tracking-[-0.01em] text-q-text tabular-nums">
		{value}
	</p>
	{#if note}
		<p class="text-[13px] leading-[18px] text-q-tertiary">{note}</p>
	{/if}
</div>
