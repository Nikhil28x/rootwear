<script lang="ts">
	/**
	 * §08 — paying the balance on a reserved piece.
	 *
	 * Deposit + balance always sum back to the locked price to the exact paise,
	 * because they were derived by splitByPercent() when the reservation was
	 * created and stored on the row. This page adds nothing up; it reads three
	 * numbers that were already agreed.
	 *
	 * No percentage appears anywhere below. RW-006 (§15, blocking) has not been
	 * answered, so DEPOSIT_PERCENT_CONFIRMED is false and the copy says "your
	 * deposit", never "your 50% deposit".
	 */
	import { enhance } from '$app/forms';
	import Button from '$lib/components/ui/Button.svelte';
	import Eyebrow from '$lib/components/ui/Eyebrow.svelte';
	import RootSystem from '$lib/components/art/RootSystem.svelte';
	import { formatInr } from '$lib/money';
	import { RETURNS_WORDING } from '$lib/content/returns';
	import { FIT_DISCLAIMER } from '$lib/drop/sizes';
	import { SUPPORT_EMAIL } from '$lib/content/business';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let reservation = $derived(data.reservation);
	let problem = $derived(form && 'problem' in form ? form.problem : '');
	let started = $derived(
		(form && 'started' in form && form.started) || data.payment.gatewayOrderId !== null
	);
	let settled = $derived(reservation.state === 'balance_paid');

	const longDate = new Intl.DateTimeFormat('en-GB', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		timeZone: 'Asia/Kolkata'
	});
</script>

<svelte:head>
	<title>Balance due — Rootwear</title>
	<meta name="robots" content="noindex, nofollow" />
	<meta name="referrer" content="no-referrer" />
</svelte:head>

