<script lang="ts">
	import { formatInr } from '$lib/money';
	import { RETURNS_WORDING } from '$lib/content/returns';
	import SectionHead from '$lib/components/admin/SectionHead.svelte';
	import TableShell from '$lib/components/admin/TableShell.svelte';
	import StatePill from '$lib/components/admin/StatePill.svelte';
	import Notice from '$lib/components/admin/Notice.svelte';
	import { humanise, orderTone, paymentTone, shortDateTime } from '$lib/components/admin/tone';

	let { data, form } = $props();

	let order = $derived(data.order);
	// The action reports its own outcome. Inferring it from the wording broke
	// the moment a message was reworded, and a refused dispatch drawn as a
	// success is the worst possible way to get that wrong.
	let failed = $derived(Boolean(form?.message) && !form?.ok);

	/** §08: a pre-order's money lives on its reservation, not on the order row. */
	let preOrderReservationId = $derived(
		order.lines.find((line) => line.reservationId !== null)?.reservationId ?? null
	);
</script>

<svelte:head>
	<title>{order.orderNumber} — Rootwear operations</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<p class="text-[11px] tracking-[0.24em] text-stone-400 uppercase font-medium">
	<a class="underline underline-offset-4 hover:text-stone-200" href="/admin/orders">Orders</a>
	<span aria-hidden="true"> / </span>{order.orderNumber}
</p>

<div class="mt-6">
	<SectionHead
		level={1}
		eyebrow={order.isPreOrder ? 'Pre-order' : 'Open sale'}
		title={order.orderNumber}
		note="Placed {shortDateTime(order.createdAt)} IST by {order.email}."
	/>
</div>

