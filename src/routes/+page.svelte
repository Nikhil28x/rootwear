<script lang="ts">
	import { onMount } from 'svelte';
	import SiteHeader from '$lib/components/SiteHeader.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	type Drop = {
		name: string;
		note: string;
		view: string;
		image: string;
		hoverView: string;
		hoverImage: string;
	};

	const drops: Drop[] = [
		{
			name: 'Pineapple Haze Tee',
			note: 'Hemp cotton · 180 GSM · oversized',
			view: 'Front study',
			image: '/images/pineapple-haze-front.jpg',
			hoverView: 'Back study',
			hoverImage: '/images/pineapple-haze-back.jpg'
		},
		{
			name: 'Pineapple Haze Tee',
			note: 'Numbered edition · 01 of 25',
			view: 'Back study',
			image: '/images/pineapple-haze-back.jpg',
			hoverView: 'Front study',
			hoverImage: '/images/pineapple-haze-front.jpg'
		},
		{
			name: 'Pineapple Haze Tee',
			note: 'Unisex by design · limited run',
			view: 'Worn study',
			image: '/images/pineapple-haze-editorial.jpg',
			hoverView: 'Back study',
			hoverImage: '/images/pineapple-haze-editorial-back.jpg'
		}
	];

	/**
	 * RW-033 — §14: hemp and sustainability claims stay provable. These were
	 * previously "2,700 L water kept in the ground", "0.3 KG plastic fibre
	 * avoided", "4x fewer washes over its life" and "100% plant-led material
	 * story" — unsupported environmental claims carrying figures nothing backs,
	 * which §18 tests for explicitly. Replaced with verifiable properties of
	 * the garment itself. See $lib/content/claims.ts.
	 */
	const impactStats = [
		{ value: '30/70', unit: '', label: 'hemp to cotton, by composition', kind: 'plant' },
		{ value: '180', unit: 'GSM', label: 'fabric weight', kind: 'washes' },
		{ value: '25', unit: '', label: 'hand-numbered pieces', kind: 'water' },
		{ value: '05', unit: '', label: 'sizes, cut unisex', kind: 'plastic' }
	];

	const heroVideoWebmSrc = '/video/rootwear-forest-loop-seamless.webm';
	const heroVideoSrc = '/video/rootwear-forest-loop-seamless.mp4';

	let heroElement: HTMLElement;
	let heroVideoReady = $state(false);
	let heroProgress = $state(0);
	let wordmarkOpacity = $derived(Math.max(0, Math.min(1, (heroProgress - 0.12) / 0.52)));
	let wordmarkScale = $derived(0.84 + wordmarkOpacity * 0.16);

	function reveal(node: HTMLElement) {
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					node.dataset.visible = 'true';
					observer.unobserve(node);
				}
			},
			{ threshold: 0.16, rootMargin: '0px 0px -6% 0px' }
		);

		observer.observe(node);

		return {
			destroy: () => observer.disconnect()
		};
	}

	onMount(() => {
		const updateViewport = () => {
			if (!heroElement) return;
			const scrollRange = Math.max(heroElement.offsetHeight - window.innerHeight, 1);
			heroProgress = Math.max(0, Math.min(1, window.scrollY / scrollRange));

		};

		updateViewport();
		window.addEventListener('scroll', updateViewport, { passive: true });
		window.addEventListener('resize', updateViewport);

		return () => {
			window.removeEventListener('scroll', updateViewport);
			window.removeEventListener('resize', updateViewport);
		};
	});
</script>

<svelte:head>
	<title>Rootwear — Future-grown clothing</title>
	<meta
		name="description"
		content="Rootwear makes considered clothing from hemp: rooted in the earth, built for everyday life."
	/>
</svelte:head>

<!--
	The homepage used to carry its own copy of this header, which is how it and
	the rest of the site drifted apart. Same component now; the only difference
	is configuration — in-page anchors, a drop CTA, and fixed so the hero runs
	full bleed beneath it.
-->
<SiteHeader
	cta={{ label: 'Explore drop 01', href: '/drops/01-pineapple-haze' }}
	home="#top"
	position="fixed"
	surface="dark"
/>

