<script lang="ts">
	import type { PageData } from './$types';
	import Eyebrow from '$lib/components/ui/Eyebrow.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import HempMotif from '$lib/components/art/HempMotif.svelte';
	import HempField from '$lib/components/art/HempField.svelte';
	import RootSystem from '$lib/components/art/RootSystem.svelte';
	import GrowthRings from '$lib/components/art/GrowthRings.svelte';

	/**
	 * §03 template 09 — one long read, four movements: the lineage, the
	 * fibre, the label, and the making.
	 *
	 * Every string comes from $lib/content/know-your-roots via the server load.
	 * §14 is enforced there, at the source, rather than in this markup.
	 */
	let { data }: { data: PageData } = $props();

	let content = $derived(data.content);
	let hero = $derived(content.hero);
	let close = $derived(content.close);

	// The four movements are ordered in the content module and rendered with
	// bespoke interiors, so they are addressed positionally rather than looped.
	let lineage = $derived(content.movements[0]);
	let fibre = $derived(content.movements[1]);
	let label = $derived(content.movements[2]);
	let making = $derived(content.movements[3]);

	/**
	 * This page alternates white and forest-black movements, so the header ink
	 * has to change with them. Each section declares `data-header-theme` and the
	 * shared SiteHeader probes what sits behind it — the same convention the
	 * homepage hero uses. No page-local override, no :global rule.
	 */
</script>

<svelte:head>
	<title>{content.seo.title}</title>
	<meta name="description" content={content.seo.description} />
</svelte:head>

