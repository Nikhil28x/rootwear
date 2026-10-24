<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		Ban,
		FileText,
		Mail,
		MessageCircle,
		PackageCheck,
		Pencil,
		Printer,
		RotateCcw,
		Tag,
		Truck,
		Undo2,
		Wallet,
		X
	} from '@lucide/svelte';
	import Chip from '$lib/components/admin/ui/Chip.svelte';
	import Drawer from '$lib/components/admin/ui/Drawer.svelte';
	import Field from '$lib/components/admin/ui/Field.svelte';
	import PageHeader from '$lib/components/admin/ui/PageHeader.svelte';
	import Section from '$lib/components/admin/ui/Section.svelte';
	import Timeline from '$lib/components/admin/ui/Timeline.svelte';
	import Notice from '$lib/components/admin/Notice.svelte';
	import { submitter } from '$lib/components/admin/enhance';
	import { getToaster } from '$lib/components/admin/toast.svelte';
	import {
		MESSAGE_STATUS,
		ORDER_STATE,
		REFUND_STATE,
		RETURN_STATUS,
		label
	} from '$lib/components/admin/labels';
	import { shortDateTime, timeAgo } from '$lib/components/admin/tone';
	import { formatInr, paise } from '$lib/money';

	let { data, form } = $props();
	const toaster = getToaster();

	let order = $derived(data.order);
	let status = $derived(label(ORDER_STATE, order.state));
	let panel = $state<null | 'dispatch' | 'cancel' | 'refund' | 'return' | 'address'>(null);
	const close = () => (panel = null);

	const COURIERS = [
		'Delhivery',
		'Blue Dart',
		'DTDC',
		'Xpressbees',
		'Ecom Express',
		'Shadowfax',
		'India Post',
		'Professional Couriers'
	];

	const steps = $derived([
		{ label: 'Placed', at: order.createdAt },
		{ label: 'Packed', at: order.packedAt },
		{ label: 'Dispatched', at: order.dispatchedAt },
		{ label: 'Delivered', at: order.deliveredAt }
	]);

	let rupees = (value: number) => (value / 100).toFixed(value % 100 ? 2 : 0);
	let canCancel = $derived(
		['pending_payment', 'paid', 'packed'].includes(order.state) && !order.isPreOrder
	);
	let canReturn = $derived(['dispatched', 'delivered'].includes(order.state));
	let invoice = $derived(order.documents.find((d) => d.kind === 'invoice') ?? null);
	let returnOutcome = $state('refund');
	let lineLabel = $derived(
		new Map(order.lines.map((l) => [l.id, `${l.name}${l.variant ? ` (${l.variant})` : ''}`]))
	);

	let activity = $derived(
		[
			...data.history.map((h) => ({
				at: h.occurredAt,
				title: h.action.charAt(0).toUpperCase() + h.action.slice(1),
				detail: typeof h.detail?.reason === 'string' ? (h.detail.reason as string) : null,
				actor: h.actor
			})),
			...order.messages.map((m) => ({
				at: m.createdAt,
				title: `${m.channel === 'email' ? 'Email' : 'WhatsApp'}: ${m.subject ?? (m.body.length > 60 ? m.body.slice(0, 60) + '…' : m.body)}`,
				detail: label(MESSAGE_STATUS, m.status).label + (m.lastError ? ` — ${m.lastError}` : ''),
				actor: m.createdBy === 'system' ? null : m.createdBy
			})),
			{ at: order.createdAt, title: 'Order placed', detail: null, actor: null }
		].sort((a, b) => b.at - a.at)
	);

	let whatsapp = $derived(
		order.phone
			? `https://wa.me/${order.phone.replace(/\D/g, '').replace(/^(\d{10})$/, '91$1')}`
			: null
	);
</script>

<svelte:head><title>{order.number} · Orders · Rootwear admin</title></svelte:head>

