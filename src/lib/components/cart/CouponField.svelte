<script lang="ts">
	/**
	 * §10 — "Field present at cart. Validation SERVER-SIDE; a coupon must NEVER
	 * be applicable to a deposit or a balance payment."
	 *
	 * The client sends a CODE and receives an AMOUNT. There is no prop, no
	 * hidden input and no code path here through which a discount could be set,
	 * which is the point: app.apply_coupon() decides, and this component only
	 * shows what it decided.
	 */
	import { enhance } from '$app/forms';
	import { formatInr } from '$lib/money';
	import { COUPON_MESSAGE } from '$lib/checkout/messages';
	import type { Paise } from '$lib/money';
	import type { CouponStatus } from '$lib/server/cart/types';

	let {
		appliedCode = null,
		discount,
		problem = null,
		status = null,
		busy = false
	}: {
		appliedCode?: string | null;
		discount: Paise;
		/** A code that stopped validating on a later read — said, not swallowed. */
		problem?: CouponStatus | null;
		/** The outcome of the submission that just happened, if any. */
		status?: CouponStatus | null;
		busy?: boolean;
	} = $props();

	let applied = $derived(Boolean(appliedCode) && !problem);
	let message = $derived(
		problem ? COUPON_MESSAGE[problem] : status && status !== 'ok' ? COUPON_MESSAGE[status] : ''
	);
</script>

<section class="coupon" aria-labelledby="coupon-heading">
	<h3 id="coupon-heading" class="coupon__head">Discount code</h3>

	{#if applied}
		<div class="coupon__applied">
			<p>
				<span class="coupon__code">{appliedCode}</span>
				<span class="coupon__amount">−{formatInr(discount)}</span>
			</p>
			<form method="POST" action="/cart?/removeCoupon" use:enhance>
				<button type="submit" disabled={busy} class="coupon__remove">Remove</button>
			</form>
		</div>
	{:else}
		<form method="POST" action="/cart?/applyCoupon" use:enhance class="coupon__form">
			<label for="coupon-code" class="sr-only">Discount code</label>
			<input
				id="coupon-code"
				name="code"
				type="text"
				autocomplete="off"
				spellcheck="false"
				placeholder="Enter a code"
				value={appliedCode ?? ''}
				aria-describedby={message ? 'coupon-message' : undefined}
				aria-invalid={message ? 'true' : undefined}
				class="coupon__input"
			/>
			<button type="submit" disabled={busy} class="coupon__apply">Apply</button>
		</form>
	{/if}

	{#if message}
		<!-- Announced, not merely coloured. -->
		<p id="coupon-message" role="status" class="coupon__message">
			{message}
		</p>
	{/if}
</section>

<style>
	.coupon {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.coupon__head {
		margin: 0;
		font-size: 13px;
		font-weight: 400;
		color: rgb(11 15 11 / 0.62);
	}
	.coupon__form {
		display: flex;
	}
	.coupon__input {
		flex: 1;
		min-width: 0;
		height: 50px;
		padding: 0 14px;
		border: 1px solid rgb(11 15 11 / 0.26);
		border-right: 0;
		border-radius: 0;
		background: #ffffff;
		color: var(--color-forest-black);
		font: inherit;
		font-size: 16px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		outline: none;
		transition: border-color 0.2s;
	}
	.coupon__input::placeholder {
		letter-spacing: 0;
		text-transform: none;
		color: rgb(11 15 11 / 0.45);
	}
	.coupon__input:focus {
		border-color: var(--color-forest-black);
	}
	.coupon__input[aria-invalid='true'] {
		border-color: var(--color-alert);
	}
	.coupon__apply {
		flex: none;
		height: 50px;
		padding-inline: 22px;
		border: 1px solid var(--color-forest-black);
		background: transparent;
		color: var(--color-forest-black);
		font-size: 11px;
		font-weight: 500;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		transition:
			background-color 0.25s,
			color 0.25s;
	}
	.coupon__apply:hover {
		background: var(--color-forest-black);
		color: #f6f4ef;
	}
	.coupon__apply:disabled,
	.coupon__remove:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.coupon__applied {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		min-height: 50px;
		padding: 0 14px;
		background: #efeeeb;
	}
	.coupon__applied p {
		display: flex;
		align-items: baseline;
		gap: 12px;
		font-size: 15px;
	}
	.coupon__code {
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.coupon__amount {
		color: rgb(11 15 11 / 0.62);
		font-variant-numeric: tabular-nums;
	}
	.coupon__remove {
		min-height: 44px;
		font-size: 13px;
		color: rgb(11 15 11 / 0.62);
		text-decoration: underline;
		text-underline-offset: 4px;
	}
	.coupon__remove:hover {
		color: var(--color-forest-black);
	}
	.coupon__message {
		font-size: 13px;
		line-height: 1.6;
		color: var(--color-alert);
	}
	@media (prefers-reduced-motion: reduce) {
		.coupon__input,
		.coupon__apply {
			transition: none;
		}
	}
</style>
