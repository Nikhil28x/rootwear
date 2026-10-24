<script lang="ts">
	import { FileText, PackageCheck, Printer, Tag } from '@lucide/svelte';
	import Chip from '$lib/components/admin/ui/Chip.svelte';
	import EmptyState from '$lib/components/admin/ui/EmptyState.svelte';
	import PageHeader from '$lib/components/admin/ui/PageHeader.svelte';
	import { ORDER_STATE, label } from '$lib/components/admin/labels';
	import { timeAgo } from '$lib/components/admin/tone';

	let { data } = $props();
	let ids = $derived(data.orders.map((o) => o.id).join(','));
	let pieces = $derived(
		Object.entries(
			data.orders
				.flatMap((o) => o.lines)
				.reduce<Record<string, number>>((acc, l) => {
					const key = `${l.name}${l.variant ? ` — ${l.variant}` : ''}`;
					acc[key] = (acc[key] ?? 0) + l.quantity;
					return acc;
				}, {})
		).sort((a, b) => a[0].localeCompare(b[0]))
	);
</script>

<svelte:head><title>Packing list · Rootwear admin</title></svelte:head>

<div class="flex flex-col gap-6">
	<PageHeader title="Packing list" description="Every paid order not yet dispatched, oldest first.">
		{#snippet actions()}
			{#if data.orders.length}
				<a
					class="q-btn q-btn-secondary"
					href="/admin/orders/print?kind=label&ids={ids}"
					target="_blank"
					rel="noopener"><Tag /> Labels</a
				>
				<a
					class="q-btn q-btn-secondary"
					href="/admin/orders/print?kind=invoice&ids={ids}"
					target="_blank"
					rel="noopener"><FileText /> Invoices</a
				>
				<a
					class="q-btn q-btn-primary"
					href="/admin/orders/print?kind=packing&ids={ids}"
					target="_blank"
					rel="noopener"><Printer /> Print packing slips</a
				>
			{/if}
		{/snippet}
	</PageHeader>

	{#if data.orders.length === 0}
		<div class="q-card">
			<EmptyState
				icon={PackageCheck}
				title="Nothing to pack"
				body="Paid orders appear here until they are dispatched."
			/>
		</div>
	{:else}
		<div class="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
			<ul class="q-card q-divide">
				{#each data.orders as order (order.id)}
					{@const st = label(ORDER_STATE, order.state)}
					<li class="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between">
						<div class="flex flex-col gap-1">
							<p class="flex flex-wrap items-center gap-2">
								<a
									class="q-mono font-medium text-q-text hover:underline"
									href="/admin/orders/{order.id}">{order.number}</a
								>
								<Chip label={st.label} tone={st.tone} />
								{#if order.isPreOrder}<Chip label="Pre-order" dot={false} />{/if}
							</p>
							<p class="text-[13px] text-q-secondary">
								{order.name} · {order.city} · paid {timeAgo(order.createdAt)}
							</p>
							{#if order.note}<p
									class="rounded-[8px] bg-q-warning-tint px-2 py-1 text-[13px] text-q-body"
								>
									{order.note}
								</p>{/if}
						</div>
						<ul class="text-[14px] text-q-body sm:text-right">
							{#each order.lines as l, i (i)}<li>
									{l.quantity} × {l.name}{l.variant ? ` (${l.variant})` : ''}{l.pieceNumber
										? ` · No. ${l.pieceNumber}`
										: ''}
								</li>{/each}
						</ul>
					</li>
				{/each}
			</ul>
			<aside class="q-card flex h-fit flex-col gap-3 p-4">
				<h2 class="text-[16px] font-semibold text-q-text">Pieces to pick</h2>
				<ul class="flex flex-col gap-1 text-[14px]">
					{#each pieces as [name, count] (name)}<li class="flex justify-between gap-3">
							<span>{name}</span><span class="font-medium text-q-text tabular-nums">{count}</span>
						</li>{/each}
				</ul>
			</aside>
		</div>
	{/if}
</div>
