<script lang="ts">
	import { enhance } from '$app/forms';
	import { Mail, MessageCircle, Settings2, ShoppingCart, Timer, X } from '@lucide/svelte';
	import Chip from '$lib/components/admin/ui/Chip.svelte';
	import Drawer from '$lib/components/admin/ui/Drawer.svelte';
	import EmptyState from '$lib/components/admin/ui/EmptyState.svelte';
	import Field from '$lib/components/admin/ui/Field.svelte';
	import PageHeader from '$lib/components/admin/ui/PageHeader.svelte';
	import Tabs from '$lib/components/admin/ui/Tabs.svelte';
	import StatTile from '$lib/components/admin/StatTile.svelte';
	import Notice from '$lib/components/admin/Notice.svelte';
	import { submitter } from '$lib/components/admin/enhance';
	import { getToaster } from '$lib/components/admin/toast.svelte';
	import { CHECKOUT_STATUS, label } from '$lib/components/admin/labels';
	import { shortDateTime, timeAgo } from '$lib/components/admin/tone';
	import { formatInr } from '$lib/money';

	let { data, form } = $props();
	const toaster = getToaster();
	let settingsOpen = $state(false);

	const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : '—');
	let f = $derived(data.funnel);
	let whatsappReady = $derived(data.channels.find((c) => c.channel === 'whatsapp')?.configured ?? false);
	let emailReady = $derived(data.channels.find((c) => c.channel === 'email')?.configured ?? false);

	function minutesLeft(until: number) {
		return Math.max(0, Math.round((until - data.now) / 60_000));
	}
</script>

<svelte:head><title>Carts · Rootwear admin</title></svelte:head>

