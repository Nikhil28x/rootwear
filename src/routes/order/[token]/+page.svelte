<script lang="ts">
	/**
	 * The order, as the customer sees it. §03 template 07, §11.
	 *
	 * Every figure here is a SNAPSHOT taken at order creation: app.order_lines
	 * stores the unit price and which price it was, so this page reads the same
	 * numbers in a year's time even though the drop's price changed at launch
	 * and the archive moved on (§06).
	 */
	import Button from '$lib/components/ui/Button.svelte';
	import Eyebrow from '$lib/components/ui/Eyebrow.svelte';
	import HempMotif from '$lib/components/art/HempMotif.svelte';
	import { formatInr, multiplyPaise } from '$lib/money';
	import { RETURNS_WORDING } from '$lib/content/returns';
	import { FIT_DISCLAIMER } from '$lib/drop/sizes';
	import {
		BUSINESS_NAME,
		GST_POSITION,
		INSTAGRAM_HANDLE,
		INSTAGRAM_URL,
		SUPPORT_EMAIL
	} from '$lib/content/business';
	import { SHIP_COUNTRY_LABEL } from '$lib/checkout/address';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let order = $derived(data.order);

	const longDate = new Intl.DateTimeFormat('en-GB', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		timeZone: 'Asia/Kolkata'
	});

	/** Stored state, never inferred from whether a payment row exists (§06). */
	const STATE_LABEL: Record<string, string> = {
		pending_payment: 'Awaiting payment',
		paid: 'Paid',
		packed: 'Packed',
		dispatched: 'Dispatched',
		delivered: 'Delivered',
		cancelled: 'Cancelled',
		refunded: 'Refunded'
	};

	const STATE_NOTE: Record<string, string> = {
		pending_payment:
			'We have the order and are waiting for the payment notification. Nothing is cut until it lands.',
		paid: 'Payment confirmed. Your hand number is allocated and the piece is being prepared.',
		packed: 'Packed and waiting for the courier.',
		dispatched: 'On its way. The tracking reference is below.',
		delivered: 'Delivered. The seven-day window for a defect starts from this date.',
		cancelled: 'This order was cancelled. Nothing further will be charged.',
		refunded: 'This order was refunded in full.'
	};

	let shortLabel = $derived(STATE_LABEL[order.state] ?? order.state);
	let stateNote = $derived(STATE_NOTE[order.state] ?? '');
</script>

<svelte:head>
	<title>Order {order.orderNumber} — Rootwear</title>
	<!-- A capability URL: it must never be indexed or sent as a referrer. -->
	<meta name="robots" content="noindex, nofollow" />
	<meta name="referrer" content="no-referrer" />
</svelte:head>

