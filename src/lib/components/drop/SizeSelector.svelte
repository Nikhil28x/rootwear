<script lang="ts">
	/**
	 * §09 — the size selector. One variant axis, XS–XL, and nothing else: there
	 * is deliberately no colour axis in this build.
	 *
	 * §06 — "Sold-out sizes are GREYED AND STILL VISIBLE, never hidden. The
	 * scarcity is the point." So a gone size stays in the grid, keeps its
	 * letter, and carries the words "sold out" as text — a strike-through and a
	 * dimmer grey alone would be a colour-only signal.
	 *
	 * Real radio inputs, so the whole thing submits with the browser alone and
	 * arrow keys move through the group for free.
	 */
	import { FIT_DISCLAIMER } from '$lib/drop/sizes';
	import { RETURNS_SHORT } from '$lib/content/returns';
	import type { SizeOffer } from './types';

	let {
		offers,
		name = 'variantId',
		idPrefix = 'size',
		surface = 'dark',
		/** False outside LIVE/PARTIAL/RE_DROP — the grid still shows, nothing is pickable. */
		selectable = true
	}: {
		offers: readonly SizeOffer[];
		name?: string;
		idPrefix?: string;
		surface?: 'dark' | 'light';
		selectable?: boolean;
	} = $props();

	/** The first size a visitor can actually pick, so the group starts valid. */
	let firstOpen = $derived(offers.find((offer) => !offer.soldOut)?.variantId ?? '');

	let muted = $derived(surface === 'light' ? 'text-forest/70' : 'text-stone-400');
	let faint = $derived(surface === 'light' ? 'text-forest/70' : 'text-stone-400');

	let open = $derived(
		surface === 'light'
			? 'border-forest/60 text-forest peer-checked:bg-forest peer-checked:text-paper peer-hover:border-forest'
			: 'border-white/30 text-stone-100 peer-checked:bg-paper peer-checked:text-forest peer-hover:border-white'
	);
	let gone = $derived(
		surface === 'light' ? 'border-forest/10 text-forest/60' : 'border-white/10 text-stone-400'
	);
</script>

<fieldset class="flex flex-col gap-4 border-0 p-0">
	<legend class="text-[11px] tracking-[0.28em] uppercase {faint} font-medium">Size</legend>

	<div class="grid grid-cols-5 gap-2">
		{#each offers as offer (offer.variantId)}
			<div class="relative">
				<input
					class="peer absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
					type="radio"
					{name}
					id="{idPrefix}-{offer.variantId}"
					value={offer.variantId}
					disabled={offer.soldOut || !selectable}
					checked={selectable && offer.variantId === firstOpen}
					required
				/>
				<label
					for="{idPrefix}-{offer.variantId}"
					class="flex h-16 flex-col items-center justify-center gap-1 border text-[13px] tracking-[0.18em] uppercase transition select-none peer-focus-visible:outline peer-focus-visible:outline-1 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-current {offer.soldOut
						? gone
						: open} font-medium"
				>
					<span class={offer.soldOut ? 'line-through' : ''}>{offer.size}</span>
					{#if offer.soldOut}
						<span class="text-[8px] tracking-[0.2em]">Sold out</span>
					{:else if offer.remaining <= 3}
						<span class="text-[8px] tracking-[0.2em] tabular-nums">{offer.remaining} left</span>
					{/if}
				</label>
			</div>
		{/each}
	</div>

	<!-- §09: the fit disclaimer is MANDATORY wherever a size is shown. -->
	<p class="text-[13px] leading-relaxed {muted}">{FIT_DISCLAIMER}</p>
	<!-- §11: the same returns wording as checkout, the email and the policy page. -->
	<p class="text-[11px] tracking-[0.2em] uppercase {faint} font-medium">{RETURNS_SHORT}</p>
</fieldset>