<div class="flex flex-col gap-6">
	<PageHeader title="Carts" description="Who is shopping now, who started checkout, and who left before paying.">
		{#snippet actions()}
			<div class="flex rounded-[10px] bg-q-muted p-0.5" role="group" aria-label="Period">
				<a href="?view={data.view}&days=7" class="rounded-[8px] px-3 py-1.5 text-[13px] {data.days === 7 ? 'bg-q-surface font-medium text-q-text shadow-[var(--q-shadow-active)]' : 'text-q-secondary'}">7 days</a>
				<a href="?view={data.view}&days=30" class="rounded-[8px] px-3 py-1.5 text-[13px] {data.days === 30 ? 'bg-q-surface font-medium text-q-text shadow-[var(--q-shadow-active)]' : 'text-q-secondary'}">30 days</a>
			</div>
			{#if data.canSettings}
				<button type="button" class="q-btn q-btn-secondary" onclick={() => (settingsOpen = true)}><Settings2 /> Reminders</button>
			{/if}
		{/snippet}
	</PageHeader>

	{#if form && 'error' in form && form.error}<Notice kind="error">{form.error}</Notice>{/if}

	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<StatTile label="Carts started" value={String(f.carts)} note="Anyone who added a piece" />
		<StatTile label="Reached checkout" value={String(f.checkouts)} note="{pct(f.checkouts, f.carts)} of carts" />
		<StatTile label="Paid" value={String(f.paid)} note="{pct(f.paid, f.checkouts)} of checkouts" />
		<StatTile label="Won back by reminders" value={String(f.recovered)} note={f.recovered ? `${formatInr(f.recoveredValue)} in orders` : 'No recovered orders yet'} />
	</div>

	<Tabs
		label="Cart views"
		tabs={[
			{ href: `/admin/carts?days=${data.days}`, label: 'Abandoned', count: data.counts.abandoned || null, exact: true },
			{ href: `/admin/carts?view=checkout&days=${data.days}`, label: 'In checkout', count: data.counts.checkout || null },
			{ href: `/admin/carts?view=live&days=${data.days}`, label: 'Live carts' }
		]}
	/>

	{#if data.view === 'live'}
		<p class="text-[13px] text-q-secondary">Carts touched in the last two days. Most are anonymous until checkout, so these are for watching demand, not for contacting.</p>
		{#if data.live.length === 0}
			<div class="q-card"><EmptyState icon={ShoppingCart} title="No carts right now" body="Carts appear here as soon as someone adds a piece." compact /></div>
		{:else}
			<div class="q-table-wrap">
				<table class="q-table">
					<thead><tr><th scope="col">In the cart</th><th scope="col">Who</th><th scope="col">Hold</th><th scope="col" class="num">Value</th><th scope="col" class="num">Last change</th></tr></thead>
					<tbody>
						{#each data.live as cart (cart.id)}
							<tr>
								<td>
									<div class="flex items-center gap-3">
										{#if cart.items[0]?.image}<img src={cart.items[0].image} alt="" class="size-10 flex-none rounded-[8px] bg-q-muted object-cover" />{/if}
										<div>
											{#each cart.items as item, i (i)}<p class="text-q-text">{item.quantity} × {item.name}{item.label ? ` (${item.label})` : ''}</p>{/each}
										</div>
									</div>
								</td>
								<td class="text-q-secondary">{cart.email ?? 'Anonymous'}</td>
								<td>
									{#if cart.heldUntil}
										<Chip label="{minutesLeft(cart.heldUntil)} min left" tone="info" />
									{:else}
										<Chip label="Hold lapsed" />
									{/if}
								</td>
								<td class="num">{formatInr(cart.value)}</td>
								<td class="num text-q-secondary">{timeAgo(cart.updatedAt, data.now)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	{:else}
		{@const rows = data.view === 'checkout' ? data.inCheckout : data.abandoned}
		{#if data.view === 'abandoned'}
			<p class="text-[13px] text-q-secondary">
				People who entered their details but did not pay before the payment window closed. A reminder links straight back to a cart with the same pieces, if they are still available.
				{#if data.settings.autoRecover}<strong class="text-q-text">Automatic reminders are on</strong> ({data.settings.delayMinutes} min after).{/if}
			</p>
		{/if}
		{#if rows.length === 0}
			<div class="q-card">
				<EmptyState
					icon={data.view === 'checkout' ? Timer : ShoppingCart}
					title={data.view === 'checkout' ? 'Nobody in checkout' : 'No abandoned checkouts'}
					body={data.view === 'checkout' ? 'Shoppers who have given their details and are paying appear here.' : 'Checkouts that were not paid in time appear here, ready for a reminder.'}
					compact
				/>
			</div>
		{:else}
			<div class="q-table-wrap">
				<table class="q-table">
					<thead>
						<tr>
							<th scope="col">Customer</th>
							<th scope="col">Pieces</th>
							<th scope="col">Status</th>
							<th scope="col" class="num">Value</th>
							<th scope="col" class="num">Started</th>
							{#if data.view === 'abandoned' && data.canRecover}<th scope="col"><span class="sr-only">Actions</span></th>{/if}
						</tr>
					</thead>
					<tbody>
						{#each rows as c (c.orderId)}
							{@const status = label(CHECKOUT_STATUS, c.status)}
							<tr>
								<td>
									<p class="text-q-text">{c.name}</p>
									<p class="text-[13px] text-q-secondary">{c.email}{c.phone ? ` · ${c.phone}` : ''}</p>
								</td>
								<td class="max-w-[280px]">
									{#each c.items as item, i (i)}<p class="truncate">{item.quantity} × {item.name}{item.label ? ` (${item.label})` : ''}</p>{/each}
								</td>
								<td>
									<Chip label={status.label} tone={status.tone} />
									{#if c.sentAt}<p class="mt-1 text-[12px] text-q-tertiary">{c.channels.join(' + ')} · {timeAgo(c.sentAt, data.now)}{c.sentBy && c.sentBy !== 'automatic' ? ` · ${c.sentBy}` : ''}</p>{/if}
									{#if c.laterOrderId}<a class="q-link text-[12px]" href="/admin/orders/{c.laterOrderId}">See their order</a>{/if}
								</td>
								<td class="num">{formatInr(c.total)}</td>
								<td class="num text-q-secondary" title={shortDateTime(c.createdAt)}>{timeAgo(c.createdAt, data.now)}</td>
								{#if data.view === 'abandoned' && data.canRecover}
									<td>
										{#if ['abandoned', 'reminded', 'clicked'].includes(c.status)}
											<div class="flex justify-end gap-1">
												<form method="POST" action="?/remind" use:enhance={submitter(toaster)}>
													<input type="hidden" name="orderId" value={c.orderId} />
													<input type="hidden" name="channels" value="email" />
													<button type="submit" class="q-btn q-btn-secondary q-btn-sm" disabled={!c.email} title={emailReady ? 'Email a reminder' : 'Email is not connected yet; it will be logged as not sent'}><Mail /> Email</button>
												</form>
												{#if c.phone}
													<form method="POST" action="?/remind" use:enhance={submitter(toaster)}>
														<input type="hidden" name="orderId" value={c.orderId} />
														<input type="hidden" name="channels" value="whatsapp" />
														<button type="submit" class="q-btn q-btn-secondary q-btn-sm" title={whatsappReady ? 'WhatsApp a reminder' : 'WhatsApp is not connected yet'}><MessageCircle /> WhatsApp</button>
													</form>
												{/if}
												<form method="POST" action="?/dismiss" use:enhance={submitter(toaster)}>
													<input type="hidden" name="orderId" value={c.orderId} />
													<button type="submit" class="q-btn q-btn-ghost q-btn-sm q-btn-icon" aria-label="Dismiss {c.name}"><X /></button>
												</form>
											</div>
										{/if}
									</td>
								{/if}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	{/if}
</div>

<Drawer bind:open={settingsOpen} title="Cart reminders" description="Send the reminder automatically, or only when someone clicks.">
	<form id="cart-settings" method="POST" action="?/settings" class="flex flex-col gap-5" use:enhance={submitter(toaster, { onSuccess: () => (settingsOpen = false) })}>
		<label class="flex items-start gap-3 rounded-[10px] border border-q-border p-3">
			<input type="checkbox" class="q-check mt-0.5" name="autoRecover" checked={data.settings.autoRecover} />
			<span class="flex flex-col gap-0.5">
				<span class="text-[14px] font-medium text-q-text">Remind automatically</span>
				<span class="text-[13px] leading-[18px] text-q-secondary">Once per checkout. Needs the cron at /api/cron/carts every 15 minutes.</span>
			</span>
		</label>
		<Field label="Wait before reminding (minutes)" id="cs-delay" help="An hour is usual. Too soon feels pushy.">
			{#snippet children({ describedBy })}<input id="cs-delay" name="delayMinutes" type="number" min="15" max="2880" class="q-input w-32" value={data.settings.delayMinutes} aria-describedby={describedBy} />{/snippet}
		</Field>
		<fieldset class="flex flex-col gap-2">
			<legend class="q-label mb-2">Send by</legend>
			<label class="flex items-center gap-2 text-[14px]"><input type="checkbox" class="q-check" name="channels" value="email" checked={data.settings.channels.includes('email')} /> Email</label>
			<label class="flex items-center gap-2 text-[14px]"><input type="checkbox" class="q-check" name="channels" value="whatsapp" checked={data.settings.channels.includes('whatsapp')} /> WhatsApp</label>
		</fieldset>
		<Notice kind="warning">
			Meta treats a WhatsApp cart reminder as marketing, which needs the shopper’s opt-in. Add a WhatsApp consent line to checkout before turning WhatsApp on here.
		</Notice>
	</form>
	{#snippet footer()}
		<button type="button" class="q-btn q-btn-secondary" onclick={() => (settingsOpen = false)}>Cancel</button>
		<button type="submit" form="cart-settings" class="q-btn q-btn-primary">Save</button>
	{/snippet}
</Drawer>
