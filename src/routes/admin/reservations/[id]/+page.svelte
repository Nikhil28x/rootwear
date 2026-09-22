<script lang="ts">
	import { formatInr } from '$lib/money';
	import { DEPOSIT_PERCENT_CONFIRMED } from '$lib/config/commerce';
	import SectionHead from '$lib/components/admin/SectionHead.svelte';
	import StatePill from '$lib/components/admin/StatePill.svelte';
	import Notice from '$lib/components/admin/Notice.svelte';
	import {
		humanise,
		paymentTone,
		relativeDays,
		reservationTone,
		shortDateTime
	} from '$lib/components/admin/tone';

	let { data, form } = $props();

	let r = $derived(data.reservation);
	let overdue = $derived(
		r.state === 'balance_due' && r.balanceDueBy !== null && r.balanceDueBy < data.now
	);
	let canRequestBalance = $derived(r.state === 'reserved' || r.state === 'balance_due');
	// Reported by the action, not read off the message text.
	let failed = $derived(Boolean(form?.message) && !form?.ok);
</script>

<svelte:head>
	<title>{r.pieceNumber ? `Piece ${r.pieceNumber}` : 'Reservation'} — Rootwear operations</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<p class="text-[11px] tracking-[0.24em] text-stone-400 uppercase font-medium">
	<a class="underline underline-offset-4 hover:text-stone-200" href="/admin/reservations">
		Reservations
	</a>
	<span aria-hidden="true"> / </span>{r.dropName} · {r.size}
</p>

<div class="mt-6">
	<SectionHead
		level={1}
		eyebrow={r.dropName}
		title={r.pieceNumber === null ? 'No piece allocated' : `Piece ${r.pieceNumber}`}
		note="Opened {shortDateTime(r.createdAt)} IST by {r.email}. One record: reservation, deposit, balance and order."
	/>
</div>

