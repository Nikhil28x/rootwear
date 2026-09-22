<script lang="ts">
	import Eyebrow from '$lib/components/ui/Eyebrow.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import HempMotif from '$lib/components/art/HempMotif.svelte';
	import RootSystem from '$lib/components/art/RootSystem.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Impact — the material record | Rootwear</title>
	<meta
		name="description"
		content="What the cloth is made of, in full: composition, weight, edition size and fit, and what each figure does and does not claim."
	/>
</svelte:head>

<main class="bg-paper text-forest">
	<!-- ─────────────────────────────────────────────────────────── the opening -->
	<section
		data-header-theme="light"
		class="relative isolate overflow-hidden px-5 pt-24 pb-16 sm:px-10 sm:pt-32 lg:px-14"
	>
		<div
			class="pointer-events-none absolute -top-[18%] -right-[16%] aspect-square w-[78%] max-w-[860px] text-forest"
			aria-hidden="true"
		>
			<RootSystem opacity={0.07} />
		</div>

		<div class="relative mx-auto max-w-[1600px]">
			<Eyebrow tone="strong" class="text-forest/65">The material record</Eyebrow>
			<h1
				class="display mt-6 max-w-[16ch] text-[clamp(2.8rem,6.5vw,6rem)] leading-[0.86] tracking-[-0.05em]"
			>
				What the cloth is made of.
			</h1>
			<p class="mt-8 max-w-[58ch] text-[16px] leading-[1.8] text-forest/75">
				Four numbers, stated in full. Each one describes the garment itself — what it is made
				from, how heavy it is, how many exist and how it is cut. Where a figure could be mistaken
				for a wider claim, we say so underneath it.
			</p>
		</div>
	</section>

	<!-- ───────────────────────────────────────────────────── the four in depth -->
	<section
		data-header-theme="light"
		class="relative px-5 pb-8 sm:px-10 lg:px-14"
		aria-label="The four figures in detail"
	>
		<div class="mx-auto max-w-[1600px]">
			{#each data.details as detail, index (detail.key)}
				<article
					class="grid gap-8 border-t border-forest/15 py-14 lg:grid-cols-[0.42fr_1.58fr] lg:gap-20"
				>
					<div class="flex flex-col gap-3">
						<span class="text-[11px] font-medium tracking-[0.22em] text-forest/60 uppercase">
							{String(index + 1).padStart(2, '0')}
						</span>
						<p class="display text-[clamp(3rem,6vw,5.5rem)] leading-none tracking-[-0.06em]">
							{detail.value}{#if detail.unit}<span
									class="ml-2 text-[0.2em] tracking-[0.06em]">{detail.unit}</span
								>{/if}
						</p>
						<p
							class="max-w-[16rem] text-[11px] font-medium leading-relaxed tracking-[0.14em] text-forest/75 uppercase"
						>
							{detail.label}
						</p>
					</div>

					<div class="flex flex-col gap-5">
						{#each detail.body as paragraph (paragraph)}
							<p class="max-w-[70ch] text-[16px] leading-[1.8] text-forest/80">{paragraph}</p>
						{/each}

						<!-- §14: say plainly what the number is NOT, so nobody reads a
						     sustainability claim into a fact about cloth. -->
						<p
							class="mt-2 max-w-[62ch] border-l-2 border-gold pl-5 text-[14px] leading-[1.75] text-forest/70"
						>
							{detail.notClaimed}
						</p>
					</div>
				</article>
			{/each}
		</div>
	</section>

	<!-- ──────────────────────────────────────────────────────────── the lineage -->
	<section
		data-header-theme="dark"
		class="relative isolate overflow-hidden bg-forest-black px-5 py-24 text-stone-300 sm:px-10 sm:py-32 lg:px-14"
	>
		<div
			class="pointer-events-none absolute top-0 -left-[10%] aspect-square w-[60%] max-w-[680px] text-paper"
			aria-hidden="true"
		>
			<HempMotif opacity={0.06} seed={7} />
		</div>

		<div class="relative mx-auto max-w-[1600px]">
			<Eyebrow>Before it was a garment</Eyebrow>
			<h2
				class="display mt-6 max-w-[14ch] text-[clamp(2.4rem,5vw,4.5rem)] leading-[0.9] tracking-[-0.04em] text-stone-100"
			>
				An ancient fibre.<br />A new chapter.
			</h2>

			<ol class="mt-14 grid gap-12 sm:grid-cols-2 lg:grid-cols-3">
				{#each data.lineage as entry (entry.era)}
					<li class="flex flex-col gap-3 border-t border-white/15 pt-6">
						<p class="text-[11px] font-medium tracking-[0.2em] text-stone-400 uppercase">
							{entry.era}
						</p>
						<h3 class="display text-2xl leading-tight text-stone-100">{entry.title}</h3>
						<p class="text-[15px] leading-[1.8] text-stone-400">{entry.body}</p>
						{#if entry.source}
							<a
								class="mt-1 text-[13px] text-gold underline-offset-4 hover:underline"
								href={entry.source.href}
								target="_blank"
								rel="noreferrer noopener"
							>
								{entry.source.label} ↗<span class="sr-only"> (opens in a new tab)</span>
							</a>
						{/if}
					</li>
				{/each}
			</ol>
		</div>
	</section>

	<!-- ──────────────────────────────────────────────────────────────── the CTA -->
	<section
		data-header-theme="light"
		class="px-5 py-20 text-center sm:px-10 sm:py-28 lg:px-14"
	>
		<div class="mx-auto flex max-w-2xl flex-col items-center gap-6">
			<Eyebrow tone="strong" class="text-forest/65">See it in the cloth</Eyebrow>
			<h2 class="display text-[clamp(2.2rem,5vw,4rem)] leading-[0.9] tracking-[-0.04em]">
				Twenty-five pieces,<br />numbered by hand.
			</h2>
			<Button href="/drops" surface="light" variant="solid">View the drop</Button>
		</div>
	</section>
</main>
