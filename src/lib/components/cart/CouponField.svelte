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

<section class="border-t border-forest/15 py-6" aria-labelledby="coupon-heading">
	<h3 id="coupon-heading" class="text-[11px] tracking-[0.28em] text-forest/75 uppercase font-medium">
		Discount code
	</h3>

	{#if applied}
		<div class="mt-4 flex flex-wrap items-center justify-between gap-4">
			<p class="text-[15px] text-forest">
				<span class="tracking-[0.18em] uppercase">{appliedCode}</span>
				<span class="ml-3 text-forest/70 tabular-nums">−{formatInr(discount)}</span>
			</p>
			<form method="POST" action="/cart?/removeCoupon" use:enhance>
				<button
					type="submit"
					disabled={busy}
					class="text-[11px] tracking-[0.2em] text-forest/75 uppercase underline-offset-4 transition hover:text-forest hover:underline disabled:opacity-40 font-medium"
				>
					Remove
				</button>
			</form>
		</div>
	{:else}
		<form method="POST" action="/cart?/applyCoupon" use:enhance class="mt-4 flex items-end gap-3">
			<div class="flex flex-1 flex-col gap-2">
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
					class="w-full border-b border-forest/25 bg-transparent px-0 py-2 text-[15px] tracking-[0.18em] text-forest uppercase placeholder:tracking-normal placeholder:text-forest/60 placeholder:normal-case focus:border-forest focus:outline-none font-medium"
				/>
			</div>
			<button
				type="submit"
				disabled={busy}
				class="border border-forest/60 px-5 py-2 text-[11px] tracking-[0.2em] text-forest uppercase transition hover:bg-forest hover:text-cream disabled:opacity-40 font-medium"
			>
				Apply
			</button>
		</form>
	{/if}

	{#if message}
		<!-- Announced, not merely coloured. -->
		<p id="coupon-message" role="status" class="mt-3 text-[13px] leading-relaxed text-alert">
			{message}
		</p>
	{/if}
</section>
