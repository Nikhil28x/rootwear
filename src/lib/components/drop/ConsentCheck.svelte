<script lang="ts">
	/**
	 * §13 — "Opt-in consent is captured AND LOGGED at the point of signup."
	 *
	 * Opt-in means the box starts empty. It is never pre-ticked, the server
	 * rejects a submission without it, and the instant plus the surface are
	 * written onto the row itself — see app.drop_requests.consented_at /
	 * consent_source. This component exists so both demand forms ask the same
	 * question in the same words.
	 */
	let {
		id,
		error = '',
		label,
		surface = 'dark'
	}: { id: string; error?: string; label: string; surface?: 'dark' | 'light' } = $props();

	let tone = $derived(surface === 'light' ? 'text-forest/70' : 'text-stone-400');
	let box = $derived(surface === 'light' ? 'accent-forest' : 'accent-gold');
	/**
	 * Errors are marked by a rule and by their WORDS, not by colour alone —
	 * there is no error colour in the palette and inventing one would fail the
	 * contrast pass on both surfaces.
	 */
	let alert = $derived(
		surface === 'light'
			? 'border-l-2 border-gold pl-3 text-forest'
			: 'border-l-2 border-gold pl-3 text-stone-100'
	);
</script>

<div class="flex flex-col gap-2">
	<label class="flex cursor-pointer items-start gap-3 text-xs leading-relaxed {tone}" for={id}>
		<input
			{id}
			class="mt-0.5 size-4 shrink-0 {box}"
			type="checkbox"
			name="consent"
			aria-describedby={error ? `${id}-error` : undefined}
			aria-invalid={error ? 'true' : undefined}
		/>
		<span>{label}</span>
	</label>
	{#if error}
		<p id="{id}-error" class="text-xs {alert}">{error}</p>
	{/if}
</div>
