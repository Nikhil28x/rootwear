<script lang="ts">
	import { getCart } from '$lib/cart/cart.svelte';

	/**
	 * The shared header. Both original pages carried their own copy of this
	 * markup, which is why the cart badge had nowhere to live.
	 *
	 * `surface` says what the header sits ON. The homepage flips it while
	 * scrolling between dark and cream sections; every other page states it once.
	 */
	let {
		surface = 'dark',
		floating = false
	}: { surface?: 'dark' | 'light'; floating?: boolean } = $props();

	const cart = getCart();
	let menuOpen = $state(false);

	/**
	 * Scroll-aware theming.
	 *
	 * `surface` is only the DEFAULT. A page that alternates cream and
	 * forest-black sections — /know-your-roots does exactly that — would
	 * otherwise pin one ink colour and go invisible over half its own content.
	 *
	 * Any section may declare `data-header-theme="light|dark"`; the header
	 * probes whatever sits behind it and retints. Same convention the homepage
	 * hero already uses, now available to every route.
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
	 * An earlier version used document.elementsFromPoint(). That is a hit test,
	 * so it answers differently depending on pointer-events, stacking context
	 * and — the case that actually bit — a zero-sized viewport, where it
	 * returns nothing at all. Reading rectangles is deterministic and asks the
	 * question we actually mean: which themed section spans the header's line?
	 *
	 * Read synchronously rather than inside requestAnimationFrame. rAF does not
	 * run in a background tab, which would leave the header showing the wrong
	 * ink for the section behind it on return. At five sections the layout read
	 * costs less than the bookkeeping to defer it.
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
		// Late-loading images shift what sits under the header.
		window.addEventListener('load', reprobe);
		return () => window.removeEventListener('load', reprobe);
	});

	const nav = [
		{ label: 'Drops', href: '/drops' },
		{ label: 'Know your roots', href: '/know-your-roots' },
		{ label: 'Contact', href: '/contact' }
	];

	/**
	 * Each tone carries its own GROUND as well as its ink.
	 *
	 * The header previously set only a text colour and let whatever sat behind
	 * it show through. On a light route that ground is `body`, which is
	 * forest-black — so dark green ink landed on near-black and the nav was
	 * effectively invisible. A header must never be transparent over a ground
	 * it does not control.
	 */
	let tone = $derived(
		resolved === 'light'
			? {
					text: 'text-forest',
					bg: 'bg-cream',
					rule: 'border-forest/20',
					hover: 'hover:text-forest'
				}
			: {
					text: 'text-stone-100',
					bg: 'bg-forest-black',
					rule: 'border-white/20',
					hover: 'hover:text-white'
				}
	);
</script>

<header
	data-site-header
	class="{floating ? 'fixed' : 'sticky'} inset-x-0 top-0 z-50 transition-colors duration-300 {tone.text} {floating ? '' : tone.bg}"
	data-header-theme={resolved}
>
	<div class="mx-auto flex max-w-[1600px] items-center justify-between gap-6 px-5 py-5 sm:px-10 lg:px-14">
		<a href="/" class="wordmark text-lg tracking-[0.2em] uppercase" aria-label="Rootwear home">
			Rootwear
		</a>

		<nav class="hidden items-center gap-9 md:flex" aria-label="Primary">
			{#each nav as item (item.href)}
				<a
					class="text-[10px] tracking-[0.2em] uppercase opacity-80 transition hover:opacity-100 {tone.hover}"
					href={item.href}>{item.label}</a
				>
			{/each}
		</nav>

		<div class="flex items-center gap-4">
			<a
				class="border {tone.rule} px-5 py-3 text-[10px] tracking-[0.18em] uppercase transition hover:opacity-70"
				href="/cart"
			>
				Cart{#if cart.count > 0}<span class="ml-2 tabular-nums">({cart.count})</span>{/if}
			</a>
			<button
				class="border {tone.rule} px-4 py-3 text-[10px] tracking-[0.18em] uppercase md:hidden"
				aria-expanded={menuOpen}
				aria-controls="mobile-nav"
				onclick={() => (menuOpen = !menuOpen)}
			>
				{menuOpen ? 'Close' : 'Menu'}
			</button>
		</div>
	</div>

	{#if menuOpen}
		<nav
			id="mobile-nav"
			class="border-t {tone.rule} {tone.bg} px-5 py-6 backdrop-blur-xl md:hidden"
			aria-label="Mobile"
		>
			<ul class="flex flex-col gap-5">
				{#each nav as item (item.href)}
					<li>
						<a
							class="text-sm tracking-[0.18em] text-stone-100 uppercase"
							href={item.href}
							onclick={() => (menuOpen = false)}>{item.label}</a
						>
					</li>
				{/each}
			</ul>
		</nav>
	{/if}
</header>

<svelte:window
	onscroll={probeSurface}
	onresize={reprobe}
	onkeydown={(e) => e.key === 'Escape' && (menuOpen = false)}
/>
