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
	import { srcsetOf } from '$lib/media/responsive';
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

<li class="line">
	<a {href} class="line__thumb" aria-hidden="true" tabindex="-1">
		{#if line.image}
			<img
				src={line.image}
				srcset={srcsetOf(line.image)}
				sizes="120px"
				alt=""
				loading="lazy"
				decoding="async"
			/>
		{/if}
	</a>

	<div class="line__body">
		<div class="line__top">
			<div class="line__id">
				<h2 class="line__name"><a {href}>{line.productName}</a></h2>
				<p class="line__meta">{line.dropName} · Size {line.size} · {line.sku}</p>
			</div>

			<div class="line__price">
				<p>{formatInr(line.lineTotal)}</p>
				{#if line.quantity > 1}
					<p class="line__each">{formatInr(line.unitPrice)} each</p>
				{/if}
			</div>
		</div>

		<!-- §09: the fit disclaimer is mandatory wherever a size is shown. -->
		<p class="line__fine">{FIT_DISCLAIMER}</p>

		{#if line.isPreOrder}
			<!-- §07/§08: a pre-order line states what is actually known — the drop's
			     own instant, and that the hand number lands on payment. -->
			<p class="line__note">
				<b>Pre-order</b>
				Ships after the drop opens on {dispatchDate.format(launchInstant)}.
			</p>
		{/if}

		{#if line.overSubscribed}
			<!-- §06: stock is finite and the scarcity is the point. Said in words,
			     not signalled by colour alone. -->
			<p class="line__alert">
				Only {line.availableNow}
				{line.availableNow === 1 ? 'piece is' : 'pieces are'} left in this size. Reduce the quantity to
				continue.
			</p>
		{/if}

		<div class="line__controls">
			<form method="POST" action="/cart?/updateQuantity" use:enhance class="line__qty">
				<input type="hidden" name="variantId" value={line.variantId} />
				<label for="qty-{line.variantId}">Quantity</label>
				<div class="line__qty-row">
					<input
						id="qty-{line.variantId}"
						name="quantity"
						type="number"
						inputmode="numeric"
						min="1"
						max={maxQuantity}
						value={line.quantity}
					/>
					<button type="submit" disabled={busy}>Update</button>
				</div>
			</form>

			<form method="POST" action="/cart?/remove" use:enhance>
				<input type="hidden" name="variantId" value={line.variantId} />
				<button type="submit" disabled={busy} class="line__remove">Remove</button>
			</form>
		</div>
	</div>
</li>

<style>
	.line {
		--ink: var(--color-forest-black);
		--soft: rgb(11 15 11 / 0.62);
		display: grid;
		grid-template-columns: clamp(96px, 12vw, 152px) minmax(0, 1fr);
		gap: clamp(16px, 2.4vw, 32px);
		padding: clamp(20px, 2.4vw, 28px) 0;
		border-bottom: 1px solid rgb(11 15 11 / 0.14);
	}
	.line__thumb {
		display: block;
		align-self: start;
		aspect-ratio: 4 / 5;
		overflow: hidden;
		background: #efeeeb;
	}
	.line__thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: 50% 24%;
		transform: scale(1.06);
	}
	.line__body {
		display: flex;
		flex-direction: column;
		gap: 12px;
		min-width: 0;
	}
	.line__top {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 16px;
	}
	.line__id {
		min-width: 0;
	}
	.line__name {
		margin: 0;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: clamp(1.5rem, 2.2vw, 2rem);
		line-height: 1.05;
		letter-spacing: -0.02em;
		color: var(--ink);
	}
	.line__name a:hover {
		text-decoration: underline;
		text-decoration-thickness: 1px;
		text-underline-offset: 5px;
	}
	.line__meta {
		margin-top: 6px;
		font-size: 13px;
		color: var(--soft);
	}
	.line__price {
		flex: none;
		text-align: right;
		font-size: 15px;
		font-variant-numeric: tabular-nums;
		color: var(--ink);
	}
	.line__each {
		margin-top: 2px;
		font-size: 13px;
		color: var(--soft);
	}
	.line__fine {
		max-width: 60ch;
		font-size: 13px;
		line-height: 1.6;
		color: var(--soft);
	}
	.line__note {
		padding-left: 14px;
		border-left: 2px solid var(--ink);
		font-size: 13px;
		line-height: 1.6;
		color: var(--soft);
	}
	.line__note b {
		display: block;
		font-weight: 500;
		color: var(--ink);
	}
	.line__alert {
		padding: 10px 14px;
		border-left: 2px solid var(--color-alert);
		background: rgb(157 69 38 / 0.05);
		font-size: 13px;
		line-height: 1.6;
		color: var(--color-alert);
	}
	.line__controls {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 12px 24px;
		margin-top: 4px;
	}
	.line__qty {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.line__qty label {
		font-size: 13px;
		color: var(--soft);
	}
	.line__qty-row {
		display: flex;
	}
	.line__qty input {
		width: 72px;
		height: 44px;
		padding: 0 12px;
		border: 1px solid rgb(11 15 11 / 0.26);
		border-right: 0;
		border-radius: 0;
		background: #ffffff;
		color: var(--ink);
		font: inherit;
		font-size: 16px;
		font-variant-numeric: tabular-nums;
		outline: none;
	}
	.line__qty input:focus {
		border-color: var(--ink);
	}
	.line__qty button {
		height: 44px;
		padding-inline: 16px;
		border: 1px solid var(--ink);
		color: var(--ink);
		font-size: 11px;
		font-weight: 500;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		transition:
			background-color 0.25s,
			color 0.25s;
	}
	.line__qty button:hover {
		background: var(--ink);
		color: #f6f4ef;
	}
	.line__remove {
		min-height: 44px;
		font-size: 13px;
		color: var(--soft);
		text-decoration: underline;
		text-underline-offset: 4px;
	}
	.line__remove:hover {
		color: var(--ink);
	}
	.line button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	@media (max-width: 560px) {
		.line__top {
			flex-direction: column;
			gap: 6px;
		}
		.line__price {
			text-align: left;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.line__qty button {
			transition: none;
		}
	}
</style>
