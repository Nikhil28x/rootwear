<script lang="ts">
	import { addPaise, formatInr } from '$lib/money';
	import SectionHead from '$lib/components/admin/SectionHead.svelte';
	import TableShell from '$lib/components/admin/TableShell.svelte';
	import StatePill from '$lib/components/admin/StatePill.svelte';
	import StatTile from '$lib/components/admin/StatTile.svelte';
	import { humanise, orderTone, shortDateTime } from '$lib/components/admin/tone';

	let { data } = $props();

	let awaitingDispatch = $derived(
		data.orders.filter((order) => order.state === 'paid' || order.state === 'packed').length
	);
	let value = $derived(
		addPaise(
			...data.orders.filter((o) => o.state !== 'cancelled').map((o) => o.total)
		)
	);
</script>

<svelte:head>
	<title>Orders — Rootwear operations</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<SectionHead
	level={1}
	eyebrow="Fulfilment"
	title="Orders"
	note="Every order, pre-order and open sale alike. A pre-order line carries its reservation and its piece number, so the one continuous record stays intact from deposit to doorstep."
>
	{#snippet actions()}
		<a
			href="/admin/orders/packing-list"
			class="border border-gold px-7 py-3 text-[11px] tracking-[0.2em] text-gold uppercase transition hover:bg-gold hover:text-forest-black font-medium"
		>
			Packing list
		</a>
	{/snippet}
</SectionHead>

<div class="mt-10 grid gap-px bg-white/10 sm:grid-cols-3">
	<StatTile label="Orders" value={String(data.orders.length)} note="Matching the current filter." />
	<StatTile
		label="Awaiting dispatch"
		value={String(awaitingDispatch)}
		note="Paid or packed, not yet handed over."
		severity={awaitingDispatch > 0 ? 'watch' : 'none'}
	/>
	<StatTile label="Value" value={formatInr(value)} note="Cancelled orders excluded." />
</div>

<form method="GET" class="mt-12 flex flex-wrap items-end gap-6 border-y border-white/10 py-6">
	<div class="flex min-w-[12rem] flex-col gap-2">
		<label for="f-state" class="text-[11px] tracking-[0.2em] text-stone-400 uppercase font-medium">State</label>
		<select
			id="f-state"
			name="state"
			value={data.filter.state}
			class="w-full border-b border-white/25 bg-transparent px-0 py-2.5 text-[15px] text-stone-100 outline-none focus:border-white"
		>
			<option value="">Every state</option>
			{#each data.states as state (state)}
				<option value={state}>{humanise(state)}</option>
			{/each}
		</select>
	</div>
	<button
		type="submit"
		class="border border-white/35 px-7 py-3 text-[11px] tracking-[0.2em] text-stone-100 uppercase transition hover:bg-white hover:text-black font-medium"
	>
		Apply
	</button>
	<a
		href="/admin/orders"
		class="text-[11px] tracking-[0.2em] text-stone-400 uppercase underline underline-offset-4 hover:text-stone-200 font-medium"
	>
		Clear
	</a>
</form>

<div class="mt-12">
	<TableShell caption="Orders" note="Newest first">
		<thead>
			<tr class="text-[11px] tracking-[0.2em] text-stone-400 uppercase font-medium">
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-left">Order</th>
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-left">State</th>
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-left">Customer</th>
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-left">Ships to</th>
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-right">Pieces</th>
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-right">Total</th>
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-left">Tracking</th>
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-left">Placed</th>
			</tr>
		</thead>
		<tbody>
			{#each data.orders as order (order.id)}
				<tr class="text-stone-200">
					<th scope="row" class="border-b border-white/5 px-4 py-3 text-left font-normal">
						<a class="text-cream underline decoration-white/25 underline-offset-4 hover:decoration-cream" href="/admin/orders/{order.id}">
							{order.orderNumber}
						</a>
						{#if order.isPreOrder}
							<span class="mt-1 block text-[11px] tracking-[0.18em] text-gold uppercase font-medium">
								Pre-order
							</span>
						{/if}
					</th>
					<td class="border-b border-white/5 px-4 py-3">
						<StatePill label={humanise(order.state)} tone={orderTone(order.state)} />
					</td>
					<td class="border-b border-white/5 px-4 py-3 text-[15px]">{order.email}</td>
					<td class="border-b border-white/5 px-4 py-3 text-[15px]">
						{order.shipTo.city}, {order.shipTo.state}
						<span class="block text-[13px] text-stone-400 tabular-nums">{order.shipTo.pincode}</span>
					</td>
					<td class="border-b border-white/5 px-4 py-3 text-right tabular-nums">{order.pieceCount}</td>
					<td class="border-b border-white/5 px-4 py-3 text-right tabular-nums">
						{formatInr(order.total)}
					</td>
					<td class="border-b border-white/5 px-4 py-3 text-[13px] text-stone-400">
						{#if order.trackingRef}
							{order.courierName}
							<span class="block text-stone-400 tabular-nums">{order.trackingRef}</span>
						{:else}
							<span class="text-stone-400">—</span>
						{/if}
					</td>
					<td class="border-b border-white/5 px-4 py-3 text-[13px] whitespace-nowrap tabular-nums">
						{shortDateTime(order.createdAt)}
					</td>
				</tr>
			{:else}
				<tr>
					<td colspan="8" class="px-4 py-10 text-[15px] text-stone-400">
						No orders in this view. Open sales appear the moment the drop goes live; pre-orders
						appear when a balance clears.
					</td>
				</tr>
			{/each}
		</tbody>
	</TableShell>
</div>
