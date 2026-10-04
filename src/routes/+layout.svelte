<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { onNavigate } from '$app/navigation';
	import { setCart } from '$lib/cart/cart.svelte';
	import SiteHeader from '$lib/components/SiteHeader.svelte';
	import SiteFooter from '$lib/components/SiteFooter.svelte';
	import { BRAND_THEME_COLOR } from '$lib/brand';

	let { children, data } = $props();

	// Per-request cart state, shared by context. Never a module singleton —
	// on the server that would be shared across concurrent requests.
	//
	// Passed as a FUNCTION so the badge is correct in server-rendered HTML and
	// still tracks `data` across navigations. Seeding a copy would go stale;
	// syncing in an $effect would leave the badge empty until hydration, and
	// empty forever without JavaScript.
	setCart(() => data.cartLines ?? []);

	/**
	 * The homepage renders SiteHeader itself, because it needs a different
	 * configuration: in-page anchors, a drop CTA, and `fixed` so the hero runs
	 * full bleed beneath it. Same component, different props.
	 */
	let isHome = $derived(page.route.id === '/');
	let isAdmin = $derived(page.route.id?.startsWith('/admin') ?? false);
	/** The product experience opens on a full-bleed hero, so the header floats over it. */
	let isExperience = $derived(
		page.route.id === '/drops/[drop]' || page.route.id === '/drops/[drop]/[product]'
	);

	/** Routes that sit on cream rather than forest-black. */
	const LIGHT_ROUTES = [
		'/policies',
		'/contact',
		'/know-your-roots',
		'/account',
		'/cart',
		'/checkout',
		'/drops',
		'/impact',
		'/order'
	];
	/** The colours shown when the page is pulled past its top or bottom edge. */
	let edgeTop = $derived(isExperience ? '#0b0f0b' : '#ffffff');
	let edgeBottom = $derived(isAdmin ? '#ffffff' : 'var(--color-forest)');
	$effect(() => {
		const root = document.documentElement.style;
		root.setProperty('--edge-top', edgeTop);
		root.setProperty('--edge-bottom', edgeBottom);
		// The overscroll area takes the root's background colour, so match it to
		// whichever end of the page is nearer.
		let lowerHalf: boolean | null = null;
		const update = () => {
			const doc = document.documentElement;
			const next = window.scrollY + window.innerHeight / 2 > doc.scrollHeight / 2;
			if (next === lowerHalf) return;
			lowerHalf = next;
			root.setProperty('--edge-now', next ? edgeBottom : edgeTop);
		};
		update();
		window.addEventListener('scroll', update, { passive: true });
		window.addEventListener('resize', update);
		return () => {
			window.removeEventListener('scroll', update);
			window.removeEventListener('resize', update);
		};
	});

	/**
	 * The checkout reads as one sheet: Cart → Checkout → Payment → Order slide
	 * up going forward and down going back, with the header still.
	 */
	const FLOW = ['/cart', '/checkout/information', '/checkout/processing', '/order/[token]'];
	onNavigate((navigation) => {
		const from = FLOW.indexOf(navigation.from?.route.id ?? '');
		const to = FLOW.indexOf(navigation.to?.route.id ?? '');
		if (from < 0 || to < 0 || from === to) return;
		if (!document.startViewTransition) return;
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

		document.documentElement.dataset.stepDir = to > from ? 'forward' : 'back';
		return new Promise((resolve) => {
			const transition = document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
			transition.finished.finally(() => {
				delete document.documentElement.dataset.stepDir;
			});
		});
	});

	let surface = $derived(
		LIGHT_ROUTES.some((r) => page.route.id?.startsWith(r)) ? 'light' : 'dark'
	) as 'light' | 'dark';
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="theme-color" content={isAdmin ? '#ffffff' : BRAND_THEME_COLOR} />
</svelte:head>

{#if isHome}
	<!-- The homepage renders its own SiteHeader (anchored hero, drop CTA, fixed). -->
	{@render children()}
{:else if isAdmin}
	<!-- Operations is a separate, light workspace without the storefront chrome. -->
	<div class="admin-theme">
		{@render children()}
	</div>
{:else}
	<!--
		The ground AND the ink.

		:root carries color-scheme: dark, so the UA default text colour is white.
		The dark pages relied on that and never set a colour of their own — which
		meant painting this wrapper white left white ink on a white ground and
		the drop title disappeared. A wrapper that sets a background must set the
		ink that goes with it.

		The ground the header's glass sits on.

		The shell is translucent by design, so it shows whatever is behind it —
		and behind a sticky header is this wrapper, not the page content below
		it. Without an explicit background here it showed `body`, which is
		forest-black, and a light route's header came out muddy olive. Painting
		the wrapper to match the route keeps the glass reading as glass.
	-->
	<div
		class="min-h-svh {surface === 'light'
			? 'bg-paper text-forest'
			: 'bg-forest-black text-stone-100'}"
	>
		<!-- The experience opens on a dark hero: start the header dark, so it
		     does not flash light before it measures what is behind it. -->
		<SiteHeader
			surface={isExperience ? 'dark' : surface}
			position={isExperience ? 'fixed' : 'sticky'}
		/>
		{@render children()}
	</div>

	<SiteFooter policies={data.footerPolicies ?? []} />
{/if}

<!-- One footer for every route, the landing lockup included. -->
{#if isHome}
	<SiteFooter policies={data.footerPolicies ?? []} />
{/if}

<style>
	/**
	 * Admin components use the shared brand tokens. Remapping those tokens at
	 * the route boundary gives the complete workspace a high-contrast light
	 * surface while leaving every storefront route unchanged.
	 */
	.admin-theme {
		--color-forest-black: #ffffff;
		--color-forest: #ffffff;
		--color-paper: #173925;
		--color-cream: #173925;
		--color-stone-100: #14251a;
		--color-stone-200: #21382a;
		--color-stone-300: #385242;
		--color-stone-400: #607066;
		--color-stone-500: #87948c;
		--color-stone-700: #cbd2cd;
		--color-white: #173925;
		--color-black: #ffffff;
		--color-gold: #7d5d13;
		--color-alert-light: #9f342d;

		min-height: 100svh;
		background: #ffffff;
		color: #21382a;
		color-scheme: light;
	}
</style>