<main id="top" class="overflow-clip bg-forest-black text-stone-100">
	<section bind:this={heroElement} class="relative h-[175svh]" aria-label="Rootwear introduction">
		<div class="sticky top-0 h-svh overflow-hidden bg-[#0b100d]">
			<img
				class="hero-poster absolute inset-0 size-full object-cover object-center"
				src="/images/rootwear-forest-hero.jpg"
				alt="A sculptural leafless tree in a misty forest"
			/>

			<video
				class:hero-video--ready={heroVideoReady}
				class="hero-video absolute inset-0 size-full object-cover object-center"
				poster="/images/rootwear-forest-hero.jpg"
				preload="auto"
				autoplay
				muted
				loop
				playsinline
				disablepictureinpicture
				controlslist="nodownload nofullscreen noremoteplayback"
				tabindex="-1"
				aria-hidden="true"
				oncanplay={() => (heroVideoReady = true)}
			>
				<source src={heroVideoWebmSrc} type="video/webm" />
				<source src={heroVideoSrc} type="video/mp4" />
			</video>

			<div class="hero-grade absolute inset-0"></div>

			<div
				class="hero-wordmark"
				style:opacity={wordmarkOpacity}
				style:transform={`translate(-50%, -50%) scale(${wordmarkScale})`}
				aria-hidden="true"
			>
				<span>ROOTWEAR</span>
			</div>

			<div class="tree-shadow absolute inset-0 z-20" aria-hidden="true"></div>

			<div class="ambient-mist absolute inset-0 z-20" aria-hidden="true">
				<span class="ambient-mist__wisp ambient-mist__wisp--one"></span>
				<span class="ambient-mist__wisp ambient-mist__wisp--two"></span>
			</div>

			<div class="intro-smoke absolute inset-0 z-30" aria-hidden="true">
				<span class="intro-smoke__cloud intro-smoke__cloud--one"></span>
				<span class="intro-smoke__cloud intro-smoke__cloud--two"></span>
				<span class="intro-smoke__cloud intro-smoke__cloud--three"></span>
			</div>

			<div class="absolute inset-x-0 bottom-0 z-30 p-5 pb-7 sm:p-10 sm:pb-10 lg:p-14">
				<div class="mx-auto flex max-w-[1600px] items-end justify-between gap-8">
					<div class="max-w-2xl">
						<p class="mb-4 text-[10px] tracking-[0.28em] text-stone-300 uppercase">
							Drop 01 · The first growth
						</p>
						<h1 class="display hero-headline">
							Grown, not<br />manufactured.
						</h1>
						<!-- The hero had no way out of it but the nav. -->
						<div class="mt-9 flex flex-wrap items-center gap-4">
							<a
								class="inline-flex border border-paper bg-paper px-7 py-4 text-[11px] font-medium tracking-[0.2em] text-forest uppercase transition hover:bg-white"
								href="/drops/01-pineapple-haze">Shop Drop 01</a
							>
							<a
								class="inline-flex border border-white/40 px-7 py-4 text-[11px] font-medium tracking-[0.2em] text-stone-100 uppercase transition hover:border-white hover:bg-white hover:text-black"
								href="/know-your-roots">Know your roots</a
							>
						</div>
					</div>
					<div
						class="hidden max-w-[18rem] border-l border-white/35 pl-5 text-xs leading-relaxed text-stone-300 lg:block"
					>
						Clothing grown from hemp. Designed to feel lived in, long before it wears out.
					</div>
				</div>
			</div>
		</div>
	</section>

	<section
		id="about"
		data-header-theme="light"
		class="relative bg-paper px-5 py-24 text-forest sm:px-10 sm:py-36 lg:px-14"
	>
		<div class="grain absolute inset-0 opacity-30" aria-hidden="true"></div>
		<div class="relative mx-auto max-w-[1600px]">
			<div use:reveal class="reveal-grid grid gap-16 lg:grid-cols-[0.9fr_1.1fr] lg:gap-24">
				<div class="relative min-h-[32rem] lg:min-h-[48rem]">
					<div class="absolute top-0 left-0 text-[10px] tracking-[0.25em] uppercase">
						01 / Why hemp
					</div>
					<div class="shirt-orbit absolute inset-0 grid place-items-center">
						<figure class="floating-shirt">
							<img
								src="/images/pineapple-haze-shirt-cutout.png"
								alt="The Pineapple Haze hemp T-shirt floating in space"
								width="1152"
								height="1366"
								loading="lazy"
								decoding="async"
							/>
						</figure>
					</div>
					<p
						class="absolute bottom-0 left-0 max-w-[15rem] text-[10px] leading-relaxed tracking-[0.16em] uppercase"
					>
						Grown, not manufactured.<br />Every fibre traced back to the plant.
					</p>
				</div>

				<div class="flex flex-col justify-center lg:py-12">
					<p class="mb-7 text-[10px] tracking-[0.25em] uppercase">Our story</p>
					<h2
						class="display max-w-4xl text-[clamp(3rem,6vw,7.2rem)] leading-[0.9] tracking-[-0.055em]"
					>
						The future of clothing has roots.
					</h2>
					<div class="mt-12 grid gap-8 border-t border-[#152016]/25 pt-7 sm:grid-cols-2">
						<p class="text-lg leading-relaxed sm:text-xl">
							Rootwear began with a simple question: what if the clothes closest to us could feel
							good without asking the earth for more than it can give?
						</p>
						<div class="space-y-5 text-sm leading-relaxed text-[#354035]">
							<p>
								Led by founder Aaron Mishra, Rootwear is a small team of designers, material
								obsessives and culture builders creating everyday uniforms from hemp-led fabrics.
							</p>
							<p>
								Every drop starts with the fibre and ends with fewer, better pieces made to gather
								character over time.
							</p>
							<a
								class="story-link inline-flex items-center gap-3 pt-4 text-[10px] tracking-[0.2em] uppercase"
								href="#impact"
							>
								Follow the fibre <span aria-hidden="true">↘</span>
							</a>
						</div>
					</div>
				</div>
			</div>
		</div>
	</section>

	<section id="drop" class="bg-forest px-5 py-24 sm:px-10 sm:py-36 lg:px-14">
		<div class="mx-auto max-w-[1600px]">
			<div
				use:reveal
				class="reveal-grid mb-14 flex flex-col justify-between gap-8 border-b border-white/15 pb-8 md:flex-row md:items-end"
			>
				<div>
					<p class="mb-6 text-[10px] tracking-[0.25em] text-[#aeb6a0] uppercase">02 / The drop</p>
					<h2 class="display text-[clamp(4rem,9vw,10rem)] leading-[0.75] tracking-[-0.065em]">
						First growth.
					</h2>
				</div>
				<p class="max-w-sm text-sm leading-relaxed text-stone-400">
					Three foundational forms. Quiet colours, tactile hemp and shapes that get better the more
					you live in them.
				</p>
			</div>

			<div class="grid gap-4 lg:grid-cols-3">
				{#each drops as product, index}
					<article
						use:reveal
						class="product-card group relative overflow-hidden border border-white/10 bg-[#1a2019]"
						style={`--delay:${index * 90}ms`}
					>
						<div
							class="absolute inset-x-0 top-0 flex justify-between p-5 text-[9px] tracking-[0.2em] uppercase"
						>
							<span>0{index + 1}</span>
							<span class="text-stone-500">{product.view}</span>
						</div>
						<div class="product-stage aspect-[4/5] overflow-hidden">
							<div class="product-transition">
								<img
									class="product-face product-face--primary"
									src={product.image}
									alt={`${product.name}, ${product.view}`}
								/>
								<img
									class="product-face product-face--alternate"
									src={product.hoverImage}
									alt={`${product.name}, ${product.hoverView}`}
								/>
							</div>
							<span class="product-flip__hint">
								{product.view} <i aria-hidden="true">↔</i>
								{product.hoverView}
							</span>
						</div>
						<div
							class="relative z-10 flex items-end justify-between gap-4 border-t border-white/10 p-5"
						>
							<div>
								<h3 class="text-base tracking-[-0.01em]">{product.name}</h3>
								<p class="mt-2 text-[10px] tracking-[0.08em] text-stone-500">{product.note}</p>
							</div>
							<p class="shrink-0 text-[9px] tracking-[0.15em] text-stone-500">
								{data.dropStatus?.label ?? 'Coming soon'}
							</p>
						</div>
						<a
							class="absolute inset-0 z-20 cursor-pointer"
							href="/drops/01-pineapple-haze"
							aria-label={`View ${product.name}`}
						></a>
					</article>
				{/each}
			</div>

			<div
				class="mt-8 flex items-center justify-between text-[9px] tracking-[0.2em] text-stone-500 uppercase"
			>
				<span>Made in small runs</span>
				<span>Sizes XS—XXL</span>
			</div>

			<div class="drop-collection-action">
				<a class="drop-collection-link" href="/drops/01-pineapple-haze">
					<span>View the collection</span>
					<span aria-hidden="true">↗</span>
				</a>
			</div>
		</div>
	</section>

	<section
		id="impact"
		data-header-theme="light"
		class="impact-section relative bg-paper px-5 pt-20 pb-16 text-forest sm:px-10 sm:pt-24 sm:pb-20 lg:px-14"
	>
		<div class="impact-rings absolute inset-0 overflow-hidden" aria-hidden="true">
			<span></span><span></span><span></span>
		</div>
		<div class="relative mx-auto max-w-[1600px]">
			<div use:reveal class="reveal-grid grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
				<div>
					<p class="mb-7 text-[10px] tracking-[0.25em] uppercase">03 / The material record</p>
					<a class="roots-jump" href="/know-your-roots"
						>Know your roots <span aria-hidden="true">↘</span></a
					>
					<h2 class="display text-[clamp(3.8rem,7vw,8rem)] leading-[0.82] tracking-[-0.06em]">
						What the cloth<br />is made of.
					</h2>
					<p class="mt-9 max-w-md text-sm leading-relaxed text-[#313a21]">
						Composition, weight and edition size, stated plainly. We publish what we can
						verify about the cloth, and nothing we cannot.
					</p>
					<a
						class="mt-8 inline-flex border border-forest px-7 py-4 text-[11px] font-medium tracking-[0.2em] uppercase transition hover:bg-forest hover:text-paper"
						href="/impact">Read the material record</a
					>
				</div>

				<div class="grid border-t border-l border-[#13190e]/30 sm:grid-cols-2">
					{#each impactStats as stat, index}
						<div
							use:reveal
							class="stat-cell border-r border-b border-[#13190e]/30 p-5 sm:p-6"
							style={`--delay:${index * 80}ms`}
						>
							<div class="flex items-start justify-between">
								<span class="text-[9px] tracking-[0.2em] uppercase">0{index + 1}</span>
								<span class={`impact-icon impact-icon--${stat.kind}`} aria-hidden="true"
									><i></i></span
								>
							</div>
							<p class="display mt-7 text-[clamp(2.6rem,4.6vw,4.6rem)] leading-none tracking-[-0.06em]">
								{stat.value}<span class="ml-2 text-[0.16em] tracking-[0.05em]">{stat.unit}</span>
							</p>
							<p class="mt-3 max-w-[12rem] text-[10px] leading-relaxed tracking-[0.14em] uppercase">
								{stat.label}
							</p>
						</div>
					{/each}
				</div>
			</div>

		</div>
	</section>

	<section
		data-header-theme="light"
		class="relative grid min-h-[52svh] place-items-center overflow-hidden bg-paper px-5 pt-16 pb-24 text-forest"
	>
		<div class="grain absolute inset-0 opacity-30" aria-hidden="true"></div>
		<div use:reveal class="reveal-grid relative max-w-5xl text-center">
			<p class="mb-7 text-[10px] tracking-[0.25em] uppercase">Return to your nature</p>
			<h2 class="display text-[clamp(4rem,10vw,11rem)] leading-[0.78] tracking-[-0.07em]">
				Wear the change slowly.
			</h2>
			<p class="mt-8 max-w-[46ch] text-[15px] leading-relaxed text-forest/75">
				Twenty-five hand-numbered pieces, cut once. When they are gone the drop closes and stays
				on the site with its story intact.
			</p>
			<!-- Points at the canonical drop URL (§05), not the old /new-collection
			     path, which only survives as a redirect. -->
			<div class="mt-10 flex flex-wrap items-center justify-center gap-4">
				<a
					class="inline-flex border border-forest bg-forest px-8 py-4 text-[11px] font-medium tracking-[0.2em] text-paper uppercase transition hover:bg-forest-black"
					href="/drops/01-pineapple-haze">Shop Drop 01</a
				>
				<a
					class="inline-flex border border-forest px-8 py-4 text-[11px] font-medium tracking-[0.2em] uppercase transition hover:bg-forest hover:text-paper"
					href="/impact">Read the material record</a
				>
			</div>
		</div>
	</section>
</main>

