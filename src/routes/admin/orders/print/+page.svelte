<script lang="ts">
	import { Printer } from '@lucide/svelte';
	import InvoiceDoc from '$lib/components/admin/InvoiceDoc.svelte';
	import { shortDate } from '$lib/components/admin/tone';

	let { data } = $props();
	const TITLES = {
		packing: 'Packing slips',
		label: 'Address labels',
		invoice: 'Invoices'
	} as const;
</script>

<svelte:head><title>{TITLES[data.kind]} · Rootwear admin</title></svelte:head>

<div class="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
	<div>
		<h1 class="text-[20px] leading-[28px] font-semibold text-q-text">{TITLES[data.kind]}</h1>
		<p class="text-[13px] text-q-secondary">
			{data.orders.length} order{data.orders.length === 1 ? '' : 's'}. Each starts on a new page.
		</p>
	</div>
	<button type="button" class="q-btn q-btn-primary" onclick={() => window.print()}
		><Printer /> Print</button
	>
</div>

<div class="sheets">
	{#if data.kind === 'invoice'}
		{#each data.invoices as item (item.doc.id)}
			<div class="sheet"><InvoiceDoc doc={item.doc} words={item.words} /></div>
		{/each}
	{:else if data.kind === 'packing'}
		{#each data.orders as order (order.id)}
			<section class="sheet slip">
				<header class="slip__head">
					<div>
						<p class="slip__brand">{data.from.name}</p>
						<p>Packing slip</p>
					</div>
					<div class="slip__meta">
						<p class="slip__number">{order.number}</p>
						<p>{shortDate(order.createdAt)}{order.isPreOrder ? ' · Pre-order' : ''}</p>
					</div>
				</header>
				<div class="slip__to">
					<p class="slip__label">Ship to</p>
					<p><strong>{order.shipTo.name}</strong></p>
					<p>{order.shipTo.line1}{order.shipTo.line2 ? `, ${order.shipTo.line2}` : ''}</p>
					<p>{order.shipTo.city} {order.shipTo.pincode}, {order.shipTo.state}</p>
					<p>{order.shipTo.phone}</p>
				</div>
				<table class="slip__table">
					<thead
						><tr><th>✓</th><th>Item</th><th>Size</th><th>SKU</th><th>Piece</th><th>Qty</th></tr
						></thead
					>
					<tbody>
						{#each order.lines as line, i (i)}
							<tr
								><td><span class="box"></span></td><td>{line.name}</td><td>{line.variant ?? ''}</td
								><td>{line.sku}</td><td>{line.pieceNumber ? `No. ${line.pieceNumber}` : ''}</td><td
									>{line.quantity}</td
								></tr
							>
						{/each}
					</tbody>
				</table>
				{#if order.customerNote}
					<div class="slip__note">
						<p class="slip__label">Note from the customer</p>
						<p>{order.customerNote}</p>
					</div>
				{/if}
				<p class="slip__thanks">Thank you for buying slow. — {data.from.name}</p>
			</section>
		{/each}
	{:else}
		<div class="labels">
			{#each data.orders as order (order.id)}
				<section class="label">
					<p class="label__small">To</p>
					<p class="label__name">{order.shipTo.name}</p>
					<p>{order.shipTo.line1}</p>
					{#if order.shipTo.line2}<p>{order.shipTo.line2}</p>{/if}
					<p>{order.shipTo.city}, {order.shipTo.state}</p>
					<p class="label__pin">{order.shipTo.pincode}</p>
					<p>Ph. {order.shipTo.phone}</p>
					<div class="label__from">
						<p class="label__small">From</p>
						<p>{data.from.name}, {data.from.address}</p>
						<p>{order.number}</p>
					</div>
				</section>
			{/each}
		</div>
	{/if}
</div>

<style>
	.sheets {
		display: flex;
		flex-direction: column;
		gap: 24px;
	}
	.sheet {
		background: #fff;
		color: #18181b;
		border: 1px solid var(--color-q-border);
		border-radius: 14px;
		overflow: hidden;
	}
	.slip {
		padding: 14mm;
		font-size: 13px;
		line-height: 1.5;
		max-width: 210mm;
	}
	.slip p {
		margin: 0;
	}
	.slip__head {
		display: flex;
		justify-content: space-between;
		border-bottom: 1px solid #d4d4d8;
		padding-bottom: 12px;
	}
	.slip__brand {
		font-weight: 600;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: #1f382a;
	}
	.slip__meta {
		text-align: right;
	}
	.slip__number {
		font-family: ui-monospace, Menlo, monospace;
		font-size: 15px;
		font-weight: 600;
	}
	.slip__to {
		padding: 16px 0;
	}
	.slip__label {
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #6b6b74;
	}
	.slip__table {
		width: 100%;
		border-collapse: collapse;
	}
	.slip__table th {
		text-align: left;
		font-weight: 500;
		font-size: 11px;
		color: #52525b;
		border-bottom: 1px solid #d4d4d8;
		padding: 6px;
	}
	.slip__table td {
		padding: 10px 6px;
		border-bottom: 1px solid #e4e4e7;
	}
	.box {
		display: inline-block;
		width: 14px;
		height: 14px;
		border: 1.5px solid #52525b;
		border-radius: 3px;
	}
	.slip__note {
		margin-top: 16px;
		padding: 10px 12px;
		background: #f4f4f5;
		border-radius: 8px;
	}
	.slip__thanks {
		margin-top: 24px !important;
		color: #52525b;
	}
	.labels {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0;
		background: #fff;
		color: #18181b;
		max-width: 210mm;
	}
	.label {
		padding: 10mm;
		min-height: 138mm;
		border: 1px dashed #a1a1aa;
		font-size: 15px;
		line-height: 1.45;
		display: flex;
		flex-direction: column;
	}
	.label p {
		margin: 0;
	}
	.label__small {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #6b6b74;
	}
	.label__name {
		font-size: 20px;
		font-weight: 600;
		margin: 2px 0 4px !important;
	}
	.label__pin {
		font-size: 24px;
		font-weight: 700;
		letter-spacing: 0.08em;
		margin: 6px 0 !important;
	}
	.label__from {
		margin-top: auto;
		padding-top: 10px;
		border-top: 1px solid #e4e4e7;
		font-size: 11px;
		color: #52525b;
	}
	@media print {
		.no-print {
			display: none !important;
		}
		.sheets {
			gap: 0;
		}
		.sheet {
			border: 0;
			border-radius: 0;
			break-after: page;
		}
		.label {
			break-inside: avoid;
			min-height: 138mm;
		}
	}
</style>
