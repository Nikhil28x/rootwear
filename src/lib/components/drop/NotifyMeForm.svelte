<script lang="ts">
	/**
	 * §06 — "Notify-me sits on every sold-out piece and size."
	 *
	 * Deliberately ONE FORM PER SIZE, each inside a native <details>. A single
	 * form with a size picker would need JavaScript to know which size was
	 * selected before submitting; this works with the browser alone, and it is
	 * also the literal reading of §06 — the notify-me sits on the size.
	 *
	 * Writes app.notify_requests, which is unique on (variant_id, email), so a
	 * second submission of the same address returns 'already' and is reported
	 * as "you are already on this list" rather than as a failure.
	 */
	import { enhance } from '$app/forms';
	import Button from '$lib/components/ui/Button.svelte';
	import Accordion from '$lib/components/ui/Accordion.svelte';
	import DemandField from './DemandField.svelte';
	import ConsentCheck from './ConsentCheck.svelte';
	import { resultFor } from './demand-result';

	let {
		dropSlug,
		variantId,
		size,
		productName = '',
		form = null,
		action = '?/notify',
		source = 'drop_page',
		surface = 'dark',
		open = false
	}: {
		dropSlug: string;
		variantId: string;
		size: string;
		productName?: string;
		form?: unknown;
		action?: string;
		source?: string;
		surface?: 'dark' | 'light';
		open?: boolean;
	} = $props();

	/** Every notify-me on the page sees the same `form`; only one owns it. */
	let mine = $derived(resultFor(form, 'notify', variantId));
	let problem = $derived(mine && !mine.ok ? mine : null);
	let done = $derived(mine && mine.ok ? mine : null);

	let title = $derived(
		productName ? `Notify me — ${productName}, ${size}` : `Notify me when ${size} returns`
	);
	let muted = $derived(surface === 'light' ? 'text-forest/70' : 'text-stone-400');
</script>

<Accordion {title} {surface} open={open || Boolean(mine)}>
	{#if done}
		<p class="text-sm leading-relaxed {muted}" role="status">
			{done.status === 'already'
				? `You are already on the list for ${size}. We will write to ${done.email} the moment it comes back.`
				: `Noted. We will write to ${done.email} when ${size} comes back, and about nothing else.`}
		</p>
	{:else}
		<form
			method="POST"
			{action}
			use:enhance
			class="flex flex-col gap-5"
			aria-label="Notify me when size {size} returns"
		>
			<input type="hidden" name="dropSlug" value={dropSlug} />
			<input type="hidden" name="variantId" value={variantId} />
			<input type="hidden" name="source" value={source} />

			<DemandField
				id="notify-email-{variantId}"
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

			<ConsentCheck
				id="notify-consent-{variantId}"
				{surface}
				error={problem?.field === 'consent' ? problem.message : ''}
				label="Email me when this size is available again. One message, then nothing."
			/>

			{#if problem?.field === 'form'}
				<p class="border-l-2 border-gold pl-3 text-xs {muted}" role="alert">{problem.message}</p>
			{/if}

			<Button type="submit" variant="outline" {surface}>Notify me</Button>
		</form>
	{/if}
</Accordion>
