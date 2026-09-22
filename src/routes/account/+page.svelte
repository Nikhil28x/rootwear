<script lang="ts">
	import Button from '$lib/components/ui/Button.svelte';
	import Eyebrow from '$lib/components/ui/Eyebrow.svelte';
	import Callout from '$lib/components/account/Callout.svelte';
	import Empty from '$lib/components/account/Empty.svelte';
	import PreOrderCard from '$lib/components/account/PreOrderCard.svelte';
	import RecordState from '$lib/components/account/RecordState.svelte';
	import { ORDER_COPY, shortDate } from '$lib/components/account/state-labels';
	import { formatInr } from '$lib/money';
	import { FIT_DISCLAIMER } from '$lib/drop/sizes';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let latest = $derived(data.latestOrder);
	let nothingYet = $derived(data.orderCount === 0 && data.outstandingCount === 0);

	const quickLinks = [
		{ href: '/account/orders', label: 'Orders' },
		{ href: '/account/pre-orders', label: 'Pre-orders' },
		{ href: '/account/addresses', label: 'Addresses' },
		{ href: '/account/notifications', label: 'Notifications' }
	];
</script>

<svelte:head>
	<title>Your account — Rootwear</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<Eyebrow tone="strong" class="text-forest/50">Account</Eyebrow>
<h1
	class="display mt-6 text-[clamp(2.8rem,6.4vw,5.4rem)] leading-[0.86] tracking-[-0.055em] text-forest"
>
	Your account.
</h1>

{#if data.outstandingCount > 0}
	<!--
		§08: an unpaid balance is the one thing here a customer can lose a piece
		by ignoring — a lapsed reservation is released to the waitlist. So it is
		announced at the top, before anything else on the page.
	-->
	<div class="mt-10 max-w-[64ch]">
		<Callout kind="error">
			{formatInr(data.outstanding)} is outstanding across
			{data.outstandingCount === 1 ? 'one pre-order' : `${data.outstandingCount} pre-orders`}. A
			piece whose balance is not cleared in time goes to the next person in the queue.
		</Callout>
	</div>
{/if}

{#if nothingYet}
	<div class="mt-14 max-w-[52rem]">
		<Empty title="Nothing here yet." actionHref="/drops" actionLabel="See the current drop">
			<p>
				This is where your orders, your reserved pieces and your saved addresses will appear. You
				never needed an account to buy from us, so it is empty until you do.
			</p>
		</Empty>
	</div>
{:else}
	<div class="mt-16 grid gap-16 xl:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] xl:gap-20">
		<div class="min-w-0">
			<section aria-labelledby="latest-order-title">
				<h2 id="latest-order-title" class="text-[10px] tracking-[0.28em] text-forest/45 uppercase">
					Most recent order
				</h2>

				{#if latest}
					{@const copy = ORDER_COPY[latest.state]}
					<article class="mt-6 border border-forest/20 px-6 py-7 sm:px-8">
						<div class="flex flex-wrap items-start justify-between gap-4">
							<div>
								<p class="display text-[clamp(1.6rem,2.8vw,2.2rem)] leading-[1.05] text-forest">
									{latest.orderNumber}
								</p>
								<p class="mt-2 text-xs text-forest/55">
									Placed {shortDate(latest.placedAt)} ·
									{latest.itemCount === 1 ? '1 piece' : `${latest.itemCount} pieces`}
								</p>
							</div>
							<RecordState label={copy.label} tone={copy.tone} />
						</div>

						<p class="mt-5 max-w-[52ch] text-sm leading-[1.8] text-forest/75">{copy.sentence}</p>

						<div
							class="mt-7 flex flex-wrap items-end justify-between gap-6 border-t border-forest/15 pt-6"
						>
							<p class="display text-[1.6rem] leading-none text-forest">
								{formatInr(latest.total)}
							</p>
							<div class="flex flex-wrap items-center gap-6">
								{#if latest.trackingRef}
									<p class="text-xs text-forest/60">
										{latest.courierName ?? 'Courier'} · {latest.trackingRef}
									</p>
								{/if}
								<Button href="/account/orders/{latest.orderNumber}" surface="light">
									Open this order
								</Button>
							</div>
						</div>
					</article>
				{:else}
					<div class="mt-6">
						<Empty title="No orders yet." actionHref="/drops" actionLabel="See the current drop">
							<p>
								Anything you buy — as a guest or signed in — appears here with its tracking
								reference once it is dispatched.
							</p>
						</Empty>
					</div>
				{/if}
			</section>

			{#if data.preOrders.length > 0}
				<section class="mt-16" aria-labelledby="needs-you-title">
					<h2 id="needs-you-title" class="text-[10px] tracking-[0.28em] text-forest/45 uppercase">
						Waiting on you
					</h2>
					<p class="mt-4 max-w-[52ch] text-xs leading-relaxed text-forest/55">
						{FIT_DISCLAIMER}
					</p>
					<div class="mt-6 flex flex-col gap-8">
						{#each data.preOrders as record (record.id)}
							<PreOrderCard {record} />
						{/each}
					</div>
					{#if data.outstandingCount > data.preOrders.length}
						<p class="mt-8">
							<a
								class="text-[10px] tracking-[0.2em] text-forest uppercase underline underline-offset-4"
								href="/account/pre-orders"
							>
								See all pre-orders
							</a>
						</p>
					{/if}
				</section>
			{/if}
		</div>

		<aside aria-labelledby="quick-links-title">
			<h2 id="quick-links-title" class="text-[10px] tracking-[0.28em] text-forest/45 uppercase">
				Everything else
			</h2>
			<ul class="mt-6 flex list-none flex-col gap-px border-t border-forest/15 p-0">
				{#each quickLinks as link (link.href)}
					<li class="border-b border-forest/15">
						<a
							href={link.href}
							class="flex items-baseline justify-between gap-4 py-4 text-sm text-forest/80 transition-colors hover:text-forest"
						>
							<span class="text-[10px] tracking-[0.2em] uppercase">{link.label}</span>
							<span class="display text-[1.1rem] leading-none text-forest">
								{#if link.href === '/account/orders'}{data.orderCount}{/if}
								{#if link.href === '/account/pre-orders'}{data.outstandingCount}{/if}
								{#if link.href === '/account/addresses'}{data.addressCount}{/if}
								{#if link.href === '/account/notifications'}{data.notifyCount +
										data.waitlistCount}{/if}
							</span>
						</a>
					</li>
				{/each}
			</ul>
			<p class="mt-6 max-w-[36ch] text-xs leading-[1.9] text-forest/50">
				The figure beside pre-orders counts balances still to clear, not pieces reserved.
			</p>
		</aside>
	</div>
{/if}
