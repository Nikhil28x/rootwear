<script lang="ts">
	import type { Tone } from './tone';

	/**
	 * A state, readable without colour: the label carries the meaning and the
	 * tone only reinforces it.
	 */
	let {
		label,
		tone = 'quiet',
		title = undefined
	}: { label: string; tone?: Tone; title?: string } = $props();

	const chipTone: Record<Tone, string> = {
		solid: 'accent',
		attention: 'warning',
		outline: 'success',
		quiet: 'neutral'
	};
</script>

<span {title} class="q-chip" data-tone={chipTone[tone]}>{label}</span>
