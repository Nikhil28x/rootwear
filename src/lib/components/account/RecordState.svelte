<script lang="ts">
	import type { RecordTone } from './state-labels';

	/**
	 * A stored state, rendered so it can be picked out of a list without being
	 * read. Border weight and fill carry the emphasis, and the WORD carries the
	 * meaning too — nothing here depends on colour vision.
	 */
	let {
		label,
		tone = 'quiet',
		title = undefined
	}: { label: string; tone?: RecordTone; title?: string } = $props();

	const styles: Record<RecordTone, string> = {
		attention: 'border-gold bg-gold/10 text-forest',
		settled: 'border-forest/65 text-forest',
		quiet: 'border-forest/20 text-forest/75',
		closed: 'border-forest/15 text-forest/65'
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
