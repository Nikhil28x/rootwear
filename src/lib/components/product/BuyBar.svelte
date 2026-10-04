<script lang="ts">
	/**
	 * The buy bar — price, sizes and the one action, fixed to the bottom of the
	 * product experience so the page above it can be pictures.
	 *
	 * Desktop: one slim bar, sizes inline. Phone: price and a button; the sizes
	 * open in a panel above it, the way a bottom sheet does.
	 *
	 * Add-to-cart posts to the cart route's own action, so it works without
	 * JavaScript (the action redirects to /cart). With it, the add stays here:
	 * the bar confirms, and the header count refreshes. The price is never in
	 * the post — the cart re-resolves it (§04).
	 *
	 * A sold-out size, or any size while the drop is closed, turns the action
	 * into notify-me for that exact size (§06).
	 *
	 * The drop's pre-order mode (set in admin) decides the action: on, it reads
	 * "Pre-order" and hands the chosen size to the signup (no payment); off, it
	 * reads "Buy now", adds to the cart and goes straight to checkout.
	 */
	import { enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { onMount } from 'svelte';
	import SizeSelector from '$lib/components/drop/SizeSelector.svelte';
	import NotifyMeForm from '$lib/components/drop/NotifyMeForm.svelte';
	import type { SizeOffer } from '$lib/components/drop/types';
	import { FIT_DISCLAIMER } from '$lib/drop/sizes';

	let {
		offers,
		productName,
		price,
		priceNote = '',
		thumb = null,
		dropSlug,
		onSale,
		notifyOpen,
		finished,
		preorderMode = false,
		onPreorder = undefined,
		form = null
	}: {
		offers: readonly SizeOffer[];
		productName: string;
		/** Already formatted, e.g. ₹4,100. */
		price: string;
		priceNote?: string;
		thumb?: { url: string; alt: string } | null;
		dropSlug: string;
		onSale: boolean;
		notifyOpen: boolean;
		finished: boolean;
		/** The drop takes pre-order signups instead of selling. */
		preorderMode?: boolean;
		/** Opens the pre-order signup for the chosen variant. */
		onPreorder?: (variantId: string) => void;
		form?: unknown;
	} = $props();

	let selected = $state('');
	let selectedOffer = $derived(offers.find((offer) => offer.variantId === selected) ?? null);
	let everythingGone = $derived(offers.every((offer) => offer.soldOut));
	let canPick = $derived(preorderMode || onSale || notifyOpen);

	/** The phone panel; desktop shows sizes inline and ignores this. */
	let panelOpen = $state(false);
	let sizeMissing = $state(false);
	let adding = $state(false);
	let problem = $state('');
	/** Tucked away while the footer is on screen, so it never covers it. */
	let tucked = $state(false);

	// A pre-order is a signup, not stock: every size takes one, so nothing turns into notify-me.
	let notifyFor = $derived(
		!preorderMode && selectedOffer && (selectedOffer.soldOut || (!onSale && notifyOpen))
			? selectedOffer
			: null
	);

	$effect(() => {
		void selected;
		sizeMissing = false;
		problem = '';
	});

	let actionLabel = $derived.by(() => {
		if (!canPick) return finished ? 'Sold out' : 'Coming soon';
		if (notifyFor) return 'Notify me';
		if (!preorderMode && onSale && everythingGone) return 'Sold out';
		if (adding) return 'One moment…';
		const verb = preorderMode ? 'Pre-order' : 'Buy now';
		return selectedOffer ? verb : 'Select size';
	});

	let sizeStatus = $derived.by(() => {
		if (sizeMissing) return { tone: 'alert', text: 'Please select a size.' };
		if (preorderMode) return { tone: 'muted', text: FIT_DISCLAIMER };
		if (selectedOffer?.soldOut) return { tone: 'muted', text: `${selectedOffer.size} is sold out.` };
		if (selectedOffer && onSale && selectedOffer.remaining <= 3)
			return { tone: 'gold', text: `Only ${selectedOffer.remaining} left in ${selectedOffer.size}.` };
		return { tone: 'muted', text: FIT_DISCLAIMER };
	});

	const addToCart: SubmitFunction = ({ cancel }) => {
		if (notifyFor) {
			// Notify-me lives in the panel; the main button just opens it.
			panelOpen = true;
			cancel();
			return;
		}
		if (!selectedOffer) {
			// On a phone the first tap just opens the sizes; the reminder is for
			// a second tap, or for desktop where the sizes are already in view.
			const inline = window.matchMedia('(min-width: 900px)').matches;
			sizeMissing = inline || panelOpen;
			panelOpen = true;
			cancel();
			return;
		}
		if (preorderMode) {
			// The signup lives in the page's dialog; it takes the chosen size.
			onPreorder?.(selectedOffer.variantId);
			panelOpen = false;
			cancel();
			return;
		}
		adding = true;
		problem = '';

		return async ({ result }) => {
			if (result.type === 'redirect') {
				// Buy now: in the cart, straight on to checkout.
				await goto('/checkout/information', { invalidateAll: true });
				adding = false;
			} else if (result.type === 'failure') {
				adding = false;
				const message = (result.data as { problem?: string } | undefined)?.problem;
				problem = message ?? 'We could not add that. Please try again.';
				await invalidateAll();
			} else {
				adding = false;
				problem = 'Something went wrong. Please try again.';
			}
		};
	};

	function openSizeGuide(event: MouseEvent) {
		const guide = document.getElementById('size-guide');
		if (!guide) return;
		event.preventDefault();
		if (guide instanceof HTMLDetailsElement) guide.open = true;
		// The guide measures whatever size is picked here.
		if (selectedOffer) {
			window.dispatchEvent(new CustomEvent('rootwear:size-guide', { detail: selectedOffer.size }));
		}
		guide.scrollIntoView({ behavior: 'smooth', block: 'start' });
		guide.focus({ preventScroll: true });
		panelOpen = false;
	}

	onMount(() => {
		const footer = document.querySelector('footer');
		if (!footer) return;
		const observer = new IntersectionObserver(([entry]) => (tucked = entry.isIntersecting), {
			rootMargin: '0px 0px -40px 0px'
		});
		observer.observe(footer);
		return () => observer.disconnect();
	});

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') panelOpen = false;
	}
