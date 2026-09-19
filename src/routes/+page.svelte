<script lang="ts">
	import { onMount } from 'svelte';

	type Drop = {
		name: string;
		note: string;
		price: string;
		view: string;
		image: string;
		hoverView: string;
		hoverImage: string;
	};

	const navItems = [
		{ label: 'Story', href: '#about' },
		{ label: 'The Drop', href: '#drop' },
		{ label: 'Impact', href: '#impact' }
	];

	const drops: Drop[] = [
		{
			name: 'Pineapple Haze Tee',
			note: 'Hemp cotton · 180 GSM · oversized',
			price: '₹3,490',
			view: 'Front study',
			image: '/images/pineapple-haze-front.jpg',
			hoverView: 'Back study',
			hoverImage: '/images/pineapple-haze-back.jpg'
		},
		{
			name: 'Pineapple Haze Tee',
			note: 'Numbered edition · 01 of 25',
			price: '₹3,490',
			view: 'Back study',
			image: '/images/pineapple-haze-back.jpg',
			hoverView: 'Front study',
			hoverImage: '/images/pineapple-haze-front.jpg'
		},
		{
			name: 'Pineapple Haze Tee',
			note: 'Unisex by design · limited run',
			price: '₹3,490',
			view: 'Worn study',
			image: '/images/pineapple-haze-editorial.jpg',
			hoverView: 'Back study',
			hoverImage: '/images/pineapple-haze-editorial-back.jpg'
		}
	];

	const impactStats = [
		{ value: '2,700', unit: 'L', label: 'water kept in the ground', kind: 'water' },
		{ value: '0.3', unit: 'KG', label: 'plastic fibre avoided', kind: 'plastic' },
		{ value: '04', unit: '×', label: 'fewer washes over its life', kind: 'washes' },
		{ value: '100', unit: '%', label: 'plant-led material story', kind: 'plant' }
	];

	const heroVideoWebmSrc = '/video/rootwear-forest-loop-seamless.webm';
	const heroVideoSrc = '/video/rootwear-forest-loop-seamless.mp4';

	let heroElement: HTMLElement;
	let menuOpen = $state(false);
	let lightHeader = $state(false);
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

			const activeSection = document
				.elementsFromPoint(window.innerWidth / 2, Math.min(110, window.innerHeight - 1))
				.find((element) => element.tagName === 'SECTION') as HTMLElement | undefined;
			lightHeader = activeSection?.dataset.headerTheme === 'light';
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

<svelte:window
	onkeydown={(event) => {
		if (event.key === 'Escape') menuOpen = false;
	}}
/>

<header
	class="site-header fixed inset-x-0 top-0 z-50 px-4 pt-4 text-stone-100 sm:px-7 sm:pt-6"
	class:site-header--light={lightHeader}
