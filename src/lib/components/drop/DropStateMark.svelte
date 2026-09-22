<script lang="ts">
	/**
	 * The state mark. A word in a square rule — no dot, no colour-only signal:
	 * §06's states have to be readable without seeing the colour.
	 */
	import type { DropState } from '$lib/domain/drop-state';
	import { DROP_STATE_MARK, MARK_CLASS, MARK_CLASS_LIGHT } from './marks';

	let { state, surface = 'dark' }: { state: DropState; surface?: 'dark' | 'light' } = $props();

	let mark = $derived(DROP_STATE_MARK[state]);
	let tone = $derived(surface === 'light' ? MARK_CLASS_LIGHT[mark.tone] : MARK_CLASS[mark.tone]);
</script>

<span
	class="inline-flex items-center border px-3 py-1.5 text-[10px] tracking-[0.28em] uppercase {tone}"
>
	{mark.label}
</span>
