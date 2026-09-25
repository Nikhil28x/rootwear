<script lang="ts">
	import Field from '$lib/components/ui/Field.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { resultFor } from './demand-result';

	/**
	 * A pre-order signup: name, email, phone, size.
	 *
	 * NOT a §08 reservation — no money is taken, no piece number is allocated
	 * and nothing is held. It records that a named person wants a size when the
	 * drop opens, which is what the pre-order view of a drop collects.
	 *
	 * Works with no JavaScript: it is a plain form action, and every field is
	 * re-validated server-side whatever the browser did or did not do.
	 */
	let {
		dropSlug,
		sizeOptions,
		surface = 'dark',
		form = null
	}: {
		dropSlug: string;
		sizeOptions: Array<{ value: string; label: string }>;
		surface?: 'dark' | 'light';
		form?: unknown;
	} = $props();

	let result = $derived(resultFor(form, 'preorder', dropSlug));
	let problem = $derived(result && !result.ok ? result : null);

	// Echoed back so a failed submit does not make anyone retype what was fine.
	let name = $state('');
	let email = $state('');
	let phone = $state('');
	let size = $state('');

	$effect(() => {
		if (!problem) return;
		name = (problem as { name?: string }).name ?? name;
		email = problem.email ?? email;
		phone = (problem as { phone?: string }).phone ?? phone;
	});

	const muted = $derived(surface === 'light' ? 'text-forest/75' : 'text-stone-400');
	const rule = $derived(surface === 'light' ? 'border-forest/20' : 'border-white/15');
</script>

{#if result?.ok}
	<div class="border-l-2 border-strain pl-4 text-[15px] leading-relaxed {muted}">
		<p class="font-medium {surface === 'light' ? 'text-forest' : 'text-stone-100'}">
			{result.status === 'already' ? 'You are already on the list.' : 'You are on the list.'}
		</p>
		<p class="mt-1">
			We will write to {result.email} when Drop 01 opens. Nothing has been charged.
		</p>
	</div>
{:else}
	<form method="POST" action="?/preorder" class="flex flex-col gap-5 border-t {rule} pt-6">
		<input type="hidden" name="dropSlug" value={dropSlug} />

		<p class="text-[13px] leading-relaxed {muted}">
			Tell us where to reach you and we will hold your size back when the drop opens. No payment
			is taken now.
		</p>

		<Field
			label="Your name"
			name="name"
			bind:value={name}
			required
			{surface}
			autocomplete="name"
			error={problem?.field === 'name' ? problem.message : ''}
		/>

		<div class="grid gap-5 sm:grid-cols-2">
			<Field
				label="Email"
				name="email"
				type="email"
				bind:value={email}
				required
				{surface}
				autocomplete="email"
				inputmode="email"
				error={problem?.field === 'email' ? problem.message : ''}
			/>
			<Field
				label="Mobile number"
				name="phone"
				bind:value={phone}
				required
				{surface}
				autocomplete="tel"
				inputmode="tel"
				hint="Ten digits, starting 6, 7, 8 or 9."
				error={problem?.field === 'phone' ? problem.message : ''}
			/>
		</div>

		<Field
			label="Size"
			name="variantId"
			bind:value={size}
			required
			{surface}
			options={sizeOptions}
			error={problem?.field === 'size' ? problem.message : ''}
		/>

		<label class="flex items-start gap-3 text-[13px] leading-relaxed {muted}">
			<input type="checkbox" name="consent" class="mt-1 size-4 shrink-0 accent-current" />
			<span>
				Email and message me about this drop. We keep the list ourselves and you can ask us to
				remove you at any time.
			</span>
		</label>

		{#if problem?.field === 'consent' || problem?.field === 'form'}
			<p class="text-[13px] text-alert-light" role="alert">{problem.message}</p>
		{/if}

		<Button type="submit" variant="solid" {surface} full>Pre-order this piece</Button>
	</form>
{/if}
