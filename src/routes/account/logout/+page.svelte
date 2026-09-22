<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import Eyebrow from '$lib/components/ui/Eyebrow.svelte';
</script>

<svelte:head>
	<title>Sign out — Rootwear</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="max-w-md">
	<Eyebrow tone="strong" class="text-forest/70">Account</Eyebrow>
	<h1
		class="display mt-6 text-[clamp(2.4rem,5vw,3.6rem)] leading-[0.95] tracking-[-0.05em] text-forest"
	>
		Sign out?
	</h1>
	<p class="mt-7 max-w-[44ch] text-[16px] leading-[1.85] text-forest/70">
		Your orders and pre-orders stay exactly as they are. You can sign back in whenever you like.
	</p>

	<form method="POST" class="mt-10 flex flex-wrap items-center gap-6">
		<Button type="submit" variant="solid" surface="light">Sign out</Button>
		<a
			href="/account"
			class="text-[11px] tracking-[0.2em] text-forest/75 uppercase underline-offset-4 hover:text-forest hover:underline font-medium"
		>
			Stay signed in
		</a>
	</form>
</div>
