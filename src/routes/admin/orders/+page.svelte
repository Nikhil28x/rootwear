<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import {
		Download,
		FileText,
		PackageCheck,
		Printer,
		Receipt,
		Search,
		Tag,
		X
	} from '@lucide/svelte';
	import Chip from '$lib/components/admin/ui/Chip.svelte';
	import EmptyState from '$lib/components/admin/ui/EmptyState.svelte';
	import PageHeader from '$lib/components/admin/ui/PageHeader.svelte';
	import Pager from '$lib/components/admin/ui/Pager.svelte';
	import Tabs from '$lib/components/admin/ui/Tabs.svelte';
	import { submitter } from '$lib/components/admin/enhance';
	import { getToaster } from '$lib/components/admin/toast.svelte';
	import { ORDER_STATE, label } from '$lib/components/admin/labels';
	import { shortDateTime, timeAgo } from '$lib/components/admin/tone';
	import { formatInr } from '$lib/money';

	let { data } = $props();
	const toaster = getToaster();

	let selected = $state<string[]>([]);
	$effect.pre(() => {
		void data.orders;
		selected = [];
	});
	let allSelected = $derived(data.orders.length > 0 && selected.length === data.orders.length);
	let filtered = $derived(
		Boolean(data.filters.q || data.filters.from || data.filters.to || data.filters.drop)
	);

	const tabs = $derived([
		{ href: '/admin/orders', label: 'To ship', count: data.counts.to_ship, exact: true },
		{ href: '/admin/orders?view=dispatched', label: 'Dispatched', count: data.counts.dispatched },
		{ href: '/admin/orders?view=returns', label: 'Returns', count: data.counts.returns || null },
		{ href: '/admin/orders?view=all', label: 'All paid' },
		{
			href: '/admin/orders?view=pending_payment',
			label: 'Unpaid',
			count: data.counts.pending_payment || null
		},
		{ href: '/admin/orders?view=cancelled', label: 'Cancelled' }
	]);

	function printUrl(kind: 'invoice' | 'label' | 'packing') {
		return `/admin/orders/print?kind=${kind}&ids=${selected.join(',')}`;
	}

	let exportUrl = $derived(`/admin/orders/export${data.query}`);
</script>

<svelte:head><title>Orders · Rootwear admin</title></svelte:head>

