<script lang="ts">
	import { getCart } from '$lib/cart/cart.svelte';
	import { page } from '$app/state';
	import { SUPPORT_EMAIL, INSTAGRAM_HANDLE, INSTAGRAM_URL } from '$lib/content/business';

	/**
	 * THE header. One component for every route, including the homepage, which
	 * used to carry its own copy of this markup — which is how the two drifted
	 * into looking like different sites.
	 *
	 * A slim bar, clear over whatever is behind it until the page scrolls, then
	 * frosted glass with a hairline. Its ink follows the section behind it
	 * (the probe below); on a phone the menu opens as a full-screen sheet.
	 */
	type NavItem = { label: string; href: string };

	let {
		/** Nav entries. The homepage passes its in-page anchors instead. */
		items = [
			{ label: 'Shop', href: '/drops' },
			{ label: 'Our roots', href: '/know-your-roots' },
			{ label: 'Impact', href: '/impact' },
			{ label: 'Contact', href: '/contact' }
		],
		/** Optional right-hand call to action, beside the cart. */
		cta = undefined,
		/** Where the wordmark points. The homepage sends it to its own top. */
		home = '/',
		/** Default ground. Overridden per section by the probe below. */
		surface = 'dark',
		/** `fixed` floats over a hero; `sticky` reserves its own band. */
		position = 'sticky',
		/** A page with its own masthead hides the small mark until it scrolls. */
		markOnTop = true
	}: {
		items?: NavItem[];
		cta?: NavItem;
		home?: string;
		surface?: 'dark' | 'light';
		position?: 'fixed' | 'sticky';
		markOnTop?: boolean;
	} = $props();

	const cart = getCart();
	let menuOpen = $state(false);

	/**
	 * Scroll-aware theming.
	 *
	 * `surface` is only the DEFAULT. A page that alternates white and
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
	/** Clear at the top of the page, frosted once it scrolls. */
	let scrolled = $state(false);

	function probeSurface() {
		const y = window.scrollY;
		if (y === lastY) return;
		lastY = y;
		scrolled = y > 24;

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

	function isCurrent(href: string) {
		if (href.startsWith('#')) return false;
		return page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
	}

	// The open sheet owns the screen: no scrolling the page behind it.
	$effect(() => {
		document.documentElement.style.overflow = menuOpen ? 'hidden' : '';
		return () => {
			document.documentElement.style.overflow = '';
		};
	});
</script>

<svelte:window
	onscroll={probeSurface}
	onresize={reprobe}
	onkeydown={(e) => e.key === 'Escape' && (menuOpen = false)}
/>

<header
	data-site-header
	data-header-theme={menuOpen ? 'dark' : resolved}
	class="head head--{position}"
	class:head--light={resolved === 'light' && !menuOpen}
	class:head--solid={scrolled && !menuOpen}
>
	<div class="head__bar">
		<a
			class="head__mark wordmark"
			class:head__mark--away={!markOnTop && !scrolled && !menuOpen}
			href={home}
			aria-label="Rootwear home"
		>
			ROOTWEAR<sup aria-hidden="true">TM</sup>
		</a>

		<nav class="head__nav" aria-label="Primary">
			{#each items as item (item.href)}
				<a href={item.href} aria-current={isCurrent(item.href) ? 'page' : undefined}>{item.label}</a>
			{/each}
		</nav>

		<div class="head__end">
			{#if cta}
				<a class="head__cta" href={cta.href}>{cta.label}</a>
			{/if}
			<a class="head__cart" href="/cart" aria-label="Cart, {cart.count} {cart.count === 1 ? 'item' : 'items'}">
				Cart
				<span class="head__count" class:head__count--on={cart.count > 0}>{cart.count}</span>
			</a>
			<button
				type="button"
				class="head__menu"
				aria-label={menuOpen ? 'Close menu' : 'Open menu'}
				aria-expanded={menuOpen}
				aria-controls="site-nav-mobile"
				onclick={() => (menuOpen = !menuOpen)}
			>
				<span class="head__burger" class:head__burger--open={menuOpen} aria-hidden="true"></span>
			</button>
		</div>
	</div>

	{#if menuOpen}
		<div id="site-nav-mobile" class="sheet">
			<nav aria-label="Mobile">
				{#each items as item, index (item.href)}
					<a
						href={item.href}
						style="--i: {index}"
						aria-current={isCurrent(item.href) ? 'page' : undefined}
						onclick={() => (menuOpen = false)}>{item.label}</a
					>
				{/each}
				{#if cta}
					<a href={cta.href} style="--i: {items.length}" onclick={() => (menuOpen = false)}>{cta.label}</a>
				{/if}
			</nav>
			<div class="sheet__foot">
				<a href="mailto:{SUPPORT_EMAIL}">{SUPPORT_EMAIL}</a>
				<a href={INSTAGRAM_URL} rel="noreferrer noopener">{INSTAGRAM_HANDLE}</a>
			</div>
		</div>
	{/if}
</header>

<style>
	.head {
		--ink: #f3efe6;
		--line: rgb(243 239 230 / 0.16);
		--glass: rgb(11 15 11 / 0.7);
		inset-inline: 0;
		top: 0;
		z-index: 50;
		color: var(--ink);
		transition: color 0.3s ease;
	}
	.head--fixed {
		position: fixed;
	}
	.head--sticky {
		position: sticky;
	}
	.head--light {
		--ink: var(--color-forest);
		--line: rgb(31 56 42 / 0.14);
		--glass: rgb(255 255 255 / 0.78);
	}
	.head__bar {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 24px;
		height: 68px;
		padding: env(safe-area-inset-top, 0px) clamp(20px, 4vw, 56px) 0;
		border-bottom: 1px solid transparent;
		transition:
			background-color 0.35s ease,
			border-color 0.35s ease,
			backdrop-filter 0.35s ease;
	}
	.head--solid .head__bar {
		background: var(--glass);
		border-color: var(--line);
		backdrop-filter: blur(16px) saturate(1.3);
		-webkit-backdrop-filter: blur(16px) saturate(1.3);
	}
	.head__mark {
		justify-self: start;
		font-size: 19px;
		letter-spacing: 0.24em;
	}
	.head__mark {
		transition:
			opacity 0.35s ease,
			transform 0.35s ease;
	}
	.head__mark--away {
		opacity: 0;
		transform: translateY(-6px);
		pointer-events: none;
	}
	.head__mark sup {
		margin-left: 2px;
		font-size: 0.38em;
		letter-spacing: 0.06em;
		vertical-align: 1.1em;
	}
	.head__nav {
		display: flex;
		gap: clamp(20px, 2.6vw, 36px);
		font-size: 14px;
	}
	.head__nav a {
		position: relative;
		padding: 6px 0;
		opacity: 0.82;
		transition: opacity 0.2s;
	}
	.head__nav a:hover,
	.head__nav a[aria-current='page'] {
		opacity: 1;
	}
	.head__nav a::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 1px;
		background: currentColor;
		transform: scaleX(0);
		transform-origin: right;
		transition: transform 0.25s ease;
	}
	.head__nav a:hover::after,
	.head__nav a[aria-current='page']::after {
		transform: scaleX(1);
		transform-origin: left;
	}
	.head__end {
		justify-self: end;
		display: flex;
		align-items: center;
		gap: 18px;
		font-size: 14px;
	}
	.head__cta {
		padding: 8px 14px;
		border: 1px solid var(--line);
		transition: border-color 0.2s;
	}
	.head__cta:hover {
		border-color: currentColor;
	}
	.head__cart {
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}
	.head__count {
		display: inline-grid;
		place-items: center;
		min-width: 22px;
		height: 22px;
		padding-inline: 6px;
		border-radius: 999px;
		font-size: 12px;
		font-variant-numeric: tabular-nums;
		border: 1px solid var(--line);
		transition:
			background-color 0.3s,
			color 0.3s;
	}
	.head__count--on {
		background: var(--color-gold);
		border-color: var(--color-gold);
		color: var(--color-forest-black);
	}
	.head__menu {
		display: none;
		width: 40px;
		height: 40px;
		place-items: center;
		margin-right: -10px;
	}
	.head__burger,
	.head__burger::before,
	.head__burger::after {
		display: block;
		width: 20px;
		height: 1.5px;
		background: currentColor;
		transition: transform 0.3s ease, opacity 0.2s;
	}
	.head__burger {
		position: relative;
	}
	.head__burger::before,
	.head__burger::after {
		content: '';
		position: absolute;
		left: 0;
	}
	.head__burger::before {
		transform: translateY(-6px);
	}
	.head__burger::after {
		transform: translateY(6px);
	}
	.head__burger--open {
		background: transparent;
	}
	.head__burger--open::before {
		transform: rotate(45deg);
	}
	.head__burger--open::after {
		transform: rotate(-45deg);
	}
	.head :global(:focus-visible) {
		outline: 1px solid currentColor;
		outline-offset: 4px;
	}

	/* The phone sheet: the whole screen, the links set large. */
	.sheet {
		position: fixed;
		inset: 0;
		z-index: -1;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding: calc(110px + env(safe-area-inset-top, 0px)) clamp(20px, 4vw, 56px)
			calc(32px + env(safe-area-inset-bottom, 0px));
		background: var(--color-forest-black);
		color: #f3efe6;
		animation: sheet-in 0.35s ease both;
	}
	.sheet nav {
		display: flex;
		flex-direction: column;
	}
	.sheet nav a {
		padding: 10px 0;
		font-family: var(--font-display);
		font-size: clamp(2.6rem, 11vw, 3.6rem);
		line-height: 1;
		letter-spacing: -0.03em;
		border-bottom: 1px solid rgb(243 239 230 / 0.1);
		animation: sheet-link 0.5s cubic-bezier(0.2, 0.7, 0.2, 1) both;
		animation-delay: calc(80ms + var(--i) * 50ms);
	}
	.sheet nav a[aria-current='page'] {
		color: var(--color-gold);
	}
	.sheet__foot {
		display: flex;
		flex-direction: column;
		gap: 8px;
		font-size: 14px;
		color: rgb(243 239 230 / 0.7);
	}
	@keyframes sheet-in {
		from {
			opacity: 0;
		}
	}
	@keyframes sheet-link {
		from {
			opacity: 0;
			transform: translateY(16px);
		}
	}

	@media (max-width: 860px) {
		.head__bar {
			grid-template-columns: 1fr auto;
			height: 60px;
		}
		.head__nav,
		.head__cta {
			display: none;
		}
		.head__menu {
			display: grid;
		}
		.head__mark {
			font-size: 17px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.sheet,
		.sheet nav a {
			animation: none;
		}
	}
</style>
