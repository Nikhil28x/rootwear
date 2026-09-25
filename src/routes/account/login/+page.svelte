<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import Button from '$lib/components/ui/Button.svelte';
	import Eyebrow from '$lib/components/ui/Eyebrow.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import Callout from '$lib/components/account/Callout.svelte';
	import { SUPPORT_EMAIL } from '$lib/content/business';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// Prefilled from the failed attempt so only the password is retyped. The
	// password itself is never echoed back into the markup.
	let email = $state(untrack(() => form?.email ?? ''));
	let submitting = $state(false);
</script>

<svelte:head>
	<title>Sign in — Rootwear</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="max-w-md">
	<Eyebrow tone="strong" class="text-forest/70">Account</Eyebrow>
	<h1
		class="display mt-6 text-[clamp(2.6rem,6vw,4.2rem)] leading-[0.9] tracking-[-0.05em] text-forest"
	>
		Sign in.
	</h1>
	<p class="mt-7 max-w-[46ch] text-[16px] leading-[1.85] text-forest/70">
		Your orders, your pre-orders and the addresses you have saved. You never need an account to buy
		from us — this is only here to keep track afterwards.
	</p>

	{#if form?.error}
		<div class="mt-9"><Callout kind="error">{form.error}</Callout></div>
	{/if}

	{#if data.confirmed}
		<div class="mt-9">
			<Callout kind="success">Your address is confirmed. Sign in below.</Callout>
		</div>
	{/if}

	{#if data.notice}
		<div class="mt-9"><Callout>You are signed out.</Callout></div>
	{/if}

	{#if !data.configured}
		<div class="mt-9">
			<Callout>
				Accounts are not switched on for this deployment. Guest checkout is unaffected.
				{#if data.canPreview}
					For a local read-through of these screens, set <code>ACCOUNT_PREVIEW_EMAIL</code> in
					<code>.env</code> and reload — that switch works only in dev and only while Supabase is unconfigured.
				{/if}
			</Callout>
		</div>
	{/if}

	<form
		method="POST"
		class="mt-11 flex flex-col gap-8"
		use:enhance={() => {
			submitting = true;
			return async ({ update }) => {
				await update();
				submitting = false;
			};
		}}
	>
		<input type="hidden" name="redirectTo" value={data.redirectTo} />

		<Field
			label="Email"
			name="email"
			type="email"
			required
			autocomplete="username"
			inputmode="email"
			bind:value={email}
		/>

		<Field
			label="Password"
			name="password"
			type="password"
			required
			autocomplete="current-password"
		/>

		<Button type="submit" variant="solid" surface="light" full disabled={submitting}>
			{submitting ? 'Signing in…' : 'Sign in'}
		</Button>
	</form>

	<div class="mt-12 border-t border-forest/15 pt-7 text-[13px] leading-[1.9] text-forest/75">
		<p>
			Accounts are offered after a purchase, from your order confirmation, rather than demanded
			before one. If you have ordered as a guest and want the history attached, write to
			<a class="underline underline-offset-4" href="mailto:{SUPPORT_EMAIL}">{SUPPORT_EMAIL}</a>
			from the address you used and we will link it.
		</p>
		<p class="mt-4">
			Locked out? Write to us from that same address and we will send you a way back in.
		</p>
	</div>
</div>
