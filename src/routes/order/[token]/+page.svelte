<script lang="ts">
	/**
	 * The order, as the customer sees it. §03 template 07, §11.
	 *
	 * Every figure here is a SNAPSHOT taken at order creation: app.order_lines
	 * stores the unit price and which price it was, so this page reads the same
	 * numbers in a year's time even though the drop's price changed at launch
	 * and the archive moved on (§06).
	 */
	import '$lib/components/checkout/checkout.css';
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
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
		pending_payment: "We're confirming your payment.",
		paid: "Payment received. We're preparing your order.",
		packed: 'Packed and ready to ship.',
		dispatched: 'On its way. Tracking details are below.',
		delivered: 'Delivered. You have seven days from delivery to report a defect.',
		cancelled: "This order was cancelled. You won't be charged.",
		refunded: 'This order was refunded in full.'
	};

	/**
	 * A paid order retires its cart on the server. Arriving here by a client
	 * redirect leaves the header's count from before that; ask once more.
	 */
	onMount(() => {
		if (order.state !== 'pending_payment' && (page.data.cartLines?.length ?? 0) > 0) {
			void invalidateAll();
		}
	});

	let shortLabel = $derived(STATE_LABEL[order.state] ?? order.state);
	let stateNote = $derived(STATE_NOTE[order.state] ?? '');
</script>

<svelte:head>
	<title>Order {order.orderNumber} — Rootwear</title>
	<!-- A capability URL: it must never be indexed or sent as a referrer. -->
	<meta name="robots" content="noindex, nofollow" />
	<meta name="referrer" content="no-referrer" />
</svelte:head>

