<script lang="ts">
	import { enhance } from '$app/forms';
	import { Mail, MessageCircle, Send } from '@lucide/svelte';
	import Chip from '$lib/components/admin/ui/Chip.svelte';
	import Field from '$lib/components/admin/ui/Field.svelte';
	import PageHeader from '$lib/components/admin/ui/PageHeader.svelte';
	import Section from '$lib/components/admin/ui/Section.svelte';
	import Timeline from '$lib/components/admin/ui/Timeline.svelte';
	import Notice from '$lib/components/admin/Notice.svelte';
	import { submitter } from '$lib/components/admin/enhance';
	import { getToaster } from '$lib/components/admin/toast.svelte';
	import { MESSAGE_STATUS, RESERVATION_STATE, label } from '$lib/components/admin/labels';
	import { relativeDays, shortDateTime } from '$lib/components/admin/tone';
	import { formatInr } from '$lib/money';
	import { DEPOSIT_PERCENT_CONFIRMED } from '$lib/config/commerce';

	let { data, form } = $props();
	const toaster = getToaster();

	let r = $derived(data.reservation);
	let st = $derived(label(RESERVATION_STATE, r.state));
	let overdue = $derived(
		r.state === 'balance_due' && r.balanceDueBy !== null && r.balanceDueBy < data.now
	);
	let canRequestBalance = $derived(r.state === 'reserved' || r.state === 'balance_due');
</script>

<svelte:head
	><title
		>{r.pieceNumber ? `No. ${r.pieceNumber}` : 'Pre-order'} · Pre-orders · Rootwear admin</title
	></svelte:head
>

