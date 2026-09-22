<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * Standing conditions and form results on the cream surface.
	 *
	 * `role="alert"` on the failure and success cases, so the outcome of a
	 * submit is ANNOUNCED rather than merely drawn — a customer who is not
	 * looking at the top of the page still hears that the address saved.
	 * `note` is a standing condition rather than a response to an action, so it
	 * is a plain region: announcing it on every render would be noise.
	 */
	let { children, kind = 'note' }: { children: Snippet; kind?: 'note' | 'error' | 'success' } =
		$props();

	const styles = {
		note: 'border-forest/30 text-forest/70',
		error: 'border-alert bg-alert/[0.06] text-forest',
		success: 'border-gold bg-gold/[0.08] text-forest'
	} as const;

	let live = $derived(kind === 'error' || kind === 'success');
</script>

<p
	class="border-l-2 px-5 py-4 text-sm leading-relaxed {styles[kind]}"
	role={live ? 'alert' : undefined}
>
	{@render children()}
</p>
