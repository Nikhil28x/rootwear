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
	import RazorpayCheckout from '$lib/components/checkout/RazorpayCheckout.svelte';
	import { invalidateAll } from '$app/navigation';
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
	/** Razorpay's modal reported success. Still not "paid" until the webhook lands. */
	let handedOff = $state(false);

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

<main class="relative isolate overflow-hidden bg-paper text-forest">
	<div class="pointer-events-none absolute inset-0 -z-10 select-none" aria-hidden="true">
		<div class="absolute -bottom-28 -left-32 hidden h-[26rem] w-[46rem] text-forest sm:block">
			<RootSystem opacity={0.06} depth={6} />
		</div>
	</div>

	<div class="mx-auto max-w-[1600px] px-5 py-24 sm:px-10 sm:py-32 lg:px-14">
		<Eyebrow tone="strong" class="text-forest/70">{reservation.dropName} · Pre-order</Eyebrow>
		<h1
			class="display mt-6 text-[clamp(3rem,7vw,7rem)] leading-[0.82] tracking-[-0.055em] text-forest"
		>
			{#if settled}
				Balance<br />paid.
			{:else}
				The<br />balance.
			{/if}
		</h1>

		<div class="mt-16 grid gap-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-24">
			<div class="max-w-[46rem]">
				<section aria-labelledby="piece-heading">
					<h2 id="piece-heading" class="text-[11px] tracking-[0.28em] text-forest/75 uppercase font-medium">
						Your piece
					</h2>
					<p class="display mt-4 text-3xl leading-[0.95] tracking-[-0.03em] text-forest">
						{reservation.productName}
					</p>
					<p class="mt-3 text-[11px] tracking-[0.2em] text-forest/75 uppercase font-medium">
						Size {reservation.size}
						{#if reservation.pieceNumber !== null}
							· No. {reservation.pieceNumber}
						{/if}
					</p>
					<p class="mt-4 text-[13px] leading-relaxed text-forest/75">{FIT_DISCLAIMER}</p>
				</section>

				{#if problem}
					<p
						role="alert"
						class="mt-10 border-l-2 border-alert bg-alert/[0.06] px-6 py-5 text-[15px] leading-relaxed text-alert"
					>
						{problem}
					</p>
				{/if}

				<section class="mt-14 border-t border-forest/15 pt-8" aria-labelledby="terms-heading">
					<h2 id="terms-heading" class="text-[11px] tracking-[0.28em] text-forest/75 uppercase font-medium">
						The terms you agreed
					</h2>
					<!-- §08: the wording stored WITH the reservation, so a later
					     configuration change cannot rewrite what was agreed. -->
					<p class="mt-4 max-w-[60ch] text-[15px] leading-relaxed text-forest/75">
						{reservation.cancellationRule}
					</p>
					{#if reservation.dispatchDate}
						<p class="mt-4 text-[15px] text-forest/70">Dispatch from {reservation.dispatchDate}.</p>
					{/if}
					{#if reservation.balanceDueByMs !== null}
						<p class="mt-2 text-[15px] text-forest/70">
							Balance due by {longDate.format(reservation.balanceDueByMs)}.
						</p>
					{/if}
				</section>

				<section class="mt-14 border-t border-forest/15 pt-8" aria-labelledby="pay-heading">
					<h2 id="pay-heading" class="text-[11px] tracking-[0.28em] text-forest/75 uppercase font-medium">
						Payment
					</h2>

					{#if settled}
						<p class="mt-4 max-w-[54ch] text-[15px] leading-relaxed text-forest/75" aria-live="polite">
							Your balance is paid in full. We're preparing your piece for dispatch and have sent a
							confirmation to {reservation.email}.
						</p>
					{:else if !data.payment.configured}
						<p class="mt-4 max-w-[54ch] text-[15px] leading-relaxed text-forest/75">
							Online payment isn't available right now. We'll email you a payment link at
							{reservation.email}.
						</p>
					{:else if started && data.payment.name === 'mock'}
						<p class="mt-4 max-w-[54ch] text-[15px] leading-relaxed text-forest/70">
							<span class="block text-[11px] tracking-[0.28em] text-forest/75 uppercase font-medium">Test payment</span>
							<span class="mt-2 block">Payments aren't live in this environment. Use this to simulate a successful payment.</span>
						</p>
						<form method="POST" action="?/settleMock" class="mt-6" use:enhance>
							<Button surface="light" variant="outline" type="submit">Simulate payment</Button>
						</form>
					{:else if started}
						<p class="mt-4 max-w-[54ch] text-[15px] leading-relaxed text-forest/70" aria-live="polite">
							{#if handedOff}
								Confirming your payment… This usually takes a few seconds. You can safely close this page —
								we'll email your confirmation.
							{:else}
								Complete your payment in the Razorpay window. You'll pay securely with Razorpay — UPI,
								cards, netbanking and wallets.
							{/if}
						</p>
						{#if data.payment.name === 'razorpay' && data.payment.keyId && data.payment.gatewayOrderId && !handedOff}
							<RazorpayCheckout
								keyId={data.payment.keyId}
								gatewayOrderId={data.payment.gatewayOrderId}
								amount={data.payment.amount}
								description="Balance on your reservation"
								email={reservation.email}
								label="Pay the balance · {formatInr(data.payment.amount)}"
								autoOpen={Boolean(form && 'started' in form && form.started)}
								verifyAction="?/verifyPayment"
								onPaid={() => {
									handedOff = true;
									void invalidateAll();
								}}
							/>
						{/if}
					{:else}
						<form method="POST" action="?/pay" class="mt-6" use:enhance>
							<Button surface="light" variant="solid" type="submit">
								Pay the balance · {formatInr(reservation.balance)}
							</Button>
						</form>
					{/if}
				</section>
			</div>

			<div class="flex flex-col gap-8 lg:sticky lg:top-28 lg:self-start">
				<section aria-labelledby="money-heading">
					<h2 id="money-heading" class="text-[11px] tracking-[0.28em] text-forest/75 uppercase font-medium">
						This reservation
					</h2>
					<dl class="m-0 mt-5 flex flex-col gap-3 text-[15px]">
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
					<p class="mt-4 text-[11px] tracking-[0.2em] text-forest/70 uppercase font-medium">
						All prices inclusive of tax
					</p>
					<p class="mt-3 text-[13px] leading-relaxed text-forest/75">
						Your price is locked in from when you reserved.
					</p>
				</section>

				<!-- §11: the same returns wording as everywhere else it appears. -->
				<section class="border-t border-forest/15 pt-6" aria-labelledby="returns-heading">
					<h2 id="returns-heading" class="text-[11px] tracking-[0.28em] text-forest/75 uppercase font-medium">
						Returns
					</h2>
					<p class="mt-4 text-[13px] leading-relaxed text-forest/70">{RETURNS_WORDING}</p>
					<p class="mt-4 text-[13px] text-forest/75">
						Questions:
						<a href="mailto:{SUPPORT_EMAIL}" class="underline underline-offset-4">{SUPPORT_EMAIL}</a
						>
					</p>
				</section>
			</div>
		</div>
	</div>
</main>