<div class="flex flex-col gap-8">
	<PageHeader
		title={r.pieceNumber === null ? 'No piece given yet' : `${r.dropName} — No. ${r.pieceNumber}`}
		back={{ href: '/admin/reservations', label: 'Pre-orders' }}
		description="{r.email} · {r.sku} · opened {shortDateTime(r.createdAt)}"
	>
		{#snippet meta()}
			<Chip label={st.label} tone={st.tone} />
			{#if overdue}<Chip label="Balance overdue" tone="danger" />{/if}
		{/snippet}
		{#snippet actions()}
			{#if r.orderId}<a class="q-btn q-btn-secondary" href="/admin/orders/{r.orderId}"
					>Order {r.orderNumber}</a
				>{/if}
		{/snippet}
	</PageHeader>

	{#if form && 'error' in form && form.error}<Notice kind="error">{form.error}</Notice>{/if}

	<div class="grid grid-cols-1 gap-10 xl:grid-cols-[minmax(0,1fr)_360px]">
		<div class="flex min-w-0 flex-col gap-10">
			<Section
				title="What was agreed"
				description="Copied onto the record when the reservation was opened; later configuration changes cannot rewrite it."
			>
				<dl class="q-card grid grid-cols-[160px_1fr] gap-x-4 gap-y-2 p-4 text-[14px]">
					<dt class="text-q-secondary">Locked price</dt>
					<dd class="tabular-nums">{formatInr(r.lockedPrice)}</dd>
					<dt class="text-q-secondary">Deposit</dt>
					<dd class="tabular-nums">{formatInr(r.deposit)}</dd>
					<dt class="text-q-secondary">Balance</dt>
					<dd class="tabular-nums">{formatInr(r.balance)}</dd>
					<dt class="text-q-secondary">Balance due</dt>
					<dd>
						{r.balanceDueBy
							? `${shortDateTime(r.balanceDueBy)} (${relativeDays(r.balanceDueBy, data.now)})`
							: 'Not asked for yet'}
					</dd>
					<dt class="text-q-secondary">Cancellation</dt>
					<dd>{r.cancellationRule}</dd>
				</dl>
				{#if !DEPOSIT_PERCENT_CONFIRMED}<p class="q-help">
						The deposit share is not yet confirmed in writing, so no percentage is shown anywhere a
						customer can see.
					</p>{/if}
			</Section>

			<Section title="Payments">
				{#if r.payments.length === 0 && r.refunds.length === 0}
					<p class="text-[14px] text-q-secondary">No payments recorded.</p>
				{:else}
					<div class="q-table-wrap">
						<table class="q-table">
							<thead
								><tr
									><th scope="col">Payment</th><th scope="col">State</th><th scope="col" class="num"
										>Amount</th
									><th scope="col" class="num">When</th></tr
								></thead
							>
							<tbody>
								{#each r.payments as p (p.id)}
									<tr>
										<td
											>{p.kind === 'deposit'
												? 'Deposit'
												: p.kind === 'balance'
													? 'Balance'
													: 'Order'}<span class="q-mono block text-[12px] text-q-tertiary"
												>{p.gatewayPaymentId ?? '—'}</span
											></td
										>
										<td
											><Chip
												label={p.state}
												tone={p.state === 'captured'
													? 'success'
													: p.state === 'failed'
														? 'danger'
														: 'neutral'}
											/></td
										>
										<td class="num">{formatInr(p.amount)}</td>
										<td class="num text-q-secondary">{shortDateTime(p.createdAt)}</td>
									</tr>
								{/each}
								{#each r.refunds as f (f.id)}
									<tr>
										<td>Refund · {f.reason.replace('_', ' ')}</td>
										<td
											><Chip
												label={f.state}
												tone={f.state === 'processed'
													? 'success'
													: f.state === 'failed'
														? 'danger'
														: 'warning'}
											/></td
										>
										<td class="num">−{formatInr(f.amount)}</td>
										<td class="num text-q-secondary">{shortDateTime(f.createdAt)}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</Section>

			<Section
				title="History"
				description="Rebuilt from the payment ledger and the record's own timestamps."
			>
				<Timeline
					events={[...r.timeline]
						.reverse()
						.map((step) => ({ at: step.at, title: step.label, detail: step.detail }))}
				/>
			</Section>
		</div>

		<aside class="flex flex-col gap-8">
			<Section
				title="Balance link"
				description="Asks for the balance and sets its due date. A balance that lapses releases the piece to the waitlist."
			>
				{#if canRequestBalance && data.canEdit}
					<form
						method="POST"
						action="?/balanceLink"
						class="q-card flex flex-col gap-4 p-4"
						use:enhance={submitter(toaster)}
					>
						<Field label="Days to pay" id="bl-days">
							{#snippet children({ describedBy })}<input
									id="bl-days"
									name="days"
									type="number"
									min="1"
									max="60"
									value="7"
									class="q-input w-24"
									aria-describedby={describedBy}
								/>{/snippet}
						</Field>
						<button type="submit" class="q-btn q-btn-primary"
							><Send />
							{r.state === 'balance_due' ? 'Send the link again' : 'Send balance link'}</button
						>
						<p class="q-help">By email, and WhatsApp when their pre-order signup gave a number.</p>
					</form>
				{:else}
					<p class="text-[14px] text-q-secondary">
						{canRequestBalance
							? 'You can see this pre-order but not ask for payment.'
							: 'Not available in this state.'}
					</p>
				{/if}
			</Section>
			<Section title="Messages">
				{#if data.messages.length === 0}
					<p class="text-[14px] text-q-secondary">Nothing sent yet.</p>
				{:else}
					<ul class="flex flex-col gap-2 text-[14px]">
						{#each data.messages as m (m.id)}
							{@const ms = label(MESSAGE_STATUS, m.status)}
							<li class="flex items-center justify-between gap-2">
								<span class="flex min-w-0 items-center gap-2">
									{#if m.channel === 'email'}<Mail
											size={16}
											strokeWidth={1.5}
											class="flex-none text-q-tertiary"
										/>{:else}<MessageCircle
											size={16}
											strokeWidth={1.5}
											class="flex-none text-q-tertiary"
										/>{/if}
									<span class="truncate">{m.subject ?? m.body}</span>
								</span>
								<Chip label={ms.label} tone={ms.tone} />
							</li>
						{/each}
					</ul>
				{/if}
			</Section>
		</aside>
	</div>
</div>
