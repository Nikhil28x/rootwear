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
	// Created empty and filled by the effect below rather than seeded from
	// `data` at init: reading a prop during setup captures only its first
	// value, so a client-side navigation would leave the badge stale.
	const cart = setCart();
	$effect(() => cart.sync(data.cartLines ?? []));

	/**
	 * The homepage renders SiteHeader itself, because it needs a different
	 * configuration: in-page anchors, a drop CTA, and `fixed` so the hero runs
	 * full bleed beneath it. Same component, different props.
	 */
	let isHome = $derived(page.route.id === '/');

	/** Routes that sit on cream rather than forest-black. */
	const LIGHT_ROUTES = ['/policies', '/contact', '/know-your-roots', '/account', '/cart', '/checkout'];
	let surface = $derived(
		LIGHT_ROUTES.some((r) => page.route.id?.startsWith(r)) ? 'light' : 'dark'
	) as 'light' | 'dark';
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="theme-color" content={BRAND_THEME_COLOR} />
</svelte:head>

{#if isHome}
	{@render children()}
{:else}
	<!--
		The ground the header's glass sits on.

		The shell is translucent by design, so it shows whatever is behind it —
		and behind a sticky header is this wrapper, not the page content below
		it. Without an explicit background here it showed `body`, which is
		forest-black, and a cream route's header came out muddy olive. Painting
		the wrapper to match the route keeps the glass reading as glass.
	-->
	<div class="min-h-svh {surface === 'light' ? 'bg-cream' : 'bg-forest-black'}">
		<SiteHeader {surface} />
		{@render children()}
	</div>

	<SiteFooter policies={data.footerPolicies ?? []} />
{/if}
