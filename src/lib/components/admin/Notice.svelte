<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * Form results and standing warnings. `role="alert"` on the failure and
	 * success cases so the outcome of a submit is ANNOUNCED, not merely drawn —
	 * an admin who is not looking at the top of the page still hears that the
	 * dispatch was refused.
	 *
	 * `warning` is a standing condition rather than a response to an action, so
	 * it is a plain region: announcing it on every render would be noise.
	 */
	let {
		children,
		kind = 'info'
	}: { children: Snippet; kind?: 'info' | 'warning' | 'error' | 'success' } = $props();

	const styles = {
		info: 'border-white/15 text-stone-300',
		warning: 'border-gold text-gold',
		error: 'border-paper bg-paper/10 text-paper',
		success: 'border-stone-400 text-stone-200'
	} as const;

	let live = $derived(kind === 'error' || kind === 'success');
</script>

<p
	class="border-l-2 px-4 py-3 text-[15px] leading-relaxed {styles[kind]}"
	role={live ? 'alert' : undefined}
>
	{@render children()}
</p>