<div class="flex flex-col gap-6">
	<PageHeader
		title="Orders"
		description="Paid orders, newest first. Pack, dispatch and print from here."
	>
		{#snippet actions()}
			<a href={exportUrl} class="q-btn q-btn-secondary"><Download /> Export CSV</a>
		{/snippet}
	</PageHeader>

	<Tabs label="Order views" {tabs} />

	<form method="GET" class="flex flex-wrap items-end gap-2" data-sveltekit-keepfocus>
		{#if data.filters.view}<input type="hidden" name="view" value={data.filters.view} />{/if}
		<div class="relative min-w-[240px] flex-1 sm:max-w-[360px]">
			<Search
				size={16}
				strokeWidth={1.5}
				class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-q-tertiary"
			/>
			<label for="o-q" class="sr-only">Search orders</label>
			<input
				id="o-q"
				name="q"
				type="search"
				class="q-input pl-9"
				placeholder="Order, name, email, phone, pincode"
				value={data.filters.q}
			/>
		</div>
		<label for="o-drop" class="sr-only">Drop</label>
		<select
			id="o-drop"
			name="drop"
			class="q-select w-auto"
			onchange={(e) => e.currentTarget.form?.requestSubmit()}
		>
			<option value="">All drops</option>
			{#each data.drops as drop (drop.id)}<option
					value={drop.id}
					selected={data.filters.drop === drop.id}>{drop.label}</option
				>{/each}
		</select>
		<label class="flex items-center gap-2 text-[13px] text-q-secondary"
			>From <input
				name="from"
				type="date"
				class="q-input w-auto"
				value={data.filters.from}
			/></label
		>
		<label class="flex items-center gap-2 text-[13px] text-q-secondary"
			>To <input name="to" type="date" class="q-input w-auto" value={data.filters.to} /></label
		>
		<button type="submit" class="q-btn q-btn-secondary">Search</button>
		{#if filtered}
			<a
				href="/admin/orders{data.filters.view ? `?view=${data.filters.view}` : ''}"
				class="q-btn q-btn-ghost"><X /> Clear</a
			>
		{/if}
	</form>

	{#if data.orders.length === 0}
		<div class="q-card">
			{#if filtered}
				<EmptyState
					icon={Search}
					title="No orders match"
					body="Try the order number, the customer’s email or their phone number."
					compact
				/>
			{:else if !data.filters.view}
				<EmptyState
					icon={PackageCheck}
					title="Nothing to ship"
					body="Paid orders waiting to be packed and dispatched appear here."
					compact
				/>
			{:else}
				<EmptyState
					icon={Receipt}
					title="No orders here"
					body="Orders in this state will appear here."
					compact
				/>
			{/if}
		</div>
	{:else}
		<div class="q-table-wrap">
			<table class="q-table">
				<thead>
					<tr>
						<th scope="col" class="w-10">
							<input
								type="checkbox"
								class="q-check"
								aria-label="Select all orders on this page"
								checked={allSelected}
								onchange={() => (selected = allSelected ? [] : data.orders.map((o) => o.id))}
							/>
						</th>
						<th scope="col">Order</th>
						<th scope="col">Customer</th>
						<th scope="col">Status</th>
						<th scope="col" class="num">Pieces</th>
						<th scope="col" class="num">Total</th>
						<th scope="col" class="num">Placed</th>
					</tr>
				</thead>
				<tbody>
					{#each data.orders as order (order.id)}
						{@const status = label(ORDER_STATE, order.state)}
						<tr
							aria-selected={selected.includes(order.id)}
							data-href="/admin/orders/{order.id}"
							onclick={(e) => {
								if (!(e.target as HTMLElement).closest('a, input, label'))
									goto(`/admin/orders/${order.id}`);
							}}
						>
							<td>
								<input
									type="checkbox"
									class="q-check"
									aria-label="Select {order.number}"
									value={order.id}
									bind:group={selected}
								/>
							</td>
							<td>
								<a href="/admin/orders/{order.id}" class="row-link q-mono">{order.number}</a>
								{#if order.isPreOrder}<span class="block text-[12px] text-q-tertiary"
										>Pre-order</span
									>{/if}
							</td>
							<td>
								<p class="text-q-text">{order.name}</p>
								<p class="text-[13px] text-q-secondary">
									{order.email}{order.city ? ` · ${order.city}` : ''}
								</p>
							</td>
							<td>
								<div class="flex flex-wrap gap-1.5">
									<Chip label={status.label} tone={status.tone} />
									{#if order.openReturn}<Chip label="Return open" tone="warning" />{/if}
								</div>
								{#if order.trackingRef}<p class="mt-1 text-[12px] text-q-tertiary">
										{order.courierName}
										{order.trackingRef}
									</p>{/if}
							</td>
							<td class="num">{order.pieces}</td>
							<td class="num font-medium text-q-text">{formatInr(order.total)}</td>
							<td class="num text-q-secondary" title={shortDateTime(order.createdAt)}
								>{timeAgo(order.createdAt)}</td
							>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<Pager page={data.page} pageSize={data.pageSize} total={data.total} />
	{/if}
</div>

{#if selected.length}
	<div
		class="bulk-bar fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-[720px] flex-wrap items-center gap-2 rounded-[14px] bg-q-inverse p-2 pl-4 text-q-on-inverse sm:bottom-6"
		role="region"
		aria-label="Selected orders"
	>
		<p class="mr-auto text-[14px] font-medium">{selected.length} selected</p>
		{#if data.canEdit}
			<form method="POST" action="?/pack" use:enhance={submitter(toaster)}>
				{#each selected as id (id)}<input type="hidden" name="ids" value={id} />{/each}
				<button type="submit" class="bulk-btn"
					><PackageCheck size={16} strokeWidth={1.5} /> Mark packed</button
				>
			</form>
		{/if}
		<a class="bulk-btn" href={printUrl('packing')} target="_blank" rel="noopener"
			><Printer size={16} strokeWidth={1.5} /> Packing slips</a
		>
		<a class="bulk-btn" href={printUrl('label')} target="_blank" rel="noopener"
			><Tag size={16} strokeWidth={1.5} /> Labels</a
		>
		<a class="bulk-btn" href={printUrl('invoice')} target="_blank" rel="noopener"
			><FileText size={16} strokeWidth={1.5} /> Invoices</a
		>
		<button
			type="button"
			class="bulk-btn"
			aria-label="Clear selection"
			onclick={() => (selected = [])}><X size={16} strokeWidth={1.5} /></button
		>
	</div>
{/if}

<style>
	.bulk-bar {
		animation: bulk-in 200ms ease-out;
	}
	.bulk-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 36px;
		padding: 0 12px;
		border-radius: 10px;
		font-size: 14px;
		font-weight: 500;
		color: inherit;
	}
	.bulk-btn:hover {
		background: rgb(255 255 255 / 0.1);
	}
	@keyframes bulk-in {
		from {
			transform: translateY(8px);
			opacity: 0;
		}
	}
</style>
