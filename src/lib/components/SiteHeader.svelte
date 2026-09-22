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

	$effect(() => {
		let frame = 0;

		const probe = () => {
			frame = 0;
			// Sample just below the header's own vertical centre.
			const y = Math.min(44, window.innerHeight - 1);
			const found = document
				.elementsFromPoint(window.innerWidth / 2, y)
				.find(
					(el) =>
						el instanceof HTMLElement &&
						el.dataset.headerTheme &&
						// The header sits at this point too and carries the attribute it
						// is trying to resolve — skip itself, or it never changes.
						!el.closest('[data-site-header]')
				) as HTMLElement | undefined;
			probed = (found?.dataset.headerTheme as 'dark' | 'light' | undefined) ?? null;
		};

		const schedule = () => {
			if (frame) return;
			frame = requestAnimationFrame(probe);
		};

		probe();
		window.addEventListener('scroll', schedule, { passive: true });
		window.addEventListener('resize', schedule);
		return () => {
			if (frame) cancelAnimationFrame(frame);
			window.removeEventListener('scroll', schedule);
			window.removeEventListener('resize', schedule);
		};
	});

	const nav = [
		{ label: 'Drops', href: '/drops' },
		{ label: 'Know your roots', href: '/know-your-roots' },
		{ label: 'Contact', href: '/contact' }
	];

	let tone = $derived(
		resolved === 'light'
			? { text: 'text-forest', rule: 'border-forest/20', hover: 'hover:text-forest' }
			: { text: 'text-stone-100', rule: 'border-white/20', hover: 'hover:text-white' }
	);
</script>

<header
	data-site-header
	class="{floating ? 'fixed' : 'sticky'} inset-x-0 top-0 z-50 transition-colors duration-300 {tone.text}"
	data-header-theme={resolved}
>
	<div class="mx-auto flex max-w-[1600px] items-center justify-between gap-6 px-5 py-5 sm:px-10 lg:px-14">
		<a href="/" class="wordmark text-lg tracking-[0.2em] uppercase" aria-label="Rootwear home">
			Rootwear
		</a>

		<nav class="hidden items-center gap-9 md:flex" aria-label="Primary">
			{#each nav as item (item.href)}
				<a
					class="text-[10px] tracking-[0.2em] uppercase opacity-70 transition hover:opacity-100 {tone.hover}"
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
			class="border-t {tone.rule} bg-forest-black/95 px-5 py-6 backdrop-blur-xl md:hidden"
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

<svelte:window onkeydown={(e) => e.key === 'Escape' && (menuOpen = false)} />
