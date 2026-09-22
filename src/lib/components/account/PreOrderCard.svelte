<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import RecordState from './RecordState.svelte';
	import { isoDate, RESERVATION_COPY, shortDate, shortDateTime } from './state-labels';
	import { formatInr, paise } from '$lib/money';
	import { DEPOSIT_PERCENT_CONFIRMED } from '$lib/config/commerce';
	import type { PreOrder } from '$lib/server/account/types';

	/**
	 * §08 — "A reservation, its deposit, its balance payment and its final
	 * order are ONE CONTINUOUS RECORD — the customer sees ONE THING here."
	 *
	 * So this is one card, not three. The deposit, the balance, the piece
	 * number, the dispatch date and the order it eventually became all live on
	 * the same surface, and the STATE at the top is read from the stored column
	 * rather than guessed from which of those happen to be filled in.
	 *
	 * §08 also fixes what may be said about the money: DEPOSIT_PERCENT_CONFIRMED
	 * is false (open item RW-006), so no percentage is printed anywhere here.
	 * It is "a deposit", never "a 50% deposit", until that answer is in writing.
	 */
	let { record }: { record: PreOrder } = $props();

	let copy = $derived(RESERVATION_COPY[record.state]);

	/** What is actually left to pay. Reported, never used to decide the state. */
	let outstanding = $derived(paise(Math.max(0, record.balance - record.balancePaid)));
	let depositOutstanding = $derived(paise(Math.max(0, record.deposit - record.depositPaid)));

	let awaitingBalance = $derived(record.state === 'balance_due');
	let awaitingDeposit = $derived(record.state === 'pending_payment');

	let piece = $derived(
		record.pieceNumber === null
			? null
			: `${String(record.pieceNumber).padStart(2, '0')} / ${record.editionSize}`
	);
</script>

<article class="border border-forest/20">
	<header
		class="flex flex-wrap items-start justify-between gap-4 border-b border-forest/15 px-6 py-5 sm:px-8"
	>
		<div>
			<p class="text-[11px] tracking-[0.28em] text-forest/65 uppercase font-medium">
				Drop {String(record.dropNumber).padStart(2, '0')} · {record.dropName}
			</p>
			<h3 class="display mt-2 text-[clamp(1.5rem,2.6vw,2.1rem)] leading-[1.05] text-forest">
				{record.productName}
			</h3>
		</div>
		<RecordState label={copy.label} tone={copy.tone} />
	</header>

	<div class="px-6 py-7 sm:px-8">
		<p class="max-w-[54ch] text-[15px] leading-[1.8] text-forest/75">{copy.sentence}</p>

		<dl class="mt-8 grid grid-cols-2 gap-x-8 gap-y-7 sm:grid-cols-3 lg:grid-cols-4">
			<div>
				<dt class="text-[11px] tracking-[0.28em] text-forest/65 uppercase font-medium">Piece</dt>
				<dd class="mt-2 text-[15px] text-forest">
					{#if piece}
						<span class="display text-[1.35rem] leading-none">{piece}</span>
					{:else}
						<span class="text-forest/70">Allocated on payment</span>
					{/if}
				</dd>
			</div>

			<div>
				<dt class="text-[11px] tracking-[0.28em] text-forest/65 uppercase font-medium">Size</dt>
				<dd class="mt-2 text-[15px] text-forest">
					{record.size ?? '—'}
					{#if record.sku}
						<span class="block text-[13px] text-forest/70">{record.sku}</span>
					{/if}
				</dd>
			</div>

			<div>
				<dt class="text-[11px] tracking-[0.28em] text-forest/65 uppercase font-medium">Locked price</dt>
				<dd class="mt-2 text-[15px] text-forest">
					{formatInr(record.lockedPrice)}
					<span class="block text-[13px] text-forest/70">Held for you. Inclusive of tax.</span>
				</dd>
			</div>

			<div>
				<dt class="text-[11px] tracking-[0.28em] text-forest/65 uppercase font-medium">Deposit</dt>
				<dd class="mt-2 text-[15px] text-forest">
					{formatInr(record.depositPaid)} paid
					{#if depositOutstanding > 0}
						<span class="block text-[13px] text-forest/70">
							{formatInr(depositOutstanding)} of the deposit is not yet confirmed.
						</span>
					{:else}
						<span class="block text-[13px] text-forest/70">Deposit of {formatInr(record.deposit)}.</span
						>
					{/if}
				</dd>
			</div>

			<div>
				<dt class="text-[11px] tracking-[0.28em] text-forest/65 uppercase font-medium">Balance</dt>
				<dd class="mt-2 text-[15px] text-forest">
					{#if outstanding > 0}
						{formatInr(outstanding)} due
					{:else}
						<span class="text-forest/70">Nothing outstanding</span>
					{/if}
					{#if record.balanceDueBy !== null && outstanding > 0}
						<span class="block text-[13px] text-forest/70">
							By {shortDateTime(record.balanceDueBy)}
						</span>
					{/if}
				</dd>
			</div>

			<div>
				<dt class="text-[11px] tracking-[0.28em] text-forest/65 uppercase font-medium">Dispatch</dt>
				<dd class="mt-2 text-[15px] text-forest">{isoDate(record.dispatchDate)}</dd>
			</div>

			<div>
				<dt class="text-[11px] tracking-[0.28em] text-forest/65 uppercase font-medium">Reserved</dt>
				<dd class="mt-2 text-[15px] text-forest">{shortDate(record.createdAt)}</dd>
			</div>

			<div>
				<dt class="text-[11px] tracking-[0.28em] text-forest/65 uppercase font-medium">Order</dt>
				<dd class="mt-2 text-[15px] text-forest">
					{#if record.orderNumber}
						<a
							class="underline underline-offset-4 hover:text-forest/70"
							href="/account/orders/{record.orderNumber}"
						>
							{record.orderNumber}
						</a>
					{:else}
						<span class="text-forest/70">Opens when the balance clears</span>
					{/if}
				</dd>
			</div>
		</dl>

		{#if awaitingBalance || awaitingDeposit}
			<div class="mt-9 flex flex-wrap items-center gap-6 border-t border-forest/15 pt-7">
				{#if awaitingBalance}
					<Button href="/checkout/balance/{record.id}" variant="solid" surface="light">
						Pay the balance
					</Button>
					<p class="max-w-[38ch] text-[13px] leading-relaxed text-forest/75">
						{formatInr(outstanding)} to clear. Your piece is held until then.
					</p>
				{:else}
					<p class="max-w-[46ch] text-[13px] leading-relaxed text-forest/75">
						We will confirm by email the moment the deposit clears. Nothing further is needed from
						you right now.
					</p>
				{/if}
			</div>
		{/if}

		<!--
			§15 RW-007 — the exact wording this customer agreed to, stored on their
			own row. Printed verbatim rather than re-composed from a constant, so a
			later change to the terms cannot rewrite what they were shown.
		-->
		<div class="mt-9 border-t border-forest/15 pt-7">
			<p class="text-[11px] tracking-[0.28em] text-forest/65 uppercase font-medium">Cancellation</p>
			<p class="mt-3 max-w-[62ch] text-[13px] leading-[1.9] text-forest/75">
				{record.cancellationRule}
			</p>
			{#if !DEPOSIT_PERCENT_CONFIRMED}
				<p class="mt-3 max-w-[62ch] text-[13px] leading-[1.9] text-forest/70">
					The figures above are the exact amounts on your reservation.
				</p>
			{/if}
		</div>
	</div>
</article>
