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
	 * The homepage keeps its bespoke hero header, which cross-fades between the
	 * dark and cream sections as you scroll. Every other route uses the shared
	 * shell.
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

{#if !isHome}
	<SiteHeader {surface} />
{/if}

{@render children()}

{#if !isHome}
	<SiteFooter policies={data.footerPolicies ?? []} />
{/if}