<div class="mt-6 flex flex-wrap items-center gap-4">
	<StatePill label={humanise(order.state)} tone={orderTone(order.state)} />
	{#if order.isPreOrder}
		<StatePill label="Dispatches with the drop" tone="attention" />
	{/if}
	{#if order.dispatchedAt}
		<p class="text-[13px] text-stone-400 tabular-nums">
			Dispatched {shortDateTime(order.dispatchedAt)} IST
		</p>
	{/if}
</div>

{#if form?.message}
	<div class="mt-8"><Notice kind={failed ? 'error' : 'success'}>{form.message}</Notice></div>
{/if}

<div class="mt-14 grid gap-14 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
	<div class="flex flex-col gap-14">
		<!-- LINES -->
		<section class="flex flex-col gap-6">
			<SectionHead eyebrow="Contents" title="Pieces" />

			<TableShell caption="Order lines" captionVisible={false}>
				<thead>
					<tr class="text-[11px] tracking-[0.2em] text-stone-400 uppercase font-medium">
						<th scope="col" class="border-b border-white/10 px-4 py-3 text-left">Piece</th>
						<th scope="col" class="border-b border-white/10 px-4 py-3 text-left">SKU</th>
						<th scope="col" class="border-b border-white/10 px-4 py-3 text-left">Size</th>
						<th scope="col" class="border-b border-white/10 px-4 py-3 text-right">Qty</th>
						<th scope="col" class="border-b border-white/10 px-4 py-3 text-right">Unit</th>
						<th scope="col" class="border-b border-white/10 px-4 py-3 text-left">Price used</th>
					</tr>
				</thead>
				<tbody>
					{#each order.lines as line (line.id)}
						<tr class="text-stone-200">
							<th scope="row" class="border-b border-white/5 px-4 py-3 text-left font-normal text-cream">
								{line.name}
								{#if line.pieceNumber !== null}
									<span class="mt-1 block text-[13px] text-gold tabular-nums">
										Piece {line.pieceNumber}
									</span>
								{/if}
							</th>
							<td class="border-b border-white/5 px-4 py-3 text-[13px] text-stone-400">{line.sku}</td>
							<td class="border-b border-white/5 px-4 py-3">{line.size ?? '—'}</td>
							<td class="border-b border-white/5 px-4 py-3 text-right tabular-nums">{line.quantity}</td>
							<td class="border-b border-white/5 px-4 py-3 text-right tabular-nums">
								{formatInr(line.unitPrice)}
							</td>
							<td class="border-b border-white/5 px-4 py-3 text-[13px] tracking-[0.12em] text-stone-400 uppercase font-medium">
								{line.priceSource === 'prelaunch_locked' ? 'Locked pre-launch' : 'Launch'}
								{#if line.reservationId}
									<a
										class="mt-1 block text-stone-300 underline underline-offset-4 hover:text-cream"
										href="/admin/reservations/{line.reservationId}"
									>
										Reservation →
									</a>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
				<tfoot class="text-stone-300">
					<tr>
						<th scope="row" colspan="4" class="px-4 py-2 text-right text-[11px] tracking-[0.2em] uppercase font-medium">
							Subtotal
						</th>
						<td class="px-4 py-2 text-right tabular-nums">{formatInr(order.subtotal)}</td>
						<td></td>
					</tr>
					<tr>
						<th scope="row" colspan="4" class="px-4 py-2 text-right text-[11px] tracking-[0.2em] uppercase font-medium">
							Shipping
						</th>
						<td class="px-4 py-2 text-right tabular-nums">{formatInr(order.shipping)}</td>
						<td></td>
					</tr>
					{#if order.discount > 0}
						<tr>
							<th scope="row" colspan="4" class="px-4 py-2 text-right text-[11px] tracking-[0.2em] uppercase font-medium">
								Discount
							</th>
							<td class="px-4 py-2 text-right tabular-nums">−{formatInr(order.discount)}</td>
							<td></td>
						</tr>
					{/if}
					<tr class="text-cream">
						<th scope="row" colspan="4" class="px-4 py-3 text-right text-[11px] tracking-[0.2em] uppercase font-medium">
							Total
						</th>
						<td class="px-4 py-3 text-right tabular-nums">{formatInr(order.total)}</td>
						<td></td>
					</tr>
				</tfoot>
			</TableShell>

			<p class="text-[13px] leading-relaxed text-stone-400">
				Prices are inclusive of tax, and each line carries the price that was in force when the
				order was created rather than a live lookup — a later catalogue edit cannot rewrite what
				was charged.
			</p>
		</section>

		<!-- FULFILMENT -->
		<section class="flex flex-col gap-6 border-t border-white/10 pt-10">
			<SectionHead
				eyebrow="Dispatch"
				title="Fulfilment"
				note="Mark packed, enter the courier and the reference, then mark dispatched. The reference appears on the customer's track-order page, so a dispatch without one is refused."
			/>

			<form method="POST" action="?/fulfil" class="flex flex-col gap-7 border border-white/10 p-6">
				<div class="grid gap-7 sm:grid-cols-3">
					<div class="flex flex-col gap-2">
						<label for="f-state" class="text-[11px] tracking-[0.2em] text-stone-400 uppercase font-medium">
							State
						</label>
						<select
							id="f-state"
							name="state"
							value={order.state}
							class="w-full border-b border-white/25 bg-transparent px-0 py-2.5 text-[15px] text-stone-100 outline-none focus:border-white"
						>
							{#each data.states as state (state)}
								<option value={state}>{humanise(state)}</option>
							{/each}
						</select>
					</div>

					<div class="flex flex-col gap-2">
						<label for="f-courier" class="text-[11px] tracking-[0.2em] text-stone-400 uppercase font-medium">
							Courier
						</label>
						<input
							id="f-courier"
							name="courierName"
							type="text"
							value={order.courierName ?? ''}
							placeholder="Porter"
							class="w-full border-b border-white/25 bg-transparent px-0 py-2.5 text-[15px] text-stone-100 placeholder:text-stone-400 outline-none focus:border-white"
						/>
					</div>

					<div class="flex flex-col gap-2">
						<label for="f-track" class="text-[11px] tracking-[0.2em] text-stone-400 uppercase font-medium">
							Tracking reference
						</label>
						<input
							id="f-track"
							name="trackingRef"
							type="text"
							value={order.trackingRef ?? ''}
							placeholder="PTR0000000"
							class="w-full border-b border-white/25 bg-transparent px-0 py-2.5 text-[15px] text-stone-100 placeholder:text-stone-400 outline-none focus:border-white"
						/>
					</div>
				</div>

				<div class="flex flex-wrap items-center gap-5">
					<button
						type="submit"
						class="border border-white/35 px-7 py-3 text-[11px] tracking-[0.2em] text-stone-100 uppercase transition hover:bg-white hover:text-black font-medium"
					>
						Save fulfilment
					</button>
					<span class="text-[13px] text-stone-400">
						Marking a pre-order dispatched moves its reservation to dispatched as well.
					</span>
				</div>
			</form>
		</section>
	</div>

	<!-- SIDE: address, notes, payments -->
	<aside class="flex flex-col gap-12">
		<section class="flex flex-col gap-4 border border-white/10 p-6">
			<h2 class="text-[11px] tracking-[0.28em] text-stone-400 uppercase font-medium">Ships to</h2>
			<address class="text-[15px] leading-relaxed text-stone-200 not-italic">
				{order.shipTo.name}<br />
				{order.shipTo.line1}<br />
				{#if order.shipTo.line2}{order.shipTo.line2}<br />{/if}
				{order.shipTo.city}, {order.shipTo.state}<br />
				<span class="tabular-nums">{order.shipTo.pincode}</span> · {order.shipTo.country}<br />
				<span class="tabular-nums">{order.shipTo.phone}</span>
			</address>
			<p class="text-[13px] text-stone-400">Ships within India only.</p>
		</section>

		{#if order.notes}
			<section class="flex flex-col gap-4 border border-white/10 p-6">
				<h2 class="text-[11px] tracking-[0.28em] text-stone-400 uppercase font-medium">Order notes</h2>
				<p class="text-[15px] leading-relaxed text-stone-200">{order.notes}</p>
			</section>
		{/if}

		<section class="flex flex-col gap-4">
			<h2 class="text-[11px] tracking-[0.28em] text-stone-400 uppercase font-medium">Payments</h2>
			{#if order.payments.length === 0 && order.isPreOrder}
				<!-- §08: on a pre-order the money sits on the reservation, which is
				     the same record. Saying "nothing captured" here would be wrong. -->
				<p class="text-[15px] leading-relaxed text-stone-400">
					The deposit and the balance were taken against the reservation, which is this same
					record. Open
					{#if preOrderReservationId}
						<a
							class="text-stone-300 underline underline-offset-4 hover:text-cream"
							href="/admin/reservations/{preOrderReservationId}">the reservation</a
						>
					{:else}
						the reservation
					{/if}
					to see the payment ledger end to end.
				</p>
			{:else if order.payments.length === 0}
				<p class="text-[15px] text-stone-400">
					Nothing captured against this order yet. A payment is recorded only when the gateway
					confirms it — never on the browser redirect.
				</p>
			{:else}
				<ul class="flex flex-col">
					{#each order.payments as payment (payment.id)}
						<li class="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 py-4">
							<span class="flex items-center gap-3">
								<StatePill label={humanise(payment.state)} tone={paymentTone(payment.state)} />
								<span class="text-[15px] text-stone-300">{humanise(payment.kind)}</span>
							</span>
							<span class="text-[15px] text-cream tabular-nums">{formatInr(payment.amount)}</span>
							<span class="w-full text-[13px] text-stone-400 tabular-nums">
								{shortDateTime(payment.createdAt)} · {payment.gateway}
								{#if payment.gatewayPaymentId}· {payment.gatewayPaymentId}{/if}
							</span>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<section class="flex flex-col gap-4 border-t border-white/10 pt-8">
			<h2 class="text-[11px] tracking-[0.28em] text-stone-400 uppercase font-medium">Returns position</h2>
			<p class="text-[15px] leading-relaxed text-stone-400">{RETURNS_WORDING}</p>
			<p class="text-[13px] text-stone-400">
				This is the same wording the customer saw on the product page, at checkout and in their
				confirmation — it is read from one constant, not retyped.
			</p>
		</section>
	</aside>
</div>
