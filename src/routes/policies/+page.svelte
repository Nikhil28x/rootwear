<script lang="ts">
	import Eyebrow from '$lib/components/ui/Eyebrow.svelte';
	import HempMotif from '$lib/components/art/HempMotif.svelte';
	import RootSystem from '$lib/components/art/RootSystem.svelte';
	import { SUPPORT_EMAIL, INSTAGRAM_HANDLE, INSTAGRAM_URL } from '$lib/content/business';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Information — Rootwear</title>
	<meta
		name="description"
		content="Shipping, returns, sizing, care, privacy and terms. Everything we are obliged to tell you, and a few things we are not."
	/>
</svelte:head>

<main class="relative isolate overflow-hidden bg-paper text-forest">
	<div class="pointer-events-none absolute inset-0 -z-10 select-none" aria-hidden="true">
		<div class="absolute -top-32 -right-24 h-[38rem] w-[38rem] text-forest">
			<HempMotif opacity={0.05} seed={4} />
		</div>
		<div class="absolute -bottom-28 -left-24 h-[28rem] w-[52rem] text-forest">
			<RootSystem opacity={0.055} depth={7} />
		</div>
	</div>

	<div class="mx-auto max-w-[1600px] px-5 py-24 sm:px-10 sm:py-32 lg:px-14">
		<header class="max-w-3xl">
			<Eyebrow tone="strong" class="text-forest/70">Information</Eyebrow>
			<h1
				class="display mt-6 text-[clamp(3rem,7vw,7rem)] leading-[0.82] tracking-[-0.055em] text-forest"
			>
				Everything<br />in writing.
			</h1>
			<p class="mt-8 max-w-[52ch] text-[16px] leading-[1.85] text-forest/70">
				How a parcel reaches you, what happens if something is wrong with it, what we do with what
				you tell us, and how to choose a size you will keep. Written to be read once and then not
				needed again.
			</p>
		</header>

		<ul class="mt-20 border-t border-forest/15">
			{#each data.pages as policy, i (policy.slug)}
				<li class="border-b border-forest/15">
					<a
						class="group grid items-baseline gap-3 py-9 transition-colors sm:grid-cols-[4rem_minmax(0,18rem)_minmax(0,1fr)] sm:gap-8"
						href="/policies/{policy.slug}"
					>
						<span class="text-[11px] tracking-[0.28em] text-forest/65 tabular-nums">
							{String(i + 1).padStart(2, '0')}
						</span>
						<span
							class="display text-[clamp(1.75rem,3vw,2.6rem)] leading-[1] tracking-[-0.02em] text-forest transition-transform duration-500 group-hover:translate-x-1"
						>
							{policy.title}
						</span>
						<span class="max-w-[48ch] text-[15px] leading-[1.75] text-forest/75">
							{policy.summary}
						</span>
					</a>
				</li>
			{/each}
		</ul>

		<section
			class="mt-24 grid gap-10 border-t border-forest/15 pt-12 sm:grid-cols-2 lg:grid-cols-3"
			aria-labelledby="not-here"
		>
			<div>
				<h2
					id="not-here"
					class="display text-[clamp(1.6rem,2.6vw,2.2rem)] leading-[1.05] text-forest"
				>
					Not here?
				</h2>
				<p class="mt-5 max-w-[38ch] text-[15px] leading-[1.8] text-forest/70">
					Search across every page above, or write to a person. Both reach the same answer; one is
					faster.
				</p>
			</div>

			<form class="flex flex-col justify-end gap-4" action="/search" method="GET" role="search">
				<label
					class="text-[11px] tracking-[0.2em] text-forest/70 uppercase font-medium"
					for="policy-index-search">Search information</label
				>
				<input
					id="policy-index-search"
					name="q"
					type="search"
					placeholder="returns, pincode, deposit…"
					class="w-full border-b border-forest/25 bg-transparent px-0 py-3 text-[15px] text-forest transition-colors outline-none placeholder:text-forest/60 focus:border-forest"
				/>
				<button
					class="self-start border border-forest px-7 py-4 text-[11px] tracking-[0.2em] text-forest uppercase transition duration-300 hover:bg-forest hover:text-paper font-medium"
					type="submit">Search</button
				>
			</form>

			<div class="flex flex-col justify-end gap-3 text-[14px]">
				<p class="text-[11px] tracking-[0.2em] text-forest/70 uppercase font-medium">Talk to us</p>
				<a
					class="text-forest underline decoration-gold decoration-1 underline-offset-[5px] transition hover:decoration-forest"
					href="mailto:{SUPPORT_EMAIL}">{SUPPORT_EMAIL}</a
				>
				<a
					class="text-forest underline decoration-gold decoration-1 underline-offset-[5px] transition hover:decoration-forest"
					href={INSTAGRAM_URL}
					rel="noreferrer noopener">{INSTAGRAM_HANDLE} — DM</a
				>
				<a
					class="text-forest underline decoration-gold decoration-1 underline-offset-[5px] transition hover:decoration-forest"
					href="/contact">Contact form</a
				>
			</div>
		</section>
	</div>
</main>
