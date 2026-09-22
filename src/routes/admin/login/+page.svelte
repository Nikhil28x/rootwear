<script lang="ts">
	import Field from '$lib/components/ui/Field.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Notice from '$lib/components/admin/Notice.svelte';
	import HempMotif from '$lib/components/art/HempMotif.svelte';
	import { SUPPORT_EMAIL } from '$lib/content/business';

	let { data, form } = $props();

	// Prefilled from the failed attempt so the operator retypes only the
	// password. The password itself is never echoed back.
	let email = $state('');
	$effect(() => {
		if (form?.email) email = form.email;
	});
</script>

<svelte:head>
	<title>Staff sign-in — Rootwear</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<main class="relative isolate grid min-h-svh place-items-center overflow-hidden bg-forest-black px-5 py-24">
	<div class="pointer-events-none absolute inset-0 -z-10 text-cream select-none" aria-hidden="true">
		<div class="absolute -top-40 -right-32 h-[34rem] w-[34rem]">
			<HempMotif opacity={0.05} seed={4} />
		</div>
	</div>

	<div class="w-full max-w-md">
		<p class="wordmark text-[15px] tracking-[0.24em] text-cream uppercase font-medium">Rootwear</p>
		<h1 class="display mt-5 text-[clamp(2.4rem,6vw,3.4rem)] leading-[0.9] tracking-[-0.045em] text-cream">
			Operations
		</h1>
		<p class="mt-5 text-[15px] leading-relaxed text-stone-400">
			Two accounts have access. Everything you do here is recorded against your address.
		</p>

		{#if form?.error}
			<div class="mt-8"><Notice kind="error">{form.error}</Notice></div>
		{/if}

		{#if data.canPreview}
			<div class="mt-8">
				<Notice kind="warning">
					No Supabase project is configured, so there is no account to sign in to. For a local
					read-through of the screens, set ADMIN_PREVIEW_ROLE=owner (or layout) in
					<code class="text-cream">.env</code> and reload — that switch works only in dev and only
					while Supabase is unconfigured.
				</Notice>
			</div>
		{/if}

		<form method="POST" class="mt-10 flex flex-col gap-7">
			<input type="hidden" name="next" value={data.next ?? ''} />

			<Field
				label="Email"
				name="email"
				type="email"
				surface="dark"
				required
				autocomplete="username"
				inputmode="email"
				bind:value={email}
			/>

			<Field
				label="Password"
				name="password"
				type="password"
				surface="dark"
				required
				autocomplete="current-password"
			/>

			<Button type="submit" variant="solid" surface="dark" full>Sign in</Button>
		</form>

		<p class="mt-10 border-t border-white/10 pt-6 text-[13px] leading-relaxed text-stone-400">
			Accounts are created by the developer, not from this screen. If you cannot get in, write to
			<a class="text-stone-300 underline underline-offset-4" href="mailto:{SUPPORT_EMAIL}">
				{SUPPORT_EMAIL}
			</a>.
		</p>
	</div>
</main>
