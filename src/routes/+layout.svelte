<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
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

	/** Routes that sit on cream rather than forest-black. */
	const LIGHT_ROUTES = [
		'/policies',
		'/contact',
		'/know-your-roots',
		'/account',
		'/cart',
		'/checkout',
		'/drops',
		'/impact'
	];
	let surface = $derived(
		LIGHT_ROUTES.some((r) => page.route.id?.startsWith(r)) ? 'light' : 'dark'
	) as 'light' | 'dark';
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="theme-color" content={BRAND_THEME_COLOR} />
</svelte:head>

{#if isHome}
	<!-- The homepage renders its own SiteHeader (anchored hero, drop CTA, fixed). -->
	{@render children()}
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
		<SiteHeader {surface} />
		{@render children()}
	</div>

	<SiteFooter policies={data.footerPolicies ?? []} />
{/if}

<!-- One footer for every route, the landing lockup included. -->
{#if isHome}
	<SiteFooter policies={data.footerPolicies ?? []} />
{/if}