<main class="co">
	<div class="co-grid">
		<header class="co-mast">
			<div class="co-mast__text">
				<h1 class="co-title">Your order</h1>
				<p class="co-sub">Order <span class="co-num">{order.orderNumber}</span></p>
			</div>
		</header>

		<div class="co-main">
			<p class="co-lede">
				{stateNote} We've sent the details to {order.email}. Bookmark this page to check your order
				anytime.
			</p>

			<section aria-labelledby="pieces-heading">
				<div class="co-head"><h2 id="pieces-heading">Pieces</h2></div>
				<ul class="co-lines">
					{#each order.lines as line (line.sku)}
						<li class="co-line order-line">
							<div>
								<p class="co-line__name">{line.name}</p>
								<p class="co-line__meta">
									{line.size ? `Size ${line.size} · ` : ''}{line.sku} · {line.quantity} ×
									<span class="co-num">{formatInr(line.unitPrice)}</span>
								</p>
								{#if line.pieceNumber !== null}
									<!-- §08: the hand number is allocated ON PAYMENT
									     CONFIRMATION, never before. -->
									<p class="order-piece">No. {line.pieceNumber}</p>
								{:else if line.priceSource === 'prelaunch_locked'}
									<p class="co-fine order-pre">
										Pre-order — ships after the drop opens on {longDate.format(data.launchInstant)}.
									</p>
								{/if}
							</div>
							<p class="co-line__price">
								{formatInr(multiplyPaise(line.unitPrice, line.quantity))}
							</p>
						</li>
					{/each}
				</ul>
				<!-- §09: the fit disclaimer follows a size wherever it is shown. -->
				<p class="co-fine order-fit">{FIT_DISCLAIMER}</p>
			</section>

			<section aria-labelledby="ship-heading">
				<div class="co-head"><h2 id="ship-heading">Delivering to</h2></div>
				<address class="order-address">
					{order.ship.name}<br />
					{order.ship.line1}<br />
					{#if order.ship.line2}{order.ship.line2}<br />{/if}
					{order.ship.city}, {order.ship.state}
					{order.ship.pincode}<br />
					{SHIP_COUNTRY_LABEL}<br />
					<span class="order-soft">{order.ship.phone}</span>
				</address>

				{#if order.ship.notes}
					<div class="co-note order-notes">
						<b>Your notes</b>
						{order.ship.notes}
					</div>
				{/if}
			</section>

			{#if order.trackingRef}
				<section aria-labelledby="tracking-heading">
					<div class="co-head"><h2 id="tracking-heading">Tracking</h2></div>
					<p class="order-tracking">
						{order.courierName ?? 'Courier'} ·
						<span class="co-num">{order.trackingRef}</span>
					</p>
				</section>
			{/if}

			<!-- §11: the SAME returns wording as the product page, at checkout
			     and on the returns policy page. One constant, four places. -->
			<section aria-labelledby="returns-heading">
				<div class="co-head"><h2 id="returns-heading">Returns</h2></div>
				<p class="co-copy order-returns">{RETURNS_WORDING}</p>
				<p class="co-copy order-contact">
					Write to
					<a href="mailto:{SUPPORT_EMAIL}" class="link">{SUPPORT_EMAIL}</a>
					or DM
					<a href={INSTAGRAM_URL} class="link">{INSTAGRAM_HANDLE}</a>
					with order {order.orderNumber}.
				</p>
			</section>
		</div>

		<aside class="co-aside co-card" aria-label="Order status and total">
			<section aria-labelledby="status-heading" class="order-status">
				<h2 id="status-heading" class="co-label">Status</h2>
				<p class="order-status__value">
					<span
						class="co-dot"
						class:co-dot--pulse={order.state === 'pending_payment'}
						aria-hidden="true"
					></span>
					{shortLabel}
				</p>
				<p class="co-fine">Placed {longDate.format(order.placedAtMs)}</p>
			</section>

			<section aria-labelledby="total-heading">
				<h2 id="total-heading" class="order-total-head">Total</h2>
				<dl class="co-spec">
					<div class="co-spec__row">
						<dt>Subtotal</dt>
						<span class="co-spec__dots" aria-hidden="true"></span>
						<dd>{formatInr(order.subtotal)}</dd>
					</div>
					{#if order.discount > 0}
						<div class="co-spec__row">
							<dt>Discount</dt>
							<span class="co-spec__dots" aria-hidden="true"></span>
							<dd>−{formatInr(order.discount)}</dd>
						</div>
					{/if}
					<div class="co-spec__row">
						<dt>Shipping</dt>
						<span class="co-spec__dots" aria-hidden="true"></span>
						<dd>{order.shipping === 0 ? 'Included' : formatInr(order.shipping)}</dd>
					</div>
					<div class="co-spec__row co-spec__row--total">
						<dt>Total</dt>
						<dd>{formatInr(order.total)}</dd>
					</div>
				</dl>
				<p class="co-fine order-tax">
					{#if GST_POSITION.registered}
						Inclusive of GST · GSTIN {GST_POSITION.gstin}
					{:else}
						All prices inclusive of tax
					{/if}
				</p>
				<p class="co-fine">{BUSINESS_NAME}</p>
			</section>

			<a class="cta cta--line cta--full" href="/drops">See the drops</a>
		</aside>
	</div>
</main>

<style>
	.order-line {
		grid-template-columns: minmax(0, 1fr) auto;
		padding: 16px 0;
	}
	.order-line .co-line__name {
		font-family: var(--font-display);
		font-size: 1.35rem;
		line-height: 1.1;
		letter-spacing: -0.015em;
	}
	.order-piece {
		margin-top: 6px;
		font-size: 13px;
		color: var(--ink);
	}
	.order-pre {
		margin-top: 6px;
	}
	.order-fit {
		margin-top: 12px;
	}
	.order-address {
		margin-top: 16px;
	}
	.order-soft {
		color: var(--soft);
	}
	.order-notes {
		margin-top: 20px;
	}
	.order-tracking {
		margin-top: 16px;
		font-size: 15px;
	}
	.order-returns {
		max-width: 60ch;
		margin-top: 16px;
	}
	.order-contact {
		margin-top: 12px;
	}
	.order-contact .link {
		font-size: inherit;
	}
	.order-status {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.order-status h2 {
		margin: 0;
		font-weight: 400;
	}
	.order-status__value {
		display: flex;
		align-items: center;
		gap: 12px;
		font-family: var(--font-display);
		font-size: clamp(2rem, 2.8vw, 2.5rem);
		line-height: 1.05;
		letter-spacing: -0.02em;
	}
	.order-total-head {
		margin: 0;
		padding-bottom: 12px;
		border-bottom: 1px solid var(--ink);
		font-family: var(--font-display);
		font-weight: 400;
		font-size: clamp(1.45rem, 1.9vw, 1.75rem);
		line-height: 1.05;
		letter-spacing: -0.02em;
	}
	.order-tax {
		margin-top: 10px;
	}
</style>