<main class="relative isolate overflow-hidden bg-cream text-forest">
	<div class="pointer-events-none absolute inset-0 -z-10 select-none" aria-hidden="true">
		<div class="absolute -bottom-28 -left-32 hidden h-[26rem] w-[46rem] text-forest sm:block">
			<RootSystem opacity={0.06} depth={6} />
		</div>
	</div>

	<div class="mx-auto max-w-[1600px] px-5 py-24 sm:px-10 sm:py-32 lg:px-14">
		<Eyebrow tone="strong" class="text-forest/50">{reservation.dropName} · Pre-order</Eyebrow>
		<h1
			class="display mt-6 text-[clamp(3rem,7vw,7rem)] leading-[0.82] tracking-[-0.055em] text-forest"
		>
			{#if settled}
				Balance<br />settled.
			{:else}
				The<br />balance.
			{/if}
		</h1>

		<div class="mt-16 grid gap-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-24">
			<div class="max-w-[46rem]">
				<section aria-labelledby="piece-heading">
					<h2 id="piece-heading" class="text-[10px] tracking-[0.28em] text-forest/60 uppercase">
						Your piece
					</h2>
					<p class="display mt-4 text-3xl leading-[0.95] tracking-[-0.03em] text-forest">
						{reservation.productName}
					</p>
					<p class="mt-3 text-[10px] tracking-[0.2em] text-forest/60 uppercase">
						Size {reservation.size}
						{#if reservation.pieceNumber !== null}
							· Piece {reservation.pieceNumber} of the edition
						{/if}
					</p>
					<p class="mt-4 text-xs leading-relaxed text-forest/60">{FIT_DISCLAIMER}</p>
				</section>

				{#if problem}
					<p
						role="alert"
						class="mt-10 border-l-2 border-alert bg-alert/[0.06] px-6 py-5 text-sm leading-relaxed text-alert"
					>
						{problem}
					</p>
				{/if}

				<section class="mt-14 border-t border-forest/15 pt-8" aria-labelledby="terms-heading">
					<h2 id="terms-heading" class="text-[10px] tracking-[0.28em] text-forest/60 uppercase">
						The terms you agreed
					</h2>
					<!-- §08: the wording stored WITH the reservation, so a later
					     configuration change cannot rewrite what was agreed. -->
					<p class="mt-4 max-w-[60ch] text-sm leading-relaxed text-forest/75">
						{reservation.cancellationRule}
					</p>
					{#if reservation.dispatchDate}
						<p class="mt-4 text-sm text-forest/70">Dispatch from {reservation.dispatchDate}.</p>
					{/if}
					{#if reservation.balanceDueByMs !== null}
						<p class="mt-2 text-sm text-forest/70">
							Balance due by {longDate.format(reservation.balanceDueByMs)}.
						</p>
					{/if}
				</section>

				<section class="mt-14 border-t border-forest/15 pt-8" aria-labelledby="pay-heading">
					<h2 id="pay-heading" class="text-[10px] tracking-[0.28em] text-forest/60 uppercase">
						Payment
					</h2>

					{#if settled}
						<p class="mt-4 max-w-[54ch] text-sm leading-relaxed text-forest/75" aria-live="polite">
							This balance is paid in full. Nothing further is owed, and your piece moves into
							dispatch. The confirmation went to {reservation.email}.
						</p>
					{:else if !data.payment.configured}
						<p class="mt-4 max-w-[54ch] text-sm leading-relaxed text-forest/75">
							Card payment is not switched on yet. We will write to {reservation.email} with a payment
							link before your piece is cut.
						</p>
					{:else if started && data.payment.name === 'mock'}
						<p class="mt-4 max-w-[54ch] text-sm leading-relaxed text-forest/70">
							Razorpay is not switched on in this environment. Settling here posts a signed
							notification to the same webhook the live gateway calls. No money moves.
						</p>
						<form method="POST" action="?/settleMock" class="mt-6" use:enhance>
							<Button surface="light" variant="outline" type="submit">Settle this balance</Button>
						</form>
					{:else if started}
						<p class="mt-4 max-w-[54ch] text-sm leading-relaxed text-forest/70" aria-live="polite">
							A payment has been opened with the gateway. Your reservation updates when the
							gateway's own notification arrives — not when this page reloads.
						</p>
					{:else}
						<form method="POST" action="?/pay" class="mt-6" use:enhance>
							<Button surface="light" variant="solid" type="submit">
								Pay the balance · {formatInr(reservation.balance)}
							</Button>
						</form>
					{/if}

					<!-- §10: a coupon cannot apply to a deposit or a balance. Said
					     plainly, rather than offering a field that only refuses. -->
					<p class="mt-6 text-xs leading-relaxed text-forest/60">
						Discount codes do not apply to a deposit or a balance payment.
					</p>
				</section>
			</div>

			<div class="flex flex-col gap-8 lg:sticky lg:top-28 lg:self-start">
				<section aria-labelledby="money-heading">
					<h2 id="money-heading" class="text-[10px] tracking-[0.28em] text-forest/60 uppercase">
						This reservation
					</h2>
					<dl class="m-0 mt-5 flex flex-col gap-3 text-sm">
						<div class="flex justify-between gap-6">
							<dt class="text-forest/70">Locked price</dt>
							<dd class="m-0 text-forest tabular-nums">{formatInr(reservation.lockedPrice)}</dd>
						</div>
						<div class="flex justify-between gap-6">
							<!-- No percentage: RW-006 is unanswered (§08, §15). -->
							<dt class="text-forest/70">Deposit paid</dt>
							<dd class="m-0 text-forest tabular-nums">−{formatInr(reservation.deposit)}</dd>
						</div>
						<div class="mt-2 flex justify-between gap-6 border-t border-forest/20 pt-4 text-base">
							<dt class="text-forest">{settled ? 'Balance paid' : 'Balance due'}</dt>
							<dd class="m-0 text-forest tabular-nums">{formatInr(reservation.balance)}</dd>
						</div>
					</dl>
					<p class="mt-4 text-[10px] tracking-[0.2em] text-forest/50 uppercase">
						All prices inclusive of tax
					</p>
					<p class="mt-3 text-xs leading-relaxed text-forest/60">
						The price was locked when you reserved. It does not move with the drop.
					</p>
				</section>

				<!-- §11: the same returns wording as everywhere else it appears. -->
				<section class="border-t border-forest/15 pt-6" aria-labelledby="returns-heading">
					<h2 id="returns-heading" class="text-[10px] tracking-[0.28em] text-forest/60 uppercase">
						Returns
					</h2>
					<p class="mt-4 text-xs leading-relaxed text-forest/70">{RETURNS_WORDING}</p>
					<p class="mt-4 text-xs text-forest/60">
						Questions:
						<a href="mailto:{SUPPORT_EMAIL}" class="underline underline-offset-4">{SUPPORT_EMAIL}</a
						>
					</p>
				</section>
			</div>
		</div>
	</div>
</main>
