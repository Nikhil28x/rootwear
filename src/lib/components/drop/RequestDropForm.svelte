<script lang="ts">
	/**
	 * §12 — "Request this drop."
	 *
	 * A finished drop is not a dead page. This form is how a visitor asks for it
	 * to be cut again, and it is the input to the demand board admin reads
	 * before deciding what to re-cut (app.demand_board).
	 *
	 * The SIZE is required, and that is the whole point: a bare headcount
	 * cannot be cut against, "eleven people want an M" can. It also makes the
	 * unique index on (drop_id, variant_id, email) do its job, so submitting
	 * twice is idempotent instead of double-counting one person.
	 *
	 * No money is taken here, and the copy says so — this is a signal, not a
	 * pre-order, and conflating the two would be the §08 deposit flow wearing a
	 * disguise.
	 */
	import { enhance } from '$app/forms';
	import Button from '$lib/components/ui/Button.svelte';
	import Eyebrow from '$lib/components/ui/Eyebrow.svelte';
	import DemandField from './DemandField.svelte';
	import ConsentCheck from './ConsentCheck.svelte';
	import { resultFor } from './demand-result';

	let {
		dropSlug,
		dropName,
		sizeOptions,
		form = null,
		action = '?/requestDrop',
		source = 'drop_archive',
		surface = 'dark',
		heading = 'Ask for this drop again'
	}: {
		dropSlug: string;
		dropName: string;
		sizeOptions: ReadonlyArray<{ value: string; label: string }>;
		form?: unknown;
		action?: string;
		source?: string;
		surface?: 'dark' | 'light';
		heading?: string;
	} = $props();

	let mine = $derived(resultFor(form, 'request', dropSlug));
	let problem = $derived(mine && !mine.ok ? mine : null);
	let done = $derived(mine && mine.ok ? mine : null);

	let muted = $derived(surface === 'light' ? 'text-forest/70' : 'text-stone-400');
	let faint = $derived(surface === 'light' ? 'text-forest/70' : 'text-stone-400');
	let rule = $derived(surface === 'light' ? 'border-forest/20' : 'border-white/15');
</script>

<div class="flex flex-col gap-6 border {rule} p-6 sm:p-8">
	<div class="flex flex-col gap-3">
		<Eyebrow tone="gold" {surface}>Request this drop</Eyebrow>
		<p class="display text-2xl leading-tight">{heading}</p>
		<p class="max-w-prose text-[15px] leading-relaxed {muted}">
			{dropName} is finished. Tell us the size you wanted and we will know exactly what to cut if it comes
			back. Nothing is charged and no piece is held — this is a note, not an order.
		</p>
	</div>

	{#if done}
		<p class="border-l-2 border-gold pl-4 text-[15px] leading-relaxed {muted}" role="status">
			{done.status === 'already'
				? `You are already on the list for this size. We have your note against ${done.email} and it is counted once.`
				: `Counted. Your size is on the board for ${dropName}, and we will write to ${done.email} if it is cut again.`}
		</p>
		<p class="text-[13px] {faint}">Want a second size as well? Add it below.</p>
	{/if}

	<form
		method="POST"
		{action}
		use:enhance
		class="flex flex-col gap-6"
		aria-label="Request {dropName} again"
	>
		<input type="hidden" name="dropSlug" value={dropSlug} />
		<input type="hidden" name="source" value={source} />

		<div class="grid gap-6 sm:grid-cols-2">
			<DemandField
				id="request-size-{dropSlug}"
				name="variantId"
				label="Size you wanted"
				required
				{surface}
				options={sizeOptions}
				value={problem?.variantId ?? ''}
				error={problem?.field === 'size' ? problem.message : ''}
				hint="The size is what makes this actionable."
			/>

			<DemandField
				id="request-email-{dropSlug}"
				name="email"
				label="Email"
				type="email"
				required
				{surface}
				autocomplete="email"
				inputmode="email"
				placeholder="you@example.com"
				value={problem?.email ?? ''}
				error={problem?.field === 'email' ? problem.message : ''}
			/>
		</div>

		<DemandField
			id="request-note-{dropSlug}"
			name="note"
			label="Anything else"
			rows={3}
			{surface}
			placeholder="Optional — what you would have worn it for."
		/>

		<ConsentCheck
			id="request-consent-{dropSlug}"
			{surface}
			error={problem?.field === 'consent' ? problem.message : ''}
			label="Email me if {dropName} is cut again. Nothing else, and you can stop at any time."
		/>

		{#if problem?.field === 'form'}
			<p class="border-l-2 border-gold pl-3 text-[13px] {muted}" role="alert">{problem.message}</p>
		{/if}

		<div class="flex flex-wrap items-center gap-5">
			<Button type="submit" variant="solid" {surface}>Add my size</Button>
			<p class="text-[11px] tracking-[0.2em] uppercase {faint} font-medium">No payment. No hold.</p>
		</div>
	</form>
</div>
