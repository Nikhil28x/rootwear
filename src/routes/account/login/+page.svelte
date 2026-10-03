<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { dev } from '$app/environment';
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
		Track your orders and pre-orders, and manage your saved addresses.
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
				{#if dev}
					Accounts aren't connected.
					{#if data.canPreview}
						Set <code>ACCOUNT_PREVIEW_EMAIL</code> in <code>.env</code> to preview.
					{/if}
				{:else}
					Accounts aren't available yet. You can still check out as a guest.
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
			No account? You can create one from your order confirmation after you buy.
		</p>
		<p class="mt-4">
			Trouble signing in? Email
			<a class="underline underline-offset-4" href="mailto:{SUPPORT_EMAIL}">{SUPPORT_EMAIL}</a>.
		</p>
	</div>
</div>
