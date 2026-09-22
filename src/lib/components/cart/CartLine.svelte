<script lang="ts">
	/**
	 * One cart line. §03 template 06.
	 *
	 * Everything on screen was resolved server-side a moment ago: the price
	 * (app.cart_lines has no price column — see server/cart/types.ts), the hold,
	 * and how many units are actually still available. The component decides
	 * nothing; it renders what the server priced.
	 *
	 * Both controls are real form posts, so the cart works with JavaScript off.
	 * `use:enhance` only removes the navigation.
	 */
	import { enhance } from '$app/forms';
	import { formatInr } from '$lib/money';
	import { FIT_DISCLAIMER } from '$lib/drop/sizes';
	import type { PricedCartLine } from '$lib/server/cart/types';

	let {
		line,
		launchInstant,
		busy = false
	}: {
		line: PricedCartLine;
		/** §08: the instant a pre-order line dispatches after. */
		launchInstant: number;
		busy?: boolean;
	} = $props();

	const dispatchDate = new Intl.DateTimeFormat('en-GB', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		timeZone: 'Asia/Kolkata'
	});

	let href = $derived(`/drops/${line.dropSlug}/${line.productSlug}`);
	/** Never offer more than the server says is there. */
	let maxQuantity = $derived(Math.max(1, line.availableNow));
</script>

<li class="grid grid-cols-[6rem_1fr] gap-6 border-b border-forest/15 py-8 sm:grid-cols-[9rem_1fr]">
	<a {href} class="block bg-forest/5" aria-hidden="true" tabindex="-1">
		{#if line.image}
			<img src={line.image} alt="" class="aspect-[4/5] w-full object-cover" loading="lazy" />
		{/if}
	</a>

	<div class="flex flex-col gap-4">
		<div class="flex flex-wrap items-start justify-between gap-4">
			<div class="flex flex-col gap-2">
				<p class="text-[10px] tracking-[0.28em] text-forest/50 uppercase">{line.dropName}</p>
				<h2 class="display text-2xl leading-[0.95] tracking-[-0.03em] text-forest">
					<a {href} class="underline-offset-4 hover:underline">{line.productName}</a>
				</h2>
				<p class="text-[10px] tracking-[0.2em] text-forest/60 uppercase">
					Size {line.size} · {line.sku}
				</p>
			</div>

			<div class="text-right">
				<p class="text-sm text-forest tabular-nums">{formatInr(line.lineTotal)}</p>
				{#if line.quantity > 1}
					<p class="mt-1 text-[10px] tracking-[0.2em] text-forest/50 uppercase">
						{formatInr(line.unitPrice)} each
					</p>
				{/if}
			</div>
		</div>

		<!-- §09: the fit disclaimer is mandatory wherever a size is shown. -->
		<p class="text-xs leading-relaxed text-forest/60">{FIT_DISCLAIMER}</p>

		{#if line.isPreOrder}
			<!-- §07/§08: a pre-order line states what is actually known — the drop's
			     own instant, and that the hand number lands on payment. -->
			<p class="border-l-2 border-gold pl-4 text-xs leading-relaxed text-forest/75">
				<span class="block text-[10px] tracking-[0.28em] text-forest uppercase">Pre-order</span>
				<span class="mt-2 block">
					Made for the drop. Dispatch follows the drop opening on
					{dispatchDate.format(launchInstant)}, and your hand number is allocated when your payment
					confirms.
				</span>
			</p>
		{/if}

		{#if line.overSubscribed}
			<!-- §06: stock is finite and the scarcity is the point. Said in words,
			     not signalled by colour alone. -->
			<p class="border-l-2 border-alert pl-4 text-xs leading-relaxed text-alert">
				Only {line.availableNow}
				{line.availableNow === 1 ? 'piece is' : 'pieces are'} still available in this size. Reduce the
				quantity to continue.
			</p>
		{/if}

		<div class="flex flex-wrap items-end gap-6">
			<form method="POST" action="/cart?/updateQuantity" use:enhance class="flex items-end gap-3">
				<input type="hidden" name="variantId" value={line.variantId} />
				<div class="flex flex-col gap-2">
					<label
						for="qty-{line.variantId}"
						class="text-[10px] tracking-[0.2em] text-forest/60 uppercase"
					>
						Quantity
					</label>
					<input
						id="qty-{line.variantId}"
						name="quantity"
						type="number"
						inputmode="numeric"
						min="1"
						max={maxQuantity}
						value={line.quantity}
						class="w-20 border-b border-forest/25 bg-transparent px-0 py-2 text-sm text-forest tabular-nums outline-none focus:border-forest"
					/>
				</div>
				<button
					type="submit"
					disabled={busy}
					class="border border-forest/30 px-4 py-2 text-[10px] tracking-[0.2em] text-forest uppercase transition hover:bg-forest hover:text-cream disabled:opacity-40"
				>
					Update
				</button>
			</form>

			<form method="POST" action="/cart?/remove" use:enhance>
				<input type="hidden" name="variantId" value={line.variantId} />
				<button
					type="submit"
					disabled={busy}
					class="pb-2 text-[10px] tracking-[0.2em] text-forest/60 uppercase underline-offset-4 transition hover:text-forest hover:underline disabled:opacity-40"
				>
					Remove
				</button>
			</form>
		</div>
	</div>
</li>