<main class="roots-page bg-paper">
	<!-- ───────────────────────────────────────────────────────── the opening -->
	<section data-header-theme="light" class="relative isolate overflow-hidden bg-paper text-forest">
		<div
			class="pointer-events-none absolute -top-[16%] -right-[22%] aspect-square w-[92%] max-w-[1000px] text-forest sm:-right-[10%] sm:w-[70%]"
		>
			<GrowthRings opacity={0.09} seed={3} />
		</div>

		<div
			class="relative mx-auto flex max-w-[1600px] flex-col px-5 py-28 sm:px-10 sm:py-40 lg:px-14"
		>
			<Eyebrow tone="strong" class="opacity-70">{hero.eyebrow}</Eyebrow>

			<h1 class="display mt-8 text-[clamp(3rem,10vw,8.5rem)] leading-[0.82] tracking-[-0.055em]">
				{#each hero.title as line, i (i)}<span class="block">{line}</span>{/each}
			</h1>

			<p class="mt-10 max-w-xl text-[15px] leading-[1.95] text-forest/70">{hero.lede}</p>

			<nav
				class="mt-16 flex flex-wrap gap-x-12 gap-y-5 border-t border-forest/15 pt-7"
				aria-label="Sections of this page"
			>
				{#each content.movements as movement (movement.id)}
					<a
						class="group flex items-baseline gap-3 text-[11px] font-medium tracking-[0.28em] text-forest/75 uppercase transition hover:text-forest"
						href="#{movement.id}"
					>
						<span class="tabular-nums">{movement.index}</span>
						<span class="border-b border-transparent pb-1 transition group-hover:border-forest/65">
							{movement.eyebrow}
						</span>
					</a>
				{/each}
			</nav>
		</div>
	</section>

	<!-- 01 · the lineage -->
	<section
		id={lineage.id}
		aria-labelledby="movement-{lineage.id}"
		data-header-theme="dark"
		class="relative isolate scroll-mt-28 overflow-hidden bg-forest text-paper"
	>
		<div class="pointer-events-none absolute inset-x-0 top-0 h-[52rem] text-gold">
			<RootSystem opacity={0.09} depth={8} />
		</div>

		<div class="relative mx-auto max-w-[1600px] px-5 py-24 sm:px-10 sm:py-32 lg:px-14">
			<div class="mx-auto max-w-3xl text-center">
				<svg
					class="mx-auto mb-9 h-14 w-10 text-gold"
					viewBox="0 0 40 56"
					fill="none"
					aria-hidden="true"
				>
					<path
						d="M20 2v22M20 24c0-6-4-9-9-10M20 24c0-6 4-9 9-10M20 30c0-4-3-6-7-7M20 30c0-4 3-6 7-7"
						stroke="currentColor"
						stroke-width="1.3"
						stroke-linecap="round"
					/>
					<path
						d="M20 24c-3 5-9 7-14 7M20 24c3 5 9 7 14 7M20 30c-2 6-7 9-13 10M20 30c2 6 7 9 13 10M20 24v24"
						stroke="currentColor"
						stroke-width="1.1"
						stroke-linecap="round"
						opacity=".8"
					/>
				</svg>
				<Eyebrow tone="gold" surface="dark">{lineage.index} — {lineage.eyebrow}</Eyebrow>
				<h2
					id="movement-{lineage.id}"
					class="display mt-8 text-[clamp(2.6rem,7vw,5.75rem)] leading-[0.88] tracking-[-0.05em]"
				>
					{#each lineage.title as line, i (i)}<span class="block">{line}</span>{/each}
				</h2>
				<p
					class="display mx-auto mt-8 max-w-[34ch] text-xl leading-[1.55] text-paper/75 italic sm:text-2xl"
				>
					{lineage.lede}
				</p>
				<p class="mx-auto mt-6 max-w-xl text-sm leading-[1.8] text-paper/55">
					{content.lineage.close.defiant}
				</p>
			</div>

			<div
				class="mx-auto my-16 flex items-center justify-center gap-4 text-gold sm:my-20"
				aria-hidden="true"
			>
				<span class="h-px w-16 bg-current opacity-50"></span>
				<span class="size-1.5 rotate-45 bg-current"></span>
				<span class="h-px w-16 bg-current opacity-50"></span>
			</div>

			<ol class="mx-auto max-w-3xl">
				{#each content.lineage.entries as entry (entry.era)}
					<li
						class="relative ml-1 border-l border-gold/30 pb-14 pl-8 last:border-transparent last:pb-0 sm:pl-12"
					>
						<span
							class="absolute top-1.5 -left-[5px] size-[9px] rounded-full bg-gold ring-4 ring-forest"
							aria-hidden="true"
						></span>
						<p class="text-[11px] font-medium tracking-[0.24em] text-gold uppercase">
							{entry.era}
						</p>
						<h3 class="display mt-2 text-[clamp(1.55rem,3.2vw,2rem)] leading-[1.1] text-paper">
							{entry.title}
						</h3>
						<p class="mt-4 max-w-2xl text-[15px] leading-[1.9] text-paper/70">{entry.body}</p>
						<a
							class="mt-5 inline-block text-[10px] font-medium tracking-[0.2em] text-paper/65 uppercase underline decoration-gold/60 underline-offset-[6px] transition hover:text-white"
							href={entry.source.href}
							target={entry.source.href.startsWith('http') ? '_blank' : undefined}
							rel={entry.source.href.startsWith('http') ? 'noreferrer noopener' : undefined}
						>
							{entry.source.label}{#if entry.source.href.startsWith('http')}<span class="sr-only">
									(opens in a new tab)</span
								>{/if}
						</a>
					</li>
				{/each}
			</ol>

			<div class="mx-auto mt-20 max-w-3xl border-t border-gold/30 pt-12 text-center">
				<p class="display text-[clamp(1.6rem,4vw,2.35rem)] leading-[1.3] italic">
					{content.lineage.close.line}
				</p>
				<p class="display mt-8 tracking-[0.34em]">{content.lineage.close.sign}</p>
				<p class="display mt-2 text-base text-gold italic">{content.lineage.close.tag}</p>
				<div class="mt-8">
					<Button href={content.lineage.close.action.href} variant="quiet" surface="dark">
						{content.lineage.close.action.label}
					</Button>
				</div>
			</div>
		</div>
	</section>

	<!-- 02 · the fibre -->
	<section
		id={fibre.id}
		aria-labelledby="movement-{fibre.id}"
		data-header-theme="dark"
		class="relative isolate scroll-mt-28 overflow-hidden bg-forest-black text-stone-300"
	>
		<!-- Aspect-locked to the motif's own viewBox so `slice` never has to crop
		     hard and magnify two stalks into wallpaper on a narrow screen. -->
		<div
			class="pointer-events-none absolute inset-x-0 bottom-0 aspect-[8/5] max-h-[72%] text-paper"
		>
			<HempField opacity={0.055} density={11} seed={5} />
		</div>

		<div class="relative mx-auto max-w-[1600px] px-5 py-24 sm:px-10 sm:py-32 lg:px-14">
			<div class="grid gap-8 lg:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] lg:gap-16">
				<Eyebrow tone="gold" surface="dark">{fibre.index} — {fibre.eyebrow}</Eyebrow>
				<div>
					<h2
						id="movement-{fibre.id}"
						class="display text-[clamp(2.4rem,6vw,5.5rem)] leading-[0.86] tracking-[-0.05em] text-stone-100"
					>
						{#each fibre.title as line, i (i)}<span class="block">{line}</span>{/each}
					</h2>
					<p class="mt-8 max-w-2xl text-base leading-[1.85] text-stone-300">{fibre.lede}</p>
				</div>
			</div>

			<div
				class="mt-20 grid gap-8 border-t border-white/10 pt-12 lg:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] lg:gap-16"
			>
				<Eyebrow>What it is</Eyebrow>
				<div class="grid gap-12 md:grid-cols-2 md:gap-16">
					<div class="flex flex-col gap-6 text-[15px] leading-[1.95] text-stone-400">
						{#each content.hemp.body as paragraph, i (i)}<p>{paragraph}</p>{/each}
					</div>

					<dl class="self-start">
						{#each content.hemp.properties as property (property.term)}
							<div class="border-t border-white/10 py-5 first:border-t-0 first:pt-0">
								<dt class="text-[12px] font-medium tracking-[0.22em] text-stone-100 uppercase">
									{property.term}
								</dt>
								<dd class="mt-2 text-[15px] leading-[1.8] text-stone-400">{property.definition}</dd>
							</div>
						{/each}
					</dl>
				</div>
			</div>

			<div
				class="mt-20 grid gap-8 border-t border-white/10 pt-12 lg:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] lg:gap-16"
			>
				<Eyebrow>The blend</Eyebrow>
				<div>
					<p class="max-w-3xl text-lg leading-[1.7] text-stone-200 sm:text-xl">
						{content.hemp.blendNote}
					</p>

					<ul class="mt-14 grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-4">
						{#each content.hemp.facts as fact (fact.label)}
							<li class="flex flex-col gap-4 border-t border-gold/40 pt-5">
								<span
									class="display text-[clamp(2.2rem,4.2vw,3.4rem)] leading-none tracking-[-0.04em] text-gold"
								>
									{fact.value}{#if fact.unit}<span class="ml-1.5 text-base tracking-normal"
											>{fact.unit}</span
										>{/if}
								</span>
								<span
									class="text-[11px] leading-relaxed font-medium tracking-[0.2em] text-stone-400 uppercase"
								>
									{fact.label}
								</span>
							</li>
						{/each}
					</ul>
				</div>
			</div>
		</div>
	</section>

	<!-- ────────────────────────────────────────────────────── 03 · the label -->
	<section
		id={label.id}
		aria-labelledby="movement-{label.id}"
		data-header-theme="light"
		class="relative isolate scroll-mt-28 overflow-hidden bg-paper text-forest"
	>
		<div class="pointer-events-none absolute inset-x-0 top-0 aspect-[4/3] max-h-[78%] text-forest">
			<RootSystem opacity={0.08} depth={8} />
		</div>

		<div class="relative mx-auto max-w-[1600px] px-5 py-24 sm:px-10 sm:py-32 lg:px-14">
			<div class="grid gap-8 lg:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] lg:gap-16">
				<Eyebrow tone="strong" class="opacity-70">{label.index} — {label.eyebrow}</Eyebrow>
				<div>
					<h2
						id="movement-{label.id}"
						class="display text-[clamp(2.4rem,6vw,5.5rem)] leading-[0.86] tracking-[-0.05em]"
					>
						{#each label.title as line, i (i)}<span class="block">{line}</span>{/each}
					</h2>
					<p class="mt-8 max-w-2xl text-base leading-[1.85] text-forest/75">{label.lede}</p>
				</div>
			</div>

			<ol class="mt-20">
				{#each content.whyRootwear.principles as principle (principle.index)}
					<li
						class="grid gap-4 border-t border-forest/15 py-10 md:grid-cols-[4rem_minmax(0,16rem)_minmax(0,1fr)] md:items-baseline md:gap-10"
					>
						<span class="display text-3xl text-forest/70 tabular-nums">{principle.index}</span>
						<h3 class="text-[12px] font-medium tracking-[0.22em] uppercase">{principle.title}</h3>
						<p class="max-w-2xl text-[15px] leading-[1.95] text-forest/70">{principle.body}</p>
					</li>
				{/each}
			</ol>

			<figure class="mt-16 border-t border-forest/15 pt-14">
				<blockquote
					class="display max-w-[16ch] text-[clamp(2.2rem,5.4vw,4.5rem)] leading-[0.9] tracking-[-0.045em]"
				>
					{content.whyRootwear.pullquote.line}
				</blockquote>
				<figcaption class="mt-7 text-[11px] font-medium tracking-[0.28em] text-forest/70 uppercase">
					{content.whyRootwear.pullquote.attribution}
				</figcaption>
			</figure>
		</div>
	</section>

	<!-- 04 · the making -->
	<section
		id={making.id}
		aria-labelledby="movement-{making.id}"
		data-header-theme="dark"
		class="relative isolate scroll-mt-28 overflow-hidden bg-forest-black text-stone-300"
	>
		<div
			class="pointer-events-none absolute -top-[8%] -right-[18%] aspect-square w-[86%] max-w-[820px] text-paper sm:-right-[4%] sm:w-[52%]"
		>
			<HempMotif opacity={0.055} seed={9} />
		</div>

		<div class="relative mx-auto max-w-[1600px] px-5 py-24 sm:px-10 sm:py-32 lg:px-14">
			<div class="grid gap-8 lg:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] lg:gap-16">
				<Eyebrow tone="gold" surface="dark">{making.index} — {making.eyebrow}</Eyebrow>
				<div>
					<h2
						id="movement-{making.id}"
						class="display text-[clamp(2.4rem,6vw,5.5rem)] leading-[0.86] tracking-[-0.05em] text-stone-100"
					>
						{#each making.title as line, i (i)}<span class="block">{line}</span>{/each}
					</h2>
					<p class="mt-8 max-w-2xl text-base leading-[1.85] text-stone-300">{making.lede}</p>
				</div>
			</div>

			<ol class="mt-20 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-5">
				{#each content.making.steps as step (step.index)}
					<li class="flex flex-col gap-5 border-t border-white/15 pt-6">
						<span class="text-[11px] tracking-[0.28em] text-gold tabular-nums">{step.index}</span>
						<h3 class="display text-2xl leading-[1.05] text-stone-100">{step.title}</h3>
						<p class="text-[14px] leading-[1.85] text-stone-400">{step.body}</p>
					</li>
				{/each}
			</ol>
		</div>
	</section>

	<!-- ─────────────────────────────────────────────────────────── the close -->
	<section data-header-theme="dark" class="relative isolate overflow-hidden bg-forest text-paper">
		<div
			class="pointer-events-none absolute inset-x-0 bottom-0 aspect-[8/5] max-h-[85%] text-paper"
		>
			<HempField opacity={0.07} density={7} seed={17} />
		</div>

		<div class="relative mx-auto max-w-[1600px] px-5 py-24 sm:px-10 sm:py-32 lg:px-14">
			<Eyebrow tone="strong" class="opacity-60">{close.eyebrow}</Eyebrow>

			<p
				class="display mt-8 max-w-[14ch] text-[clamp(2.4rem,6vw,5.5rem)] leading-[0.88] tracking-[-0.05em]"
			>
				{#each close.line as line, i (i)}<span class="block">{line}</span>{/each}
			</p>

			<p class="mt-9 max-w-xl text-[15px] leading-[1.95] text-paper/75">{close.body}</p>

			<div class="mt-12 flex flex-wrap items-center gap-5">
				{#each close.actions as action (action.href)}
					<Button href={action.href} variant={action.primary ? 'solid' : 'quiet'} surface="dark">
						{action.label}
					</Button>
				{/each}
			</div>
		</div>
	</section>
</main>
