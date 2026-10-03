<script lang="ts">
	/**
	 * §09 — the size selector. One variant axis, XS–XL.
	 *
	 * Nothing is pre-selected: a default size is how people end up with the
	 * wrong one. The page asks for a choice on add instead.
	 *
	 * §06 — sold-out sizes stay visible and greyed, never hidden. They remain
	 * pickable so the page can offer notify-me for that exact size, and their
	 * accessible name says "sold out" so the strike-through is not the only cue.
	 *
	 * Real radio inputs, visually hidden rather than laid over the label, so the
	 * whole tile is the click target and arrow keys move through the group.
	 *
	 * `selectable={false}` renders a plain availability list instead, for
	 * surfaces that preview sizes without choosing one.
	 */
	import type { SizeOffer } from './types';

	let {
		offers,
		name = 'variantId',
		idPrefix = 'size',
		surface = 'dark',
		selectable = true,
		selected = $bindable(''),
		invalid = false,
		describedBy = undefined
	}: {
		offers: readonly SizeOffer[];
		name?: string;
		idPrefix?: string;
		surface?: 'dark' | 'light';
		selectable?: boolean;
		/** The chosen variant id; '' until the shopper picks one. */
		selected?: string;
		/** Marks the group as needing a choice, after a submit without one. */
		invalid?: boolean;
		describedBy?: string;
	} = $props();

	let light = $derived(surface === 'light');
	let tileOpen = $derived(
		light
			? 'border-forest/45 text-forest hover:border-forest peer-checked:border-forest peer-checked:bg-forest peer-checked:text-paper'
			: 'border-white/30 text-stone-100 hover:border-white peer-checked:border-paper peer-checked:bg-paper peer-checked:text-forest'
	);
	let tileGone = $derived(
		light
			? 'border-forest/15 text-forest/45 hover:border-forest/40 peer-checked:border-forest peer-checked:text-forest'
			: 'border-white/10 text-stone-500 hover:border-white/40 peer-checked:border-white peer-checked:text-stone-100'
	);
	let ring = $derived(light ? 'peer-focus-visible:outline-forest' : 'peer-focus-visible:outline-white');
	let invalidRing = $derived(invalid ? (light ? 'border-alert' : 'border-alert-light') : '');
</script>

{#if selectable}
	<div
		class="grid grid-cols-5 gap-2"
		role="radiogroup"
		aria-label="Size"
		aria-invalid={invalid || undefined}
		aria-describedby={describedBy}
	>
		{#each offers as offer (offer.variantId)}
			<div>
				<input
					class="peer sr-only"
					type="radio"
					{name}
					id="{idPrefix}-{offer.variantId}"
					value={offer.variantId}
					bind:group={selected}
					aria-label={offer.soldOut ? `${offer.size}, sold out` : offer.size}
				/>
				<label
					for="{idPrefix}-{offer.variantId}"
					class="relative flex h-12 cursor-pointer items-center justify-center border text-[13px] font-medium tracking-[0.14em] uppercase transition select-none peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 {ring} {offer.soldOut
						? tileGone
						: tileOpen} {invalidRing}"
				>
					<span class={offer.soldOut ? 'line-through decoration-1' : ''} aria-hidden="true"
						>{offer.size}</span
					>
				</label>
			</div>
		{/each}
	</div>
{:else}
	<ul class="m-0 grid list-none grid-cols-5 gap-2 p-0" aria-label="Sizes">
		{#each offers as offer (offer.variantId)}
			<li
				class="flex h-12 items-center justify-center border text-[13px] font-medium tracking-[0.14em] uppercase {offer.soldOut
					? light
						? 'border-forest/12 text-forest/40'
						: 'border-white/10 text-stone-500'
					: light
						? 'border-forest/30 text-forest/80'
						: 'border-white/25 text-stone-200'}"
			>
				<span class={offer.soldOut ? 'line-through decoration-1' : ''}>{offer.size}</span>
				{#if offer.soldOut}<span class="sr-only">, sold out</span>{/if}
			</li>
		{/each}
	</ul>
{/if}
