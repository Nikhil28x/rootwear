<script lang="ts">
	import { page } from '$app/state';
	import Eyebrow from '$lib/components/ui/Eyebrow.svelte';
	import HempMotif from '$lib/components/art/HempMotif.svelte';
	import RootSystem from '$lib/components/art/RootSystem.svelte';
	import { SUPPORT_EMAIL, INSTAGRAM_HANDLE, INSTAGRAM_URL } from '$lib/content/business';

	/**
	 * §03 template 10 — "Search and 404 styled with it."
	 *
	 * Same type scale, same rules, same background field as the policy pages.
	 * The surface follows the route that failed, because the shared header has
	 * already chosen its own colour from the same list: a cream error page
	 * under a dark header would put cream text on cream.
	 */
	const LIGHT_ROUTES = [
		'/policies',
		'/contact',
		'/know-your-roots',
		'/account',
		'/cart',
		'/checkout'
	];

	let light = $derived(LIGHT_ROUTES.some((route) => page.route.id?.startsWith(route)));
	let notFound = $derived(page.status === 404);

	/** Loaded by the root layout; absent only if that load was what failed. */
	let links = $derived((page.data?.footerPolicies ?? []) as Array<{ slug: string; title: string }>);

	let tone = $derived(
		light
			? {
					shell: 'bg-cream text-forest',
					art: 'text-forest',
					heading: 'text-forest',
					body: 'text-forest/70',
					micro: 'text-forest/50',
					rule: 'border-forest/15',
					field: 'border-forest/25 text-forest placeholder:text-forest/35 focus:border-forest',
					button: 'border-forest text-forest hover:bg-forest hover:text-cream',
					link: 'text-forest/60 hover:text-forest',
					anchor:
						'text-forest underline decoration-gold decoration-1 underline-offset-[5px] hover:decoration-forest'
				}
			: {
					shell: 'bg-forest-black text-stone-100',
					art: 'text-cream',
					heading: 'text-stone-100',
					body: 'text-stone-400',
					micro: 'text-stone-500',
					rule: 'border-white/12',
					field: 'border-white/25 text-stone-100 placeholder:text-stone-500 focus:border-white',
					button: 'border-white/35 text-stone-100 hover:bg-white hover:text-black',
					link: 'text-stone-400 hover:text-stone-100',
					anchor:
						'text-stone-100 underline decoration-gold decoration-1 underline-offset-[5px] hover:decoration-stone-100'
				}
	);
</script>

<svelte:head>
	<title>{page.status} — Rootwear</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="relative isolate overflow-hidden {tone.shell}">
	<div class="pointer-events-none absolute inset-0 -z-10 select-none" aria-hidden="true">
		<div class="absolute -top-32 -right-28 h-[36rem] w-[36rem] {tone.art}">
			<HempMotif opacity={0.05} seed={9} />
		</div>
		<div class="absolute -bottom-24 -left-24 hidden h-[26rem] w-[44rem] {tone.art} sm:block">
			<RootSystem opacity={0.06} depth={6} />
		</div>
	</div>

	<div class="mx-auto max-w-[1600px] px-5 py-24 sm:px-10 sm:py-32 lg:px-14">
		<div class="grid gap-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] lg:gap-24">
			<div class="max-w-[46rem]">
				<Eyebrow tone="strong" class={tone.micro}>Error {page.status}</Eyebrow>
				<h1
					class="display mt-6 text-[clamp(3rem,7vw,7rem)] leading-[0.82] tracking-[-0.055em] {tone.heading}"
				>
					{#if notFound}
						Nothing grows<br />here.
					{:else}
						Something<br />gave way.
					{/if}
				</h1>
				<p class="mt-8 max-w-[52ch] text-[15px] leading-[1.85] {tone.body}">
					{#if notFound}
						That page has never existed, or never will. Everything we have written is still where
						you left it — the drops, and the eight information pages.
					{:else}
						{page.error?.message ?? 'An unexpected error occurred at our end, not yours.'}
						Try again in a moment; if it keeps happening, tell us what you were doing.
					{/if}
				</p>

				{#if notFound}
					<!-- 404 offers the two ways out: search, and the index. -->
					<form class="mt-12 max-w-xl" method="GET" action="/search" role="search">
						<label for="error-q" class="text-[10px] tracking-[0.2em] uppercase {tone.micro}">
							Search the information pages
						</label>
						<div class="mt-3 flex flex-wrap items-end gap-5">
							<input
								id="error-q"
								name="q"
								type="search"
								placeholder="returns, sizing, tracking…"
								autocomplete="off"
								class="min-w-0 flex-1 border-b bg-transparent px-0 py-3 text-base transition-colors outline-none {tone.field}"
							/>
							<button
								class="border px-7 py-4 text-[10px] tracking-[0.2em] uppercase transition duration-300 {tone.button}"
								type="submit">Search</button
							>
						</div>
					</form>
				{/if}

				<div class="mt-12 flex flex-wrap gap-x-8 gap-y-3 text-[11px] tracking-[0.18em] uppercase">
					<a class="transition {tone.link}" href="/">Home</a>
					<a class="transition {tone.link}" href="/drops">Drops</a>
					<a class="transition {tone.link}" href="/policies">Information</a>
					<a class="transition {tone.link}" href="/contact">Contact</a>
				</div>
			</div>

			<aside class="border-t pt-8 {tone.rule} lg:sticky lg:top-28 lg:self-start">
				<p class="text-[10px] tracking-[0.2em] uppercase {tone.micro}">Everything in writing</p>
				<ul class="mt-5 flex flex-col gap-3 text-[13px]">
					{#each links as link (link.slug)}
						<li>
							<a class="transition {tone.link}" href="/policies/{link.slug}">{link.title} →</a>
						</li>
					{:else}
						<li><a class="transition {tone.link}" href="/policies">All information pages →</a></li>
					{/each}
				</ul>

				<div class="mt-10 border-t pt-8 {tone.rule}">
					<p class="text-[10px] tracking-[0.2em] uppercase {tone.micro}">Stuck?</p>
					<p class="mt-5 flex flex-col gap-3 text-[13px]">
						<a class={tone.anchor} href="mailto:{SUPPORT_EMAIL}">{SUPPORT_EMAIL}</a>
						<a class={tone.anchor} href={INSTAGRAM_URL} rel="noreferrer noopener">
							{INSTAGRAM_HANDLE} — DM
						</a>
					</p>
				</div>
			</aside>
		</div>
	</div>
</main>