>
	<div
		class="site-header__shell mx-auto flex max-w-[1600px] items-center justify-between border border-white/15 bg-black/10 px-4 py-3 backdrop-blur-md sm:px-6"
	>
		<a class="wordmark text-lg tracking-[0.22em]" href="#top" aria-label="Rootwear home">
			ROOTWEAR
		</a>

		<nav class="hidden items-center gap-8 text-[11px] tracking-[0.2em] uppercase md:flex">
			{#each navItems as item}
				<a class="nav-link" href={item.href}>{item.label}</a>
			{/each}
		</nav>

		<div class="flex items-center gap-3">
			<a
				class="site-header__cta hidden border border-white/25 px-4 py-2 text-[10px] tracking-[0.2em] uppercase transition hover:border-white hover:bg-white hover:text-black sm:block"
				href="/new-collection"
			>
				Explore drop 01
			</a>
			<button
				type="button"
				class="site-header__menu grid size-9 place-items-center border border-white/25 md:hidden"
				aria-label="Toggle navigation"
				aria-expanded={menuOpen}
				onclick={() => (menuOpen = !menuOpen)}
			>
				<span class="menu-icon" class:open={menuOpen}></span>
			</button>
		</div>
	</div>

	{#if menuOpen}
		<nav
			class="site-header__mobile mt-2 border border-white/15 bg-[#11160f]/95 p-5 backdrop-blur-xl md:hidden"
		>
			{#each navItems as item}
				<a
					class="block border-b border-white/10 py-4 text-sm tracking-[0.18em] uppercase last:border-0"
					href={item.href}
					onclick={() => (menuOpen = false)}
				>
					{item.label}
				</a>
			{/each}
		</nav>
	{/if}
</header>

<main id="top" class="overflow-clip bg-[#0b0f0b] text-stone-100">
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
		class="relative bg-[#f6efdd] px-5 py-24 text-[#1f382a] sm:px-10 sm:py-36 lg:px-14"
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

	<section id="drop" class="bg-[#1f382a] px-5 py-24 sm:px-10 sm:py-36 lg:px-14">
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
							<p class="shrink-0 text-[9px] tracking-[0.15em] text-stone-500">{product.price}</p>
						</div>
						<a
							class="absolute inset-0 z-20 cursor-pointer"
							href="/new-collection"
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
				<a class="drop-collection-link" href="/new-collection">
					<span>View the collection</span>
					<span aria-hidden="true">↗</span>
				</a>
			</div>
		</div>
	</section>

	<section
		id="impact"
		data-header-theme="light"
		class="impact-section relative bg-[#f6efdd] px-5 py-24 text-[#1f382a] sm:px-10 sm:py-36 lg:px-14"
	>
		<div class="impact-rings absolute inset-0 overflow-hidden" aria-hidden="true">
			<span></span><span></span><span></span>
		</div>
		<div class="relative mx-auto max-w-[1600px]">
			<div use:reveal class="reveal-grid grid gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:gap-24">
				<div>
					<p class="mb-7 text-[10px] tracking-[0.25em] uppercase">03 / Impact receipt</p>
					<a class="roots-jump" href="#know-your-roots"
						>Know Your Roots <span aria-hidden="true">↘</span></a
					>
					<h2 class="display text-[clamp(3.8rem,7vw,8rem)] leading-[0.82] tracking-[-0.06em]">
						What this order leaves behind.
					</h2>
					<p class="mt-9 max-w-md text-sm leading-relaxed text-[#313a21]">
						Every order will carry its own material receipt—turning abstract sustainability claims
						into numbers you can actually see.
					</p>
				</div>

				<div class="grid border-t border-l border-[#13190e]/30 sm:grid-cols-2">
					{#each impactStats as stat, index}
						<div
							use:reveal
							class="stat-cell border-r border-b border-[#13190e]/30 p-6 sm:p-8"
							style={`--delay:${index * 80}ms`}
						>
							<div class="flex items-start justify-between">
								<span class="text-[9px] tracking-[0.2em] uppercase">0{index + 1}</span>
								<span class={`impact-icon impact-icon--${stat.kind}`} aria-hidden="true"
									><i></i></span
								>
							</div>
							<p class="display mt-12 text-[clamp(4rem,7vw,8rem)] leading-none tracking-[-0.07em]">
								{stat.value}<span class="ml-2 text-[0.16em] tracking-[0.05em]">{stat.unit}</span>
							</p>
							<p class="mt-5 max-w-[12rem] text-[10px] leading-relaxed tracking-[0.14em] uppercase">
								{stat.label}
							</p>
						</div>
					{/each}
				</div>
			</div>

			<div
				class="mt-12 border-t border-[#13190e]/30 pt-5 text-[9px] leading-relaxed tracking-[0.12em] uppercase opacity-65"
			>
				Sample impact profile. Replace with Rootwear's independently verified lifecycle figures
				before launch.
			</div>
			<section
				id="know-your-roots"
				class="roots-section"
				data-header-theme="light"
				aria-labelledby="roots-title"
			>
				<div class="roots-intro">
					<p class="roots-eyebrow">Impact / Know Your Roots</p>
					<h3 id="roots-title" class="display">An ancient fibre.<br />A new chapter.</h3>
					<p>
						Before it became a garment, it was a plant. Follow hemp through its early uses, India's
						material history, and the clothes we choose today.
					</p>
				</div>
				<ol class="roots-timeline">
					<li>
						<p class="roots-era">c. 6000 BCE / East Asia</p>
						<h4 class="display">The first threads</h4>
						<p>
							Archaeological evidence places the use of cannabis seeds and fibres in East Asia
							around 8,000 years ago. Hemp's material story began long before modern fashion.
						</p>
						<a href="https://www.nature.com/articles/s41586-025-09065-0"
							>Read the research in Nature ↗</a
						>
					</li>
					<li>
						<p class="roots-era">1885 / Punjab, India</p>
						<h4 class="display">India, in the fibre</h4>
						<p>
							A hemp fibre sample from Punjab, given by the Royal Botanic Gardens, Kew, in 1885, is
							preserved in the Smithsonian's collection—a tangible record of India's place in this
							material's history.
						</p>
						<a href="https://americanhistory.si.edu/collections/object/nmah_648677"
							>Explore the Smithsonian archive ↗</a
						>
					</li>
					<li>
						<p class="roots-era">Today / Rootwear</p>
						<h4 class="display">Grown, not manufactured.</h4>
						<p>
							Our chapter starts with hemp-led fabrics and everyday pieces. Knowing the roots of a
							material is part of choosing what comes next.
						</p>
					</li>
				</ol>
			</section>
		</div>
	</section>

	<section
		data-header-theme="light"
		class="relative grid min-h-[75svh] place-items-center overflow-hidden bg-[#f6efdd] px-5 py-24 text-[#1f382a]"
	>
		<div class="grain absolute inset-0 opacity-30" aria-hidden="true"></div>
		<div use:reveal class="reveal-grid relative max-w-5xl text-center">
			<p class="mb-7 text-[10px] tracking-[0.25em] uppercase">Return to your nature</p>
			<h2 class="display text-[clamp(4rem,10vw,11rem)] leading-[0.78] tracking-[-0.07em]">
				Wear the change slowly.
			</h2>
			<a
				class="mt-12 inline-flex border border-[#1f382a] px-7 py-4 text-[10px] tracking-[0.2em] uppercase transition hover:bg-[#1f382a] hover:text-[#f6efdd]"
				href="/new-collection"
			>
				Enter drop 01
			</a>
		</div>
	</section>
</main>

<footer id="footer" class="brand-footer">
	<figure class="brand-footer__artwork">
		<img
			src="/images/rootwear-brand-story.jpg"
			alt="Rootwear's illustrated tree manifesto: before we build, we listen; built from the ground up"
			loading="lazy"
		/>
		<figcaption class="brand-footer__desktop-tagline">Established in Process</figcaption>
	</figure>

	<div class="brand-footer__mobile-lockup" aria-hidden="true">
		<p>ROOTWEAR</p>
		<span>Established in Process</span>
		<small>Built from the ground up.</small>
	</div>

	<div class="brand-footer__legal">
		<span>© 2026 Rootwear · Established in Process</span>
		<nav aria-label="Footer navigation">
			<a href="#about">Story</a>
			<a href="/new-collection">Drop 01</a>
			<a href="#impact">Impact</a>
		</nav>
		<a href="#top">Return to the canopy ↑</a>
	</div>
</footer>