<div class="mt-6 flex flex-wrap items-center gap-4">
	<StatePill label={humanise(r.state)} tone={reservationTone(r.state)} />
	{#if overdue}
		<StatePill label="Balance overdue" tone="solid" />
	{/if}
	<p class="text-[13px] text-stone-400">{r.sku} · size {r.size}</p>
	{#if r.orderId}
		<a
			class="text-[13px] tracking-[0.16em] text-stone-300 uppercase underline underline-offset-4 hover:text-cream font-medium"
			href="/admin/orders/{r.orderId}"
		>
			Order {r.orderNumber} →
		</a>
	{/if}
</div>

{#if form?.message}
	<div class="mt-8"><Notice kind={failed ? 'error' : 'success'}>{form.message}</Notice></div>
{/if}

<div class="mt-14 grid gap-14 xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
	<div class="flex flex-col gap-14">
		<!-- MONEY -->
		<section class="flex flex-col gap-6">
			<SectionHead
				eyebrow="Terms"
				title="What was agreed"
				note="These are the terms that were in force when the reservation was opened, copied onto the record. A later change to the configuration cannot rewrite them."
			/>

			<dl class="grid gap-px bg-white/10 sm:grid-cols-3">
				<div class="flex flex-col gap-2 bg-forest/40 px-5 py-6">
					<dt class="text-[11px] tracking-[0.24em] text-stone-400 uppercase font-medium">Locked price</dt>
					<dd class="text-xl text-cream tabular-nums">{formatInr(r.lockedPrice)}</dd>
				</div>
				<div class="flex flex-col gap-2 bg-forest/40 px-5 py-6">
					<dt class="text-[11px] tracking-[0.24em] text-stone-400 uppercase font-medium">Deposit</dt>
					<dd class="text-xl text-cream tabular-nums">{formatInr(r.deposit)}</dd>
				</div>
				<div class="flex flex-col gap-2 bg-forest/40 px-5 py-6">
					<dt class="text-[11px] tracking-[0.24em] text-stone-400 uppercase font-medium">Balance</dt>
					<dd class="text-xl text-cream tabular-nums">{formatInr(r.balance)}</dd>
				</div>
			</dl>

			<p class="text-[13px] leading-relaxed text-stone-400">
				Deposit and balance are derived from the locked price together, never computed
				independently, so they always sum back to it exactly.
				{#if !DEPOSIT_PERCENT_CONFIRMED}
					The deposit share is still unconfirmed in writing, so no percentage is printed here or
					anywhere the customer can see.
				{/if}
			</p>
		</section>

		<!-- TIMELINE -->
		<section class="flex flex-col gap-6 border-t border-white/10 pt-10">
			<SectionHead
				eyebrow="History"
				title="The record"
				note="Reconstructed from the payment ledger and the row's own timestamps, so it cannot drift from what actually happened."
			/>

			<ol class="flex flex-col border-l border-white/15 pl-6">
				{#each r.timeline as step, index (index)}
					<li class="relative pb-8 last:pb-0">
						<span
							class="absolute -left-[1.6875rem] top-1.5 block h-2 w-2 bg-gold"
							aria-hidden="true"
						></span>
						<p class="text-[15px] text-cream">{step.label}</p>
						<p class="mt-1 text-[13px] text-stone-400 tabular-nums">{shortDateTime(step.at)} IST</p>
						{#if step.detail}
							<p class="mt-2 max-w-[42rem] text-[15px] leading-relaxed text-stone-400">{step.detail}</p>
						{/if}
					</li>
				{/each}
			</ol>
		</section>

		<!-- BALANCE LINK -->
		<section class="flex flex-col gap-6 border-t border-white/10 pt-10">
			<SectionHead
				eyebrow="Action"
				title="Balance link"
				note="Records that the balance has been asked for and when it falls due. A balance that lapses releases the piece back to the waitlist, so the date matters."
			/>

			{#if canRequestBalance}
				<form method="POST" action="?/balanceLink" class="flex flex-wrap items-end gap-6">
					<div class="flex w-32 flex-col gap-2">
						<label for="days" class="text-[11px] tracking-[0.2em] text-stone-400 uppercase font-medium">
							Days to pay
						</label>
						<input
							id="days"
							name="days"
							type="number"
							min="1"
							max="60"
							step="1"
							value="7"
							class="w-full border-b border-white/25 bg-transparent px-0 py-2.5 text-[15px] text-stone-100 tabular-nums outline-none focus:border-white"
						/>
					</div>
					<button
						type="submit"
						class="border border-white/35 px-7 py-3 text-[11px] tracking-[0.2em] text-stone-100 uppercase transition hover:bg-white hover:text-black font-medium"
					>
						Record balance link
					</button>
				</form>
			{:else}
				<Notice kind="info">
					A balance link applies only to a confirmed reservation. This one is {humanise(
						r.state
					).toLowerCase()}.
				</Notice>
			{/if}

			{#if r.balanceDueBy !== null && canRequestBalance}
				<p class="text-[15px] {overdue ? 'text-cream' : 'text-stone-400'} tabular-nums">
					Balance due {shortDateTime(r.balanceDueBy)} IST — {relativeDays(r.balanceDueBy, data.now)}{overdue
						? ', overdue'
						: ''}.
				</p>
			{:else if r.balanceDueBy !== null}
				<p class="text-[15px] text-stone-400 tabular-nums">
					The balance was due {shortDateTime(r.balanceDueBy)} IST and is no longer outstanding.
				</p>
			{/if}
		</section>
	</div>

	<aside class="flex flex-col gap-12">
		<section class="flex flex-col gap-4">
			<h2 class="text-[11px] tracking-[0.28em] text-stone-400 uppercase font-medium">Payments</h2>
			{#if r.payments.length === 0}
				<p class="text-[15px] text-stone-400">Nothing captured yet.</p>
			{:else}
				<ul class="flex flex-col">
					{#each r.payments as payment (payment.id)}
						<li class="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 py-4">
							<span class="flex items-center gap-3">
								<StatePill label={humanise(payment.state)} tone={paymentTone(payment.state)} />
								<span class="text-[15px] text-stone-300">{humanise(payment.kind)}</span>
							</span>
							<span class="text-[15px] text-cream tabular-nums">{formatInr(payment.amount)}</span>
							<span class="w-full text-[13px] text-stone-400 tabular-nums">
								{shortDateTime(payment.createdAt)} · {payment.gateway}
							</span>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		{#if r.refunds.length > 0}
			<section class="flex flex-col gap-4">
				<h2 class="text-[11px] tracking-[0.28em] text-stone-400 uppercase font-medium">Refunds</h2>
				<ul class="flex flex-col">
					{#each r.refunds as refund (refund.id)}
						<li class="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 py-4">
							<span class="flex items-center gap-3">
								<StatePill label={humanise(refund.state)} tone="outline" />
								<span class="text-[15px] text-stone-300">{humanise(refund.reason)}</span>
							</span>
							<span class="text-[15px] text-cream tabular-nums">{formatInr(refund.amount)}</span>
							<span class="w-full text-[13px] text-stone-400 tabular-nums">
								{shortDateTime(refund.createdAt)}
							</span>
						</li>
					{/each}
				</ul>
				<p class="text-[13px] leading-relaxed text-stone-400">
					A reservation that loses the cap race is refunded automatically and the customer is told
					immediately — no piece number is ever issued to it.
				</p>
			</section>
		{/if}

		<section class="flex flex-col gap-4 border-t border-white/10 pt-8">
			<h2 class="text-[11px] tracking-[0.28em] text-stone-400 uppercase font-medium">
				Cancellation rule as shown
			</h2>
			<p class="text-[15px] leading-relaxed text-stone-400">{r.cancellationRule}</p>
			<p class="text-[13px] text-stone-400">
				Stored on the record at the moment of reservation. What this customer agreed to is what is
				printed here, whatever the wording says today.
			</p>
		</section>
	</aside>
</div>
