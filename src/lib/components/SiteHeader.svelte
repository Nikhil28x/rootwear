<script lang="ts">
	import { getCart } from '$lib/cart/cart.svelte';

	/**
	 * THE header. One component for every route, including the homepage, which
	 * used to carry its own copy of this markup — which is how the two drifted
	 * into looking like different sites.
	 *
	 * The glass treatment (inset shell, hairline border, backdrop blur) and its
	 * light/dark variants live in src/routes/layout.css under .site-header*,
	 * so both the styling and its transitions are shared rather than restated.
	 */
	type NavItem = { label: string; href: string };

	let {
		/** Nav entries. The homepage passes its in-page anchors instead. */
		items = [
			{ label: 'Drops', href: '/drops' },
			{ label: 'Know your roots', href: '/know-your-roots' },
			{ label: 'Contact', href: '/contact' }
		],
		/** Optional right-hand call to action, beside the cart. */
		cta = undefined,
		/** Where the wordmark points. The homepage sends it to its own top. */
		home = '/',
		/** Default ground. Overridden per section by the probe below. */
		surface = 'dark',
		/** `fixed` floats over a hero; `sticky` reserves its own band. */
		position = 'sticky'
	}: {
		items?: NavItem[];
		cta?: NavItem;
		home?: string;
		surface?: 'dark' | 'light';
		position?: 'fixed' | 'sticky';
	} = $props();

	const cart = getCart();
	let menuOpen = $state(false);

	/**
	 * Scroll-aware theming.
	 *
	 * `surface` is only the DEFAULT. A page that alternates cream and
	 * forest-black sections would otherwise pin one ink and go invisible over
	 * half its own content. Any section may declare data-header-theme.
	 */
	let probed = $state<'dark' | 'light' | null>(null);
	let resolved = $derived(probed ?? surface);

	/** Where the header's own ink sits, measured from the top of the viewport. */
	const HEADER_LINE = 44;

	/** Cheap guard: only re-read when the scroll position has actually moved. */
	let lastY = -1;

	/**
	 * Resolve what is behind the header by GEOMETRY, not hit-testing.
	 *
	 * elementsFromPoint answers differently depending on pointer-events,
	 * stacking context and viewport size; rectangles are deterministic.
	 * Read synchronously rather than in requestAnimationFrame, which does not
	 * run in a background tab — a tab scrolled while hidden would come back
	 * showing the wrong ink for the section behind it.
	 */
	function probeSurface() {
		const y = window.scrollY;
		if (y === lastY) return;
		lastY = y;

		let answer: 'dark' | 'light' | null = null;
		for (const section of document.querySelectorAll<HTMLElement>('[data-header-theme]')) {
			// The header carries the attribute it is resolving; skip itself.
			if (section.closest('[data-site-header]')) continue;
			const box = section.getBoundingClientRect();
			if (box.top <= HEADER_LINE && box.bottom > HEADER_LINE) {
				// Later siblings paint over earlier ones, so the last match wins.
				answer = section.dataset.headerTheme === 'dark' ? 'dark' : 'light';
			}
		}
		probed = answer;
	}

	/** Force a re-read even when scrollY has not changed (resize, late images). */
	function reprobe() {
		lastY = -1;
		probeSurface();
	}

	$effect(() => {
		reprobe();
		window.addEventListener('load', reprobe);
		return () => window.removeEventListener('load', reprobe);
	});
</script>

<svelte:window
	onscroll={probeSurface}
	onresize={reprobe}
	onkeydown={(e) => e.key === 'Escape' && (menuOpen = false)}
/>

<header
	data-site-header
	data-header-theme={resolved}
	class="site-header {position} inset-x-0 top-0 z-50 px-4 pt-4 text-stone-100 sm:px-7 sm:pt-6"
	class:site-header--light={resolved === 'light'}
>
	<div
		class="site-header__shell mx-auto flex max-w-[1600px] items-center justify-between border border-white/15 bg-black/10 px-4 py-3 backdrop-blur-md sm:px-6"
	>
		<a class="wordmark text-lg tracking-[0.22em]" href={home} aria-label="Rootwear home">
			ROOTWEAR
		</a>

		<nav
			class="hidden items-center gap-8 text-[12px] tracking-[0.2em] uppercase md:flex font-medium"
			aria-label="Primary"
		>
			{#each items as item (item.href)}
				<a class="nav-link" href={item.href}>{item.label}</a>
			{/each}
		</nav>

		<div class="flex items-center gap-3">
			{#if cta}
				<a
					class="site-header__cta hidden border border-white/25 px-4 py-2 text-[11px] tracking-[0.2em] uppercase transition hover:border-white hover:bg-white hover:text-black sm:block font-medium"
					href={cta.href}>{cta.label}</a
				>
			{/if}

			<a
				class="site-header__cta border border-white/25 px-4 py-2 text-[11px] tracking-[0.2em] uppercase transition hover:border-white hover:bg-white hover:text-black font-medium"
				href="/cart"
			>
				Cart{#if cart.count > 0}<span class="ml-2 tabular-nums">({cart.count})</span>{/if}
			</a>

			<button
				type="button"
				class="site-header__menu grid size-9 place-items-center border border-white/25 md:hidden"
				aria-label="Toggle navigation"
				aria-expanded={menuOpen}
				aria-controls="site-nav-mobile"
				onclick={() => (menuOpen = !menuOpen)}
			>
				<span class="menu-icon" class:open={menuOpen}></span>
			</button>
		</div>
	</div>

	{#if menuOpen}
		<nav
			id="site-nav-mobile"
			class="site-header__mobile mt-2 border border-white/15 bg-forest-black/95 p-5 backdrop-blur-xl md:hidden"
			aria-label="Mobile"
		>
			{#each items as item (item.href)}
				<a
					class="block border-b border-white/10 py-4 text-[15px] tracking-[0.18em] uppercase last:border-0 font-medium"
					href={item.href}
					onclick={() => (menuOpen = false)}
				>
					{item.label}
				</a>
			{/each}
			{#if cta}
				<a
					class="block border-b border-white/10 py-4 text-[15px] tracking-[0.18em] uppercase last:border-0 font-medium"
					href={cta.href}
					onclick={() => (menuOpen = false)}>{cta.label}</a
				>
			{/if}
		</nav>
	{/if}
</header>
