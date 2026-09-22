<script lang="ts">
	import Eyebrow from '$lib/components/ui/Eyebrow.svelte';
	import HempMotif from '$lib/components/art/HempMotif.svelte';
	import { SUPPORT_EMAIL, INSTAGRAM_HANDLE, INSTAGRAM_URL } from '$lib/content/business';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	/**
	 * The same template as the policy pages, on the dark ground the shared
	 * header uses for this route. One typographic system, two surfaces.
	 */
	let count = $derived(data.results.length);
</script>

<svelte:head>
	<title>{data.query ? `${data.query} — Search` : 'Search'} — Rootwear</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="relative isolate overflow-hidden">
	<div class="pointer-events-none absolute inset-0 -z-10 select-none" aria-hidden="true">
		<div class="absolute -top-40 -right-32 h-[40rem] w-[40rem] text-paper">
			<HempMotif opacity={0.045} seed={8} />
		</div>
	</div>

	<div class="mx-auto max-w-[1600px] px-5 py-24 sm:px-10 sm:py-32 lg:px-14">
		<header class="max-w-3xl">
			<Eyebrow>Search</Eyebrow>
			<h1 class="display mt-6 text-[clamp(3rem,7vw,7rem)] leading-[0.82] tracking-[-0.055em]">
				Look it up.
			</h1>
			<p class="mt-8 max-w-[52ch] text-[16px] leading-[1.85] text-stone-400">
				Every information page — shipping, returns, sizing, care, privacy, terms and the rest —
				searched at once.
			</p>
		</header>

		<form class="mt-14 max-w-2xl" method="GET" role="search">
			<label for="q" class="text-[11px] tracking-[0.2em] text-stone-400 uppercase font-medium">
				Search information pages
			</label>
			<div class="mt-3 flex flex-wrap items-end gap-5">
				<input
					id="q"
					name="q"
					type="search"
					value={data.query}
					placeholder="returns, pincode, deposit, chest…"
					autocomplete="off"
					class="min-w-0 flex-1 border-b border-white/25 bg-transparent px-0 py-3 text-lg text-stone-100 transition-colors outline-none placeholder:text-stone-400 focus:border-white"
				/>
				<button
					class="border border-white/35 px-7 py-4 text-[11px] tracking-[0.2em] text-stone-100 uppercase transition duration-300 hover:bg-white hover:text-black font-medium"
					type="submit">Search</button
				>
			</div>
		</form>

		{#if !data.searched}
			<!-- Empty state: nothing has been asked yet, so offer the index. -->
			<section class="mt-20 border-t border-white/12 pt-12" aria-labelledby="everything-title">
				<h2 id="everything-title" class="text-[11px] tracking-[0.28em] text-stone-400 uppercase font-medium">
					Everything there is
				</h2>
				<ul class="mt-8 grid gap-x-12 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
					{#each data.everything as entry (entry.slug)}
						<li>
							<a class="group block" href="/policies/{entry.slug}">
								<span
									class="display block text-[clamp(1.5rem,2.4vw,2rem)] leading-[1.05] tracking-[-0.02em] text-stone-100 transition-transform duration-500 group-hover:translate-x-1"
								>
									{entry.title}
								</span>
								<span class="mt-3 block max-w-[38ch] text-[14px] leading-[1.75] text-stone-400">
									{entry.summary}
								</span>
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{:else if count === 0}
			<!-- No-results state: say so plainly, then give somewhere to go. -->
			<section class="mt-20 border-t border-white/12 pt-12" aria-live="polite">
				<p class="text-[11px] tracking-[0.28em] text-stone-400 uppercase font-medium">No matches</p>
				<p class="display mt-6 text-[clamp(1.8rem,3.4vw,2.8rem)] leading-[1.05] tracking-[-0.02em]">
					Nothing on file for “{data.query}”.
				</p>
				<p class="mt-6 max-w-[48ch] text-[16px] leading-[1.85] text-stone-400">
					Try a plainer word — “size”, “refund”, “deposit”, “pincode”. Or read the eight pages
					straight through; there are not many.
				</p>

				<ul class="mt-10 flex flex-wrap gap-x-8 gap-y-3">
					{#each data.everything as entry (entry.slug)}
						<li>
							<a
								class="text-[12px] tracking-[0.18em] text-stone-400 uppercase transition hover:text-stone-100 font-medium"
								href="/policies/{entry.slug}">{entry.title}</a
							>
						</li>
					{/each}
				</ul>

				<p class="mt-12 flex flex-wrap items-center gap-x-6 gap-y-2 text-[14px]">
					<a
						class="text-stone-100 underline decoration-gold decoration-1 underline-offset-[5px] transition hover:decoration-stone-100"
						href="/contact">Ask us instead</a
					>
					<a
						class="text-stone-100 underline decoration-gold decoration-1 underline-offset-[5px] transition hover:decoration-stone-100"
						href="mailto:{SUPPORT_EMAIL}">{SUPPORT_EMAIL}</a
					>
					<a
						class="text-stone-100 underline decoration-gold decoration-1 underline-offset-[5px] transition hover:decoration-stone-100"
						href={INSTAGRAM_URL}
						rel="noreferrer noopener">{INSTAGRAM_HANDLE} — DM</a
					>
				</p>
			</section>
		{:else}
			<section class="mt-20 border-t border-white/12" aria-live="polite">
				<p class="py-6 text-[11px] tracking-[0.28em] text-stone-400 uppercase font-medium">
					{count}
					{count === 1 ? 'page' : 'pages'} for “{data.query}”
				</p>

				<ul class="border-t border-white/12">
					{#each data.results as result, i (result.slug)}
						<li class="border-b border-white/12">
							<a
								class="group grid items-baseline gap-3 py-9 sm:grid-cols-[4rem_minmax(0,18rem)_minmax(0,1fr)] sm:gap-8"
								href="/policies/{result.slug}"
							>
								<span class="text-[11px] tracking-[0.28em] text-stone-400 tabular-nums">
									{String(i + 1).padStart(2, '0')}
								</span>
								<span
									class="display text-[clamp(1.6rem,2.8vw,2.4rem)] leading-[1.05] tracking-[-0.02em] text-stone-100 transition-transform duration-500 group-hover:translate-x-1"
								>
									{result.title}
								</span>
								<span class="flex max-w-[52ch] flex-col gap-2">
									<span class="text-[15px] leading-[1.75] text-stone-400">{result.summary}</span>
									{#if result.snippet}
										<span
											class="border-l border-gold/60 pl-4 text-[14px] leading-[1.75] text-stone-400"
										>
											{result.snippet}
										</span>
									{/if}
								</span>
							</a>
						</li>
					{/each}
				</ul>

				<p class="mt-12 text-[14px] leading-relaxed text-stone-400">
					Not what you meant?
					<a
						class="text-stone-100 underline decoration-gold decoration-1 underline-offset-[5px] transition hover:decoration-stone-100"
						href="/contact">Write to us</a
					>
					— a person answers.
				</p>
			</section>
		{/if}
	</div>
</main>
