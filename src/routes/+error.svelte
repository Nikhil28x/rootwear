<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>{page.status} — Rootwear</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="grid min-h-svh place-items-center bg-forest-black px-5 text-center text-stone-100">
	<div class="flex max-w-md flex-col items-center gap-6">
		<p class="text-[10px] tracking-[0.28em] text-stone-500 uppercase">Error {page.status}</p>
		<h1 class="display text-[clamp(3rem,9vw,6rem)] leading-[0.82] tracking-[-0.05em]">
			{page.status === 404 ? 'Nothing grows here.' : 'Something gave way.'}
		</h1>
		<p class="text-sm leading-relaxed text-stone-400">
			{page.status === 404
				? 'That page has never existed, or never will. The drops are all still where you left them.'
				: page.error?.message ?? 'An unexpected error occurred.'}
		</p>
		<a
			class="mt-2 inline-flex border border-white/35 px-7 py-4 text-[10px] tracking-[0.2em] uppercase transition hover:bg-white hover:text-black"
			href="/">Back to the forest</a
		>
	</div>
</main>
