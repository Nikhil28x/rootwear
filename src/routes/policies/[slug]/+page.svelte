<script lang="ts">
	import PolicyBody from '$lib/components/PolicyBody.svelte';
	import Eyebrow from '$lib/components/ui/Eyebrow.svelte';
	import HempMotif from '$lib/components/art/HempMotif.svelte';
	import RootSystem from '$lib/components/art/RootSystem.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const revised = new Intl.DateTimeFormat('en-IN', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		timeZone: 'Asia/Kolkata'
	});

	let updated = $derived(revised.format(data.policy.updatedAt));
	let current = $derived(data.policy.slug);
</script>

<svelte:head>
	<title>{data.policy.title} — Rootwear</title>
	<meta name="description" content={data.policy.summary} />
	<link rel="canonical" href="https://rootwear.in/policies/{data.policy.slug}" />
</svelte:head>

<main class="relative isolate overflow-hidden bg-cream text-forest">
	<!-- Background field. Decorative, aria-hidden inside each component. -->
	<div class="pointer-events-none absolute inset-0 -z-10 select-none" aria-hidden="true">
		<div class="absolute -top-24 -right-28 h-[34rem] w-[34rem] text-forest">
			<HempMotif opacity={0.05} seed={2} />
		</div>
		<div class="absolute -bottom-20 -left-32 hidden h-[26rem] w-[44rem] text-forest lg:block">
			<RootSystem opacity={0.06} depth={6} />
		</div>
	</div>

	<div class="mx-auto max-w-[1600px] px-5 py-24 sm:px-10 sm:py-32 lg:px-14">
		<div class="grid gap-16 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] lg:gap-24">
			<!--
				The index sits beside every page rather than only on /policies,
				because on a template that carries unlimited pages the sideways
				move is the one a reader actually wants.
			-->
			<aside class="lg:sticky lg:top-28 lg:self-start">
				<Eyebrow tone="strong" class="text-forest/50">Information</Eyebrow>
				<nav class="mt-6 border-t border-forest/15" aria-label="Policy pages">
					<ul>
						{#each data.siblings as sibling (sibling.slug)}
							<li class="border-b border-forest/15">
								<a
									class="flex items-center justify-between gap-3 py-4 text-[11px] tracking-[0.18em] uppercase transition {sibling.slug ===
									current
										? 'text-forest'
										: 'text-forest/55 hover:text-forest'}"
									href="/policies/{sibling.slug}"
									aria-current={sibling.slug === current ? 'page' : undefined}
								>
									{sibling.title}
									{#if sibling.slug === current}
										<span class="block h-px w-5 bg-gold" aria-hidden="true"></span>
									{/if}
								</a>
							</li>
						{/each}
					</ul>
				</nav>

				<div
					class="mt-10 flex flex-col gap-3 text-[11px] tracking-[0.16em] text-forest/55 uppercase"
				>
					<a class="transition hover:text-forest" href="/search">Search these pages</a>
					<a class="transition hover:text-forest" href="/contact">Write to us</a>
				</div>
			</aside>

			<article>
				<header class="border-b border-forest/15 pb-12">
					<h1
						class="display text-[clamp(3rem,7vw,7rem)] leading-[0.82] tracking-[-0.055em] text-forest"
					>
						{data.policy.title}
					</h1>
					{#if data.policy.summary}
						<p class="mt-8 max-w-[52ch] text-[15px] leading-[1.75] text-forest/70">
							{data.policy.summary}
						</p>
					{/if}
					<p class="mt-8 text-[10px] tracking-[0.28em] text-forest/45 uppercase">
						Revised {updated}
					</p>
				</header>

				<div class="pt-12">
					<PolicyBody blocks={data.policy.body} surface="light" label={data.policy.title} />
				</div>

				<footer
					class="mt-20 flex flex-wrap items-center justify-between gap-6 border-t border-forest/15 pt-8 text-[10px] tracking-[0.2em] text-forest/50 uppercase"
				>
					<span>/policies/{data.policy.slug}</span>
					<a class="transition hover:text-forest" href="/policies">All information pages</a>
				</footer>
			</article>
		</div>
	</div>
</main>
