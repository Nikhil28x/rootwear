<script lang="ts" module>
	export type ChipTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';
</script>

<script lang="ts">
	/** A status or category. The words carry the meaning; tone only reinforces it. */
	let {
		label,
		tone = 'neutral',
		dot = true,
		title = undefined
	}: { label: string; tone?: ChipTone; dot?: boolean; title?: string } = $props();
</script>

<span class="q-chip" data-tone={tone} data-dot={dot ? 'true' : 'false'} {title}>{label}</span>