</script>

<svelte:window onkeydown={onKeydown} />

<div class="buybar" class:buybar--tucked={tucked} aria-label="Buy {productName}" role="region">
	<div class="buybar__card">
		<!-- Panel: sizes on a phone, notify-me, and the result of an add. -->
		{#if notifyFor && panelOpen}
			<div class="buybar__panel buybar__panel--form">
				<NotifyMeForm
					{dropSlug}
					variantId={notifyFor.variantId}
					size={notifyFor.size}
					{form}
					source="product_page"
					surface="dark"
					open
				/>
			</div>
		{/if}

		{#if problem}
			<p class="buybar__problem" role="alert">{problem}</p>
		{/if}

		<form
			method="POST"
			action="/cart?/add"
			class="buybar__row"
			class:buybar__row--open={panelOpen}
			use:enhance={addToCart}
			novalidate
		>
			<input type="hidden" name="quantity" value="1" />

			<div class="buybar__id">
				{#if thumb}
					<img class="buybar__thumb" src={thumb.url} alt="" width="44" height="55" />
				{/if}
				<div class="buybar__name">
					<span class="buybar__title">{productName}</span>
					<span class="buybar__price">
						{price}{#if priceNote}<span class="buybar__note"> · {priceNote}</span>{/if}
					</span>
				</div>
			</div>

			{#if canPick}
				<div class="buybar__sizes">
					<div class="buybar__sizes-head">
						<span id="buybar-size-label">Size{#if selectedOffer}: {selectedOffer.size}{/if}</span>
						<a href="#size-guide" onclick={openSizeGuide}>Size guide</a>
					</div>
					<SizeSelector
						{offers}
						idPrefix="buy"
						surface="dark"
						bind:selected
						invalid={sizeMissing}
						describedBy="buybar-size-status"
					/>
					<p
						id="buybar-size-status"
						class="buybar__status buybar__status--{sizeStatus.tone}"
						aria-live="polite"
					>
						{sizeStatus.text}
					</p>
				</div>
			{/if}

			<div class="buybar__action">
				{#if canPick && !panelOpen && selectedOffer}
					<button
						type="button"
						class="buybar__size-toggle"
						onclick={() => (panelOpen = true)}
						aria-expanded={panelOpen}
					>
						{selectedOffer ? `Size ${selectedOffer.size}` : 'Size'}
					</button>
				{/if}
				<button
					type="submit"
					class="buybar__cta"
					disabled={!canPick || adding || (!preorderMode && onSale && everythingGone && !notifyFor)}
				>
					{actionLabel}
				</button>
				{#if panelOpen}
					<button
						type="button"
						class="buybar__close"
						onclick={() => (panelOpen = false)}
						aria-label="Close sizes">×</button
					>
				{/if}
			</div>
		</form>
	</div>
</div>

<style>
	/* The bar: forest-black glass, paper ink, square edges like the rest of the brand. */
	.buybar {
		position: fixed;
		inset-inline: 0;
		bottom: 0;
		z-index: 40;
		padding: 0 12px calc(12px + env(safe-area-inset-bottom, 0px));
		pointer-events: none;
		transition: transform 0.45s cubic-bezier(0.2, 0.7, 0.2, 1);
	}
	.buybar--tucked {
		transform: translateY(calc(100% + 24px));
	}
	/* The floating size note sits above the bar; it must leave with it. */
	.buybar--tucked .buybar__status {
		opacity: 0;
		visibility: hidden;
	}
	.buybar__card {
		/* Its notify-me form sits on the dark card: keep autofill dark too. */
		--field-bg: #141a14;
		--field-ink: #f3efe6;
		/* Arrives last, once the hero has landed. */
		animation: bar-in 0.8s cubic-bezier(0.2, 0.7, 0.2, 1) 1.6s both;
		pointer-events: auto;
		max-width: 72rem;
		margin-inline: auto;
		background: color-mix(in oklab, var(--color-forest-black) 88%, transparent);
		backdrop-filter: blur(18px) saturate(1.2);
		-webkit-backdrop-filter: blur(18px) saturate(1.2);
		color: #f3efe6;
		border: 1px solid rgb(255 255 255 / 0.1);
		box-shadow: 0 18px 50px -20px rgb(0 0 0 / 0.55);
	}

	.buybar__row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: 12px;
		padding: 10px 10px 10px 12px;
	}
	.buybar__id {
		display: flex;
		align-items: center;
		gap: 12px;
		min-width: 0;
	}
	.buybar__thumb {
		display: none;
		width: 44px;
		height: 55px;
		object-fit: cover;
		background: rgb(255 255 255 / 0.06);
		flex: none;
	}
	.buybar__name {
		display: flex;
		flex-direction: column;
		min-width: 0;
		line-height: 1.25;
	}
	.buybar__title {
		font-family: var(--font-display);
		font-size: 17px;
		letter-spacing: -0.01em;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.buybar__price {
		font-size: 13px;
		color: rgb(243 239 230 / 0.75);
		font-variant-numeric: tabular-nums;
	}
	.buybar__note {
		color: var(--color-gold);
	}

	/* Sizes: hidden on a phone until the panel opens. */
	.buybar__sizes {
		display: none;
		grid-column: 1 / -1;
		flex-direction: column;
		gap: 10px;
		padding-top: 6px;
	}
	.buybar__row--open .buybar__sizes {
		display: flex;
		order: -1;
	}
	.buybar__row--open .buybar__id {
		display: none;
	}
	.buybar__row--open .buybar__action {
		grid-column: 1 / -1;
	}
	.buybar__sizes-head {
		display: flex;
		justify-content: space-between;
		font-size: 12px;
		color: rgb(243 239 230 / 0.8);
	}
	.buybar__sizes-head a {
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.buybar__status {
		font-size: 12.5px;
		min-height: 1.2em;
		margin: 0;
	}
	.buybar__status--muted {
		color: rgb(243 239 230 / 0.65);
	}
	.buybar__status--gold {
		color: var(--color-gold);
	}
	.buybar__status--alert {
		color: var(--color-alert-light);
	}

	.buybar__action {
		display: flex;
		align-items: stretch;
		gap: 8px;
	}
	.buybar__cta,
	.buybar__size-toggle,
	.buybar__close {
		height: 48px;
		font-size: 11px;
		font-weight: 500;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		transition:
			background-color 0.2s,
			color 0.2s,
			border-color 0.2s;
	}
	.buybar__cta {
		flex: 1;
		min-width: 9.5rem;
		padding-inline: 22px;
		background: #f3efe6;
		color: var(--color-forest-black);
	}
	.buybar__cta:hover:not(:disabled) {
		background: var(--color-gold);
	}
	.buybar__cta:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.buybar__size-toggle {
		padding-inline: 16px;
		border: 1px solid rgb(255 255 255 / 0.3);
		color: #f3efe6;
	}
	.buybar__close {
		width: 48px;
		border: 1px solid rgb(255 255 255 / 0.3);
		font-size: 22px;
		letter-spacing: 0;
		color: #f3efe6;
	}
	.buybar :global(:focus-visible) {
		outline: 1px solid #f3efe6;
		outline-offset: 3px;
	}

	.buybar__panel {
		padding: 16px 16px 4px;
		border-bottom: 1px solid rgb(255 255 255 / 0.08);
	}
	.buybar__panel--form {
		max-height: min(60svh, 30rem);
		overflow-y: auto;
	}
	.buybar__problem {
		margin: 0;
		padding: 10px 16px;
		font-size: 13px;
		color: var(--color-alert-light);
		border-bottom: 1px solid rgb(255 255 255 / 0.08);
	}

	@keyframes bar-in {
		from {
			opacity: 0;
			transform: translateY(120%);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.buybar__card {
			animation: none;
		}
	}

	/* Desktop: everything on one line, sizes always visible. */
	@media (min-width: 900px) {
		.buybar {
			padding-bottom: calc(18px + env(safe-area-inset-bottom, 0px));
		}
		.buybar__row,
		.buybar__row--open {
			grid-template-columns: minmax(0, 1fr) minmax(300px, 340px) auto;
			gap: 24px;
			padding: 10px 10px 10px 12px;
		}
		.buybar__sizes,
		.buybar__row--open .buybar__sizes {
			display: flex;
			grid-column: auto;
			order: 0;
			padding-top: 0;
			gap: 6px;
		}
		.buybar__row--open .buybar__id {
			display: flex;
		}
		.buybar__row--open .buybar__action {
			grid-column: auto;
		}
		.buybar__sizes {
			position: relative;
		}
		.buybar__sizes-head {
			display: none;
		}
		/* Only a message worth reading floats above the bar on desktop. */
		.buybar__status {
			position: absolute;
			bottom: calc(100% + 22px);
			left: 0;
			white-space: nowrap;
			padding: 7px 12px;
			background: var(--color-forest-black);
			border: 1px solid rgb(255 255 255 / 0.1);
		}
		.buybar__status--muted {
			display: none;
		}
		.buybar__size-toggle,
		.buybar__close {
			display: none;
		}
		.buybar__sizes :global(label) {
			height: 40px;
		}
		.buybar__thumb {
			display: block;
		}
	}
</style>