<main class="relative isolate overflow-hidden bg-cream text-forest">
	<div class="pointer-events-none absolute inset-0 -z-10 select-none" aria-hidden="true">
		<div class="absolute -top-32 -right-40 h-[36rem] w-[36rem] text-forest">
			<HempMotif opacity={0.05} seed={2} />
		</div>
	</div>

	<div class="mx-auto max-w-[1600px] px-5 py-24 sm:px-10 sm:py-32 lg:px-14">
		<Eyebrow tone="strong" class="text-forest/70">Order {order.orderNumber}</Eyebrow>
		<h1
			class="display mt-6 text-[clamp(3rem,7vw,7rem)] leading-[0.82] tracking-[-0.055em] text-forest"
		>
			{#if order.state === 'pending_payment'}
				Almost<br />there.
			{:else}
				It is<br />yours.
			{/if}
		</h1>

		<p class="mt-8 max-w-[54ch] text-[16px] leading-[1.85] text-forest/70">
			{stateNote} A copy of this page has gone to {order.email}. Keep the link — it is the whole
			record and it does not expire.
		</p>

		<div class="mt-16 grid gap-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-24">
			<div class="max-w-[46rem]">
				<section aria-labelledby="pieces-heading">
					<h2 id="pieces-heading" class="text-[11px] tracking-[0.28em] text-forest/75 uppercase font-medium">
						Pieces
					</h2>
					<ul class="mt-5 flex list-none flex-col p-0">
						{#each order.lines as line (line.sku)}
							<li class="flex justify-between gap-6 border-b border-forest/10 py-5">
								<div>
									<p class="text-[15px] text-forest">{line.name}</p>
									<p class="mt-1 text-[11px] tracking-[0.2em] text-forest/70 uppercase font-medium">
										{#if line.size}Size {line.size} ·
										{/if}{line.sku} · {line.quantity} ×
										{formatInr(line.unitPrice)}
									</p>
									{#if line.pieceNumber !== null}
										<!-- §08: the hand number is allocated ON PAYMENT
										     CONFIRMATION, never before. -->
										<p class="mt-2 text-[11px] tracking-[0.28em] text-gold uppercase font-medium">
											Piece {line.pieceNumber}
										</p>
									{:else if line.priceSource === 'prelaunch_locked'}
										<p class="mt-2 text-[13px] leading-relaxed text-forest/70">
											Pre-order at the locked pre-launch price. Dispatch follows the drop opening on {longDate.format(
												data.launchInstant
											)}, and your hand number is allocated when payment confirms.
										</p>
									{/if}
								</div>
								<p class="shrink-0 text-[15px] text-forest tabular-nums">
									{formatInr(multiplyPaise(line.unitPrice, line.quantity))}
								</p>
							</li>
						{/each}
					</ul>
					<!-- §09: the fit disclaimer follows a size wherever it is shown. -->
					<p class="mt-4 text-[13px] leading-relaxed text-forest/75">{FIT_DISCLAIMER}</p>
				</section>

				<section class="mt-14" aria-labelledby="ship-heading">
					<h2 id="ship-heading" class="text-[11px] tracking-[0.28em] text-forest/75 uppercase font-medium">
						Delivering to
					</h2>
					<address class="mt-5 text-[15px] leading-[1.9] text-forest/80 not-italic">
						{order.ship.name}<br />
						{order.ship.line1}<br />
						{#if order.ship.line2}{order.ship.line2}<br />{/if}
						{order.ship.city}, {order.ship.state}
						{order.ship.pincode}<br />
						{SHIP_COUNTRY_LABEL}<br />
						{order.ship.phone}
					</address>

					{#if order.ship.notes}
						<div class="mt-6 border-l-2 border-forest/20 pl-4">
							<p class="text-[11px] tracking-[0.28em] text-forest/75 uppercase font-medium">Your notes</p>
							<p class="mt-2 text-[15px] leading-relaxed text-forest/75">{order.ship.notes}</p>
						</div>
					{/if}
				</section>

				{#if order.trackingRef}
					<section class="mt-14" aria-labelledby="tracking-heading">
						<h2
							id="tracking-heading"
							class="text-[11px] tracking-[0.28em] text-forest/75 uppercase font-medium"
						>
							Tracking
						</h2>
						<p class="mt-4 text-[15px] text-forest/80">
							{order.courierName ?? 'Courier'} ·
							<span class="tabular-nums">{order.trackingRef}</span>
						</p>
					</section>
				{/if}

				<!-- §11: the SAME returns wording as the product page, at checkout
				     and on the returns policy page. One constant, four places. -->
				<section class="mt-14 border-t border-forest/15 pt-8" aria-labelledby="returns-heading">
					<h2 id="returns-heading" class="text-[11px] tracking-[0.28em] text-forest/75 uppercase font-medium">
						Returns
					</h2>
					<p class="mt-4 max-w-[60ch] text-[15px] leading-relaxed text-forest/75">{RETURNS_WORDING}</p>
					<p class="mt-5 text-[15px] text-forest/70">
						Write to
						<a href="mailto:{SUPPORT_EMAIL}" class="underline underline-offset-4">{SUPPORT_EMAIL}</a
						>
						or DM
						<a href={INSTAGRAM_URL} class="underline underline-offset-4">{INSTAGRAM_HANDLE}</a>
						with order {order.orderNumber}.
					</p>
				</section>
			</div>

			<div class="flex flex-col gap-8 lg:sticky lg:top-28 lg:self-start">
				<section aria-labelledby="status-heading">
					<h2 id="status-heading" class="text-[11px] tracking-[0.28em] text-forest/75 uppercase font-medium">
						Status
					</h2>
					<p class="mt-4 text-[15px] tracking-[0.18em] text-forest uppercase font-medium">{shortLabel}</p>
					<p class="mt-2 text-[11px] tracking-[0.2em] text-forest/70 uppercase font-medium">
						Placed {longDate.format(order.placedAtMs)}
					</p>
				</section>

				<section class="border-t border-forest/15 pt-6" aria-labelledby="total-heading">
					<h2 id="total-heading" class="text-[11px] tracking-[0.28em] text-forest/75 uppercase font-medium">
						Total
					</h2>
					<dl class="m-0 mt-5 flex flex-col gap-3 text-[15px]">
						<div class="flex justify-between gap-6">
							<dt class="text-forest/70">Subtotal</dt>
							<dd class="m-0 text-forest tabular-nums">{formatInr(order.subtotal)}</dd>
						</div>
						{#if order.discount > 0}
							<div class="flex justify-between gap-6">
								<dt class="text-forest/70">Discount</dt>
								<dd class="m-0 text-forest tabular-nums">−{formatInr(order.discount)}</dd>
							</div>
						{/if}
						<div class="flex justify-between gap-6">
							<dt class="text-forest/70">Shipping</dt>
							<dd class="m-0 text-forest tabular-nums">
								{order.shipping === 0 ? 'Included' : formatInr(order.shipping)}
							</dd>
						</div>
						<div class="mt-2 flex justify-between gap-6 border-t border-forest/20 pt-4 text-base">
							<dt class="text-forest">Paid</dt>
							<dd class="m-0 text-forest tabular-nums">{formatInr(order.total)}</dd>
						</div>
					</dl>
					<p class="mt-4 text-[11px] tracking-[0.2em] text-forest/70 uppercase font-medium">
						{#if GST_POSITION.registered}
							Inclusive of GST · GSTIN {GST_POSITION.gstin}
						{:else}
							All prices inclusive of tax
						{/if}
					</p>
					<p class="mt-3 text-[11px] tracking-[0.2em] text-forest/70 uppercase font-medium">
						{BUSINESS_NAME}
					</p>
				</section>

				<Button surface="light" variant="outline" href="/drops">See the drops</Button>
			</div>
		</div>
	</div>
</main>