<div class="flex flex-col gap-8">
	<PageHeader
		title={order.number}
		back={{ href: '/admin/orders', label: 'Orders' }}
		description="Placed {shortDateTime(order.createdAt)} · {timeAgo(order.createdAt)}"
	>
		{#snippet meta()}
			<Chip label={status.label} tone={status.tone} />
			{#if order.isPreOrder}<Chip label="Pre-order" dot={false} />{/if}
		{/snippet}
		{#snippet actions()}
			{#if invoice}
				<a
					class="q-btn q-btn-secondary"
					href="/admin/invoices/{invoice.id}"
					target="_blank"
					rel="noopener"><FileText /> Invoice</a
				>
			{/if}
			{#if data.can.edit}
				{#if order.state === 'paid'}
					<form method="POST" action="?/pack" use:enhance={submitter(toaster)}>
						<button type="submit" class="q-btn q-btn-primary"><PackageCheck /> Mark packed</button>
					</form>
				{:else if order.state === 'packed'}
					<button type="button" class="q-btn q-btn-primary" onclick={() => (panel = 'dispatch')}
						><Truck /> Dispatch</button
					>
				{:else if order.state === 'dispatched'}
					<form method="POST" action="?/deliver" use:enhance={submitter(toaster)}>
						<input type="hidden" name="notify" value="on" />
						<button type="submit" class="q-btn q-btn-primary"
							><PackageCheck /> Mark delivered</button
						>
					</form>
				{/if}
			{/if}
		{/snippet}
	</PageHeader>

	{#if form && 'error' in form && form.error}<Notice kind="error">{form.error}</Notice>{/if}

	<div class="grid gap-10 xl:grid-cols-[minmax(0,1fr)_360px]">
		<div class="flex min-w-0 flex-col gap-10">
			<!-- Items and money -->
			<Section title="Items">
				<div class="q-card q-divide">
					{#each order.lines as line (line.id)}
						<div class="flex items-center gap-4 p-4">
							{#if line.image}
								<img
									src={line.image}
									alt=""
									class="size-14 flex-none rounded-[10px] bg-q-muted object-cover"
								/>
							{:else}
								<span class="size-14 flex-none rounded-[10px] bg-q-muted"></span>
							{/if}
							<div class="flex min-w-0 flex-1 flex-col gap-0.5">
								<p class="text-[14px] font-medium text-q-text">{line.name}</p>
								<p class="text-[13px] text-q-secondary">
									{[
										line.variant,
										line.sku,
										line.pieceNumber ? `Piece No. ${line.pieceNumber}` : null
									]
										.filter(Boolean)
										.join(' · ')}
								</p>
							</div>
							<p class="text-right text-[14px] tabular-nums">
								<span class="text-q-secondary">{line.quantity} × {formatInr(line.unitPrice)}</span>
								<span class="block font-medium text-q-text">{formatInr(line.lineTotal)}</span>
							</p>
						</div>
					{/each}
					<dl class="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 p-4 text-[14px] tabular-nums">
						<dt class="text-q-secondary">Subtotal</dt>
						<dd class="text-right">{formatInr(order.subtotal)}</dd>
						{#if Number(order.discount)}<dt class="text-q-secondary">Discount</dt>
							<dd class="text-right">−{formatInr(order.discount)}</dd>{/if}
						<dt class="text-q-secondary">Shipping</dt>
						<dd class="text-right">
							{Number(order.shipping) ? formatInr(order.shipping) : 'Free'}
						</dd>
						<dt class="font-medium text-q-text">Total</dt>
						<dd class="text-right font-medium text-q-text">{formatInr(order.total)}</dd>
						<dt class="text-q-secondary">Paid</dt>
						<dd class="text-right">{formatInr(order.captured)}</dd>
						{#if Number(order.refunded)}<dt class="text-q-secondary">Refunded</dt>
							<dd class="text-right">−{formatInr(order.refunded)}</dd>{/if}
					</dl>
				</div>
			</Section>

			<!-- Fulfilment -->
			{#if !['pending_payment', 'cancelled'].includes(order.state)}
				<Section title="Fulfilment">
					<div class="q-card flex flex-col gap-4 p-4">
						<ol class="grid grid-cols-4 gap-2">
							{#each steps as step, i (step.label)}
								<li class="flex flex-col gap-1.5">
									<span class="h-1 rounded-full {step.at ? 'bg-q-accent' : 'bg-q-muted'}"></span>
									<span
										class="text-[13px] font-medium {step.at ? 'text-q-text' : 'text-q-tertiary'}"
										>{step.label}</span
									>
									<span class="text-[12px] text-q-tertiary"
										>{step.at ? shortDateTime(step.at) : i === 0 ? '' : '—'}</span
									>
								</li>
							{/each}
						</ol>
						{#if order.trackingRef}
							<p class="text-[14px] text-q-body">
								<Truck size={16} strokeWidth={1.5} class="mr-1 inline text-q-tertiary" />
								{order.courierName} · <span class="q-mono">{order.trackingRef}</span>
								{#if data.can.edit && order.state === 'dispatched'}
									<button
										type="button"
										class="q-link ml-2 text-[13px]"
										onclick={() => (panel = 'dispatch')}>Change</button
									>
								{/if}
							</p>
						{/if}
						{#if data.can.edit}
							<div class="flex flex-wrap gap-2">
								{#if order.state === 'paid'}
									<button
										type="button"
										class="q-btn q-btn-secondary q-btn-sm"
										onclick={() => (panel = 'dispatch')}><Truck /> Dispatch without packing</button
									>
								{/if}
								{#if ['packed', 'dispatched', 'delivered'].includes(order.state)}
									<form method="POST" action="?/undo" use:enhance={submitter(toaster)}>
										<button type="submit" class="q-btn q-btn-ghost q-btn-sm"
											><Undo2 /> Undo last step</button
										>
									</form>
								{/if}
								<a
									class="q-btn q-btn-ghost q-btn-sm"
									href="/admin/orders/print?kind=packing&ids={order.id}"
									target="_blank"
									rel="noopener"><Printer /> Packing slip</a
								>
								<a
									class="q-btn q-btn-ghost q-btn-sm"
									href="/admin/orders/print?kind=label&ids={order.id}"
									target="_blank"
									rel="noopener"><Tag /> Label</a
								>
							</div>
						{/if}
					</div>
				</Section>
			{/if}

			{#if order.state === 'cancelled'}
				<Notice kind="info"
					>Cancelled {order.cancelledAt ? shortDateTime(order.cancelledAt) : ''}{order.cancelReason
						? ` — ${order.cancelReason}`
						: ''}.</Notice
				>
			{/if}

			<!-- Returns -->
			{#if order.returns.length || canReturn}
				<Section title="Returns">
					{#snippet actions()}
						{#if canReturn && data.can.edit}
							<button
								type="button"
								class="q-btn q-btn-secondary q-btn-sm"
								onclick={() => (panel = 'return')}><RotateCcw /> Record a return</button
							>
						{/if}
					{/snippet}
					{#if order.returns.length === 0}
						<p class="text-[14px] text-q-secondary">
							No returns. Returns are for defects; a size exchange is recorded the same way.
						</p>
					{:else}
						<div class="flex flex-col gap-3">
							{#each order.returns as ret (ret.id)}
								{@const rs = label(RETURN_STATUS, ret.status)}
								<div class="q-card flex flex-col gap-3 p-4">
									<div class="flex flex-wrap items-center gap-2">
										<Chip label={rs.label} tone={rs.tone} />
										<span class="text-[13px] text-q-secondary">
											{data.returnReasons.find((r) => r.value === ret.reason)?.label ?? ret.reason} ·
											{ret.outcome === 'exchange'
												? `Exchange for ${ret.exchangeLabel ?? '—'}`
												: ret.outcome === 'refund'
													? 'Refund'
													: ret.outcome === 'repair'
														? 'Repair'
														: 'No action'}
											· opened {timeAgo(ret.createdAt)}
										</span>
									</div>
									<ul class="text-[14px] text-q-body">
										{#each ret.lines as line (line.orderLineId)}<li>
												{line.quantity} × {lineLabel.get(line.orderLineId) ?? 'item'}
											</li>{/each}
									</ul>
									{#if ret.detail}<p class="text-[13px] text-q-secondary">{ret.detail}</p>{/if}
									{#if ret.trackingRef}<p class="text-[13px] text-q-secondary">
											Replacement sent: {ret.courierName}
											{ret.trackingRef}
										</p>{/if}
									{#if data.can.edit && ret.status === 'requested'}
										<form
											method="POST"
											action="?/receiveReturn"
											class="flex flex-wrap items-center gap-3"
											use:enhance={submitter(toaster)}
										>
											<input type="hidden" name="returnId" value={ret.id} />
											<label class="flex items-center gap-2 text-[14px]"
												><input
													type="checkbox"
													class="q-check"
													name="restock"
													checked={ret.reason === 'size_exchange'}
												/> Fit to sell again — put back in stock</label
											>
											<button type="submit" class="q-btn q-btn-secondary q-btn-sm"
												>Mark received</button
											>
											<button
												type="submit"
												formaction="?/rejectReturn"
												class="q-btn q-btn-ghost q-btn-sm">Reject</button
											>
										</form>
									{:else if ret.status === 'received'}
										<form
											method="POST"
											action="?/completeReturn"
											class="flex flex-wrap items-end gap-2"
											use:enhance={submitter(toaster)}
										>
											<input type="hidden" name="returnId" value={ret.id} />
											<input type="hidden" name="notify" value="on" />
											{#if ret.outcome === 'refund'}
												{#if data.can.refund}
													<label class="flex flex-col gap-1.5"
														><span class="q-label">Refund (₹)</span>
														<input
															name="refundAmount"
															inputmode="decimal"
															class="q-input w-32"
															value={rupees(Number(order.refundable))}
														/>
													</label>
													<button type="submit" class="q-btn q-btn-primary"
														><Wallet /> Refund and close</button
													>
												{:else}
													<p class="text-[13px] text-q-secondary">
														Someone with refund permission closes this one.
													</p>
												{/if}
											{:else if ret.outcome === 'exchange'}
												<label class="flex flex-col gap-1.5"
													><span class="q-label">Courier</span>
													<input name="courier" list="couriers" class="q-input w-40" />
												</label>
												<label class="flex flex-col gap-1.5"
													><span class="q-label">Tracking</span>
													<input name="tracking" class="q-input q-mono w-44" />
												</label>
												<button type="submit" class="q-btn q-btn-primary"
													><Truck /> Send replacement</button
												>
											{:else}
												<button type="submit" class="q-btn q-btn-secondary">Close return</button>
											{/if}
										</form>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				</Section>
			{/if}

			<!-- Payments -->
			<Section title="Payments">
				{#snippet actions()}
					{#if data.can.refund}
						{#if canCancel}
							<button
								type="button"
								class="q-btn q-btn-danger-ghost q-btn-sm"
								onclick={() => (panel = 'cancel')}><Ban /> Cancel order</button
							>
						{/if}
						{#if Number(order.refundable) > 0}
							<button
								type="button"
								class="q-btn q-btn-secondary q-btn-sm"
								onclick={() => (panel = 'refund')}><Wallet /> Refund</button
							>
						{/if}
					{/if}
				{/snippet}
				{#if order.payments.length === 0}
					<p class="text-[14px] text-q-secondary">No payment recorded yet.</p>
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
								{#each order.payments as payment (payment.id)}
									<tr>
										<td
											>{payment.kind === 'order'
												? 'Order'
												: payment.kind === 'deposit'
													? 'Deposit'
													: 'Balance'}<span class="q-mono block text-[12px] text-q-tertiary"
												>{payment.gatewayPaymentId ?? '—'}</span
											></td
										>
										<td
											><Chip
												label={payment.state}
												tone={payment.state === 'captured'
													? 'success'
													: payment.state === 'failed'
														? 'danger'
														: 'neutral'}
											/></td
										>
										<td class="num">{formatInr(payment.amount)}</td>
										<td class="num text-q-secondary">{shortDateTime(payment.createdAt)}</td>
									</tr>
								{/each}
								{#each order.refunds as r (r.id)}
									{@const rs = label(REFUND_STATE, r.state)}
									<tr>
										<td
											>Refund · {r.reason}{#if r.note}<span
													class="block text-[12px] text-q-tertiary">{r.note}</span
												>{/if}</td
										>
										<td><Chip label={rs.label} tone={rs.tone} /></td>
										<td class="num">−{formatInr(r.amount)}</td>
										<td class="num text-q-secondary"
											>{shortDateTime(r.createdAt)}{#if r.createdBy}<span class="block text-[12px]"
													>{r.createdBy}</span
												>{/if}</td
										>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</Section>

			<!-- Activity -->
			<Section title="Activity" description="Notes are for the team and never reach the customer.">
				{#if data.can.edit}
					<form
						method="POST"
						action="?/note"
						class="flex flex-col gap-2"
						use:enhance={submitter(toaster, { reset: true })}
					>
						<label for="o-note" class="sr-only">Add a note</label>
						<textarea
							id="o-note"
							name="body"
							class="q-textarea min-h-[64px]"
							placeholder="Add a note for the team…"
							required></textarea>
						<div>
							<button type="submit" class="q-btn q-btn-secondary q-btn-sm">Add note</button>
						</div>
					</form>
				{/if}
				{#if order.notes.length}
					<ul class="flex flex-col gap-2">
						{#each order.notes as note (note.id)}
							<li class="rounded-[10px] bg-q-warning-tint px-4 py-3">
								<p class="text-[14px] whitespace-pre-wrap text-q-body">{note.body}</p>
								<div class="mt-1 flex items-center justify-between text-[12px] text-q-tertiary">
									<span>{note.author} · {timeAgo(note.at)}</span>
									{#if note.author === data.me && data.can.edit}
										<form method="POST" action="?/deleteNote" use:enhance={submitter(toaster)}>
											<input type="hidden" name="noteId" value={note.id} />
											<button type="submit" class="underline underline-offset-2 hover:text-q-text"
												>Delete</button
											>
										</form>
									{/if}
								</div>
							</li>
						{/each}
					</ul>
				{/if}
				<Timeline events={activity} />
			</Section>
		</div>

		<aside class="flex flex-col gap-8">
			<Section title="Customer">
				<div class="q-card flex flex-col gap-2 p-4 text-[14px]">
					<p class="font-medium text-q-text">{order.shipTo.name}</p>
					<a class="q-link w-fit break-all" href="mailto:{order.email}">{order.email}</a>
					{#if order.phone}
						<p class="flex items-center gap-3">
							<a class="q-link" href="tel:{order.phone}">{order.phone}</a>
							{#if whatsapp}<a
									class="inline-flex items-center gap-1 text-[13px] text-q-secondary hover:text-q-text"
									href={whatsapp}
									target="_blank"
									rel="noopener"><MessageCircle size={14} strokeWidth={1.5} /> WhatsApp</a
								>{/if}
						</p>
					{/if}
					<p class="text-[13px] text-q-secondary">
						{order.otherOrders
							? `${order.otherOrders} other order${order.otherOrders === 1 ? '' : 's'}`
							: 'First order'}
						{#if order.otherOrders}· <a
								class="q-link"
								href="/admin/orders?view=all&q={encodeURIComponent(order.email)}">See all</a
							>{/if}
					</p>
				</div>
			</Section>

			<Section title="Ship to">
				{#snippet actions()}
					{#if data.can.edit && ['pending_payment', 'paid', 'packed'].includes(order.state)}
						<button
							type="button"
							class="q-btn q-btn-ghost q-btn-sm"
							onclick={() => (panel = 'address')}><Pencil /> Edit</button
						>
					{/if}
				{/snippet}
				<address class="q-card p-4 text-[14px] leading-[22px] text-q-body not-italic">
					{order.shipTo.name}<br />
					{order.shipTo.line1}<br />
					{#if order.shipTo.line2}{order.shipTo.line2}<br />{/if}
					{order.shipTo.city}
					{order.shipTo.pincode}<br />
					{order.shipTo.state}<br />
					{order.shipTo.phone}
				</address>
				{#if order.customerNote}
					<div class="rounded-[10px] bg-q-muted p-3 text-[14px]">
						<p class="text-[12px] font-medium text-q-tertiary">Note from the customer</p>
						<p class="whitespace-pre-wrap text-q-body">{order.customerNote}</p>
					</div>
				{/if}
			</Section>

			<Section title="Documents">
				<ul class="q-card q-divide">
					{#each order.documents as doc (doc.id)}
						<li class="flex items-center justify-between gap-3 p-3 pl-4">
							<div>
								<p class="q-mono text-[13px] text-q-text">{doc.number}</p>
								<p class="text-[12px] text-q-tertiary">
									{doc.kind === 'invoice' ? 'Invoice' : 'Credit note'} · {formatInr(
										paise(doc.totals.total)
									)}
								</p>
							</div>
							<a
								class="q-btn q-btn-ghost q-btn-sm"
								href="/admin/invoices/{doc.id}"
								target="_blank"
								rel="noopener"><Printer /> Print</a
							>
						</li>
					{:else}
						<li class="flex items-center justify-between gap-3 p-4 text-[14px] text-q-secondary">
							No invoice yet.
							{#if !['pending_payment', 'cancelled'].includes(order.state)}
								<form method="POST" action="?/invoice" use:enhance={submitter(toaster)}>
									<button type="submit" class="q-btn q-btn-secondary q-btn-sm">Issue invoice</button
									>
								</form>
							{/if}
						</li>
					{/each}
				</ul>
			</Section>

			<Section title="Messages to the customer">
				{#if order.messages.length}
					<ul class="flex flex-col gap-2 text-[14px]">
						{#each order.messages as m (m.id)}
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
				{:else}
					<p class="text-[14px] text-q-secondary">Nothing sent yet.</p>
				{/if}
				{#if data.can.edit && !['pending_payment', 'cancelled'].includes(order.state)}
					<form method="POST" action="?/resend" class="flex gap-2" use:enhance={submitter(toaster)}>
						<label for="o-resend" class="sr-only">Message</label>
						<select id="o-resend" name="event" class="q-select q-select-sm">
							<option value="confirmed">Order confirmation</option>
							{#if order.trackingRef}<option value="dispatched">Dispatch update</option>{/if}
							{#if order.state === 'delivered'}<option value="delivered">Delivered</option>{/if}
						</select>
						<button type="submit" class="q-btn q-btn-secondary q-btn-sm">Send again</button>
					</form>
				{/if}
			</Section>
		</aside>
	</div>
</div>

<datalist id="couriers"
	>{#each COURIERS as c (c)}<option value={c}></option>{/each}</datalist
>

<!-- Dispatch -->
<Drawer
	open={panel === 'dispatch'}
	onclose={close}
	title="Dispatch {order.number}"
	description="The customer gets the tracking number by email and WhatsApp."
>
	<form
		id="dispatch-form"
		method="POST"
		action="?/dispatch"
		class="flex flex-col gap-4"
		use:enhance={submitter(toaster, { onSuccess: close })}
	>
		<Field label="Courier" id="dp-courier">
			{#snippet children({ describedBy })}<input
					id="dp-courier"
					name="courier"
					list="couriers"
					class="q-input"
					value={order.courierName ?? ''}
					required
					aria-describedby={describedBy}
				/>{/snippet}
		</Field>
		<Field label="Tracking number" id="dp-tracking">
			{#snippet children({ describedBy })}<input
					id="dp-tracking"
					name="tracking"
					class="q-input q-mono"
					value={order.trackingRef ?? ''}
					required
					aria-describedby={describedBy}
				/>{/snippet}
		</Field>
		<label class="flex items-center gap-2 text-[14px]"
			><input type="checkbox" class="q-check" name="notify" checked /> Tell the customer</label
		>
	</form>
	{#snippet footer()}
		<button type="button" class="q-btn q-btn-secondary" onclick={close}>Cancel</button>
		<button type="submit" form="dispatch-form" class="q-btn q-btn-primary"
			><Truck /> Mark dispatched</button
		>
	{/snippet}
</Drawer>

<!-- Cancel -->
<Drawer
	open={panel === 'cancel'}
	onclose={close}
	title="Cancel {order.number}"
	description="The pieces go back on sale. This cannot be undone."
>
	<form
		id="cancel-form"
		method="POST"
		action="?/cancel"
		class="flex flex-col gap-4"
		use:enhance={submitter(toaster, { onSuccess: close })}
	>
		<Field label="Why" id="cn-reason" help="Saved on the order and in the audit log.">
			{#snippet children({ describedBy })}<input
					id="cn-reason"
					name="reason"
					class="q-input"
					placeholder="Customer asked to cancel"
					required
					aria-describedby={describedBy}
				/>{/snippet}
		</Field>
		{#if Number(order.refundable) > 0}
			<label class="flex items-center gap-2 text-[14px]"
				><input type="checkbox" class="q-check" name="refund" checked /> Refund {formatInr(
					order.refundable
				)} to the customer</label
			>
			<label class="flex items-center gap-2 text-[14px]"
				><input type="checkbox" class="q-check" name="notify" checked /> Email them about the refund</label
			>
		{/if}
	</form>
	{#snippet footer()}
		<button type="button" class="q-btn q-btn-secondary" onclick={close}>Keep order</button>
		<button type="submit" form="cancel-form" class="q-btn q-btn-danger"><Ban /> Cancel order</button
		>
	{/snippet}
</Drawer>

<!-- Refund -->
<Drawer
	open={panel === 'refund'}
	onclose={close}
	title="Refund {order.number}"
	description="Sent back to the original payment method. A credit note is issued."
>
	<form
		id="refund-form"
		method="POST"
		action="?/refund"
		class="flex flex-col gap-4"
		use:enhance={submitter(toaster, { onSuccess: close })}
	>
		<Field label="Amount (₹)" id="rf-amount" help="Up to {formatInr(order.refundable)}.">
			{#snippet children({ describedBy })}<input
					id="rf-amount"
					name="amount"
					inputmode="decimal"
					class="q-input tabular-nums"
					value={rupees(Number(order.refundable))}
					required
					aria-describedby={describedBy}
				/>{/snippet}
		</Field>
		<Field label="Reason" id="rf-reason">
			{#snippet children({ describedBy })}
				<select id="rf-reason" name="reason" class="q-select" aria-describedby={describedBy}>
					<option value="defect">Defect</option>
					<option value="cancellation">Cancellation</option>
					<option value="goodwill">Goodwill</option>
					<option value="admin">Other</option>
				</select>
			{/snippet}
		</Field>
		<Field label="Note" id="rf-note" optional>
			{#snippet children({ describedBy })}<input
					id="rf-note"
					name="note"
					class="q-input"
					aria-describedby={describedBy}
				/>{/snippet}
		</Field>
		<label class="flex items-center gap-2 text-[14px]"
			><input type="checkbox" class="q-check" name="notify" checked /> Email the customer</label
		>
	</form>
	{#snippet footer()}
		<button type="button" class="q-btn q-btn-secondary" onclick={close}>Cancel</button>
		<button type="submit" form="refund-form" class="q-btn q-btn-primary"
			><Wallet /> Send refund</button
		>
	{/snippet}
</Drawer>

<!-- Return -->
<Drawer
	open={panel === 'return'}
	onclose={close}
	title="Record a return"
	description="Log it when the customer gets in touch; mark it received when the parcel is back."
>
	<form
		id="return-form"
		method="POST"
		action="?/createReturn"
		class="flex flex-col gap-5"
		use:enhance={submitter(toaster, { onSuccess: close })}
	>
		<fieldset class="flex flex-col gap-2">
			<legend class="q-label mb-2">Coming back</legend>
			{#each order.lines as line (line.id)}
				<label class="flex items-center justify-between gap-3 text-[14px]">
					<span>{line.name}{line.variant ? ` (${line.variant})` : ''}</span>
					<input
						type="number"
						name="qty_{line.id}"
						min="0"
						max={line.quantity}
						value={order.lines.length === 1 ? line.quantity : 0}
						class="q-input q-input-sm w-20 text-right"
						aria-label="How many of {line.name}"
					/>
				</label>
			{/each}
		</fieldset>
		<Field label="Reason" id="rt-reason">
			{#snippet children({ describedBy })}
				<select id="rt-reason" name="reason" class="q-select" aria-describedby={describedBy}>
					{#each data.returnReasons as r (r.value)}<option value={r.value}>{r.label}</option>{/each}
				</select>
			{/snippet}
		</Field>
		<Field label="What will happen" id="rt-outcome">
			{#snippet children({ describedBy })}
				<select
					id="rt-outcome"
					name="outcome"
					class="q-select"
					bind:value={returnOutcome}
					aria-describedby={describedBy}
				>
					<option value="refund">Refund</option>
					<option value="exchange">Exchange for another size or colour</option>
					<option value="repair">Repair and send back</option>
					<option value="none">Nothing — keep a record</option>
				</select>
			{/snippet}
		</Field>
		{#if returnOutcome === 'exchange'}
			<Field label="Send instead" id="rt-exchange">
				{#snippet children({ describedBy })}
					<select
						id="rt-exchange"
						name="exchangeVariantId"
						class="q-select"
						required
						aria-describedby={describedBy}
					>
						<option value="">Pick a size…</option>
						{#each data.exchange as option (option.id)}
							<option value={option.id} disabled={option.available === 0}
								>{option.product} — {option.label}{option.available === 0
									? ' (none left)'
									: ` (${option.available} left)`}</option
							>
						{/each}
					</select>
				{/snippet}
			</Field>
		{/if}
		<Field
			label="Details"
			id="rt-detail"
			optional
			help="What is wrong, photos received, anything agreed."
		>
			{#snippet children({ describedBy })}<textarea
					id="rt-detail"
					name="detail"
					class="q-textarea"
					aria-describedby={describedBy}></textarea>{/snippet}
		</Field>
	</form>
	{#snippet footer()}
		<button type="button" class="q-btn q-btn-secondary" onclick={close}>Cancel</button>
		<button type="submit" form="return-form" class="q-btn q-btn-primary"
			><RotateCcw /> Record return</button
		>
	{/snippet}
</Drawer>

<!-- Address -->
<Drawer open={panel === 'address'} onclose={close} title="Shipping address">
	<form
		id="address-form"
		method="POST"
		action="?/address"
		class="flex flex-col gap-4"
		use:enhance={submitter(toaster, { onSuccess: close })}
	>
		{#each [['name', 'Name', order.shipTo.name], ['line1', 'Address line 1', order.shipTo.line1], ['line2', 'Address line 2', order.shipTo.line2 ?? ''], ['city', 'City', order.shipTo.city], ['state', 'State', order.shipTo.state], ['pincode', 'Pincode', order.shipTo.pincode], ['phone', 'Phone', order.shipTo.phone]] as [name, text, value] (name)}
			<Field label={text} id="ad-{name}" optional={name === 'line2'}>
				{#snippet children({ describedBy })}<input
						id="ad-{name}"
						{name}
						class="q-input"
						{value}
						required={name !== 'line2'}
						aria-describedby={describedBy}
					/>{/snippet}
			</Field>
		{/each}
	</form>
	{#snippet footer()}
		<button type="button" class="q-btn q-btn-secondary" onclick={close}><X /> Cancel</button>
		<button type="submit" form="address-form" class="q-btn q-btn-primary">Save address</button>
	{/snippet}
</Drawer>
