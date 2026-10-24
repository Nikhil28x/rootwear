<script lang="ts">
	import { Download, FileText, Search, X } from '@lucide/svelte';
	import Chip from '$lib/components/admin/ui/Chip.svelte';
	import EmptyState from '$lib/components/admin/ui/EmptyState.svelte';
	import PageHeader from '$lib/components/admin/ui/PageHeader.svelte';
	import Pager from '$lib/components/admin/ui/Pager.svelte';
	import StatTile from '$lib/components/admin/StatTile.svelte';
	import Tabs from '$lib/components/admin/ui/Tabs.svelte';
	import { shortDate } from '$lib/components/admin/tone';
	import { formatInr, paise } from '$lib/money';

	let { data } = $props();
	let filtered = $derived(Boolean(data.filters.q || data.filters.from || data.filters.to));
	const inr = (value: number) => formatInr(paise(value));
</script>

<svelte:head><title>Invoices · Rootwear admin</title></svelte:head>

<div class="flex flex-col gap-6">
	<PageHeader title="Invoices" description="Every invoice and credit note, numbered per financial year. Pick a month’s dates, then download the three files your accountant needs for GST filing.">
		{#snippet actions()}
			<div class="flex flex-wrap gap-2" role="group" aria-label="Accountant pack">
				<a class="q-btn q-btn-secondary" href="/admin/invoices/export{data.query}"><Download /> Sales register</a>
				<a class="q-btn q-btn-secondary" href="/admin/invoices/export{data.query ? `${data.query}&` : '?'}type=hsn"><Download /> HSN summary</a>
				<a class="q-btn q-btn-secondary" href="/admin/invoices/export{data.query ? `${data.query}&` : '?'}type=states"><Download /> By state</a>
			</div>
		{/snippet}
	</PageHeader>

	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<StatTile label="Invoices" value={String(data.summary.count)} note={filtered ? 'In these dates' : 'All time'} />
		<StatTile label="Invoiced" value={inr(data.summary.invoiced)} note="Including tax" />
		<StatTile label="Credited" value={inr(data.summary.credited)} note="Refunds, as credit notes" />
		<StatTile label="Net GST" value={inr(data.summary.tax)} note="Output tax less credit notes" />
	</div>

	<Tabs
		label="Document type"
		tabs={[
			{ href: '/admin/invoices', label: 'All', exact: true },
			{ href: '/admin/invoices?kind=invoice', label: 'Invoices' },
			{ href: '/admin/invoices?kind=credit_note', label: 'Credit notes' }
		]}
	/>

	<form method="GET" class="flex flex-wrap items-end gap-2">
		{#if data.filters.kind}<input type="hidden" name="kind" value={data.filters.kind} />{/if}
		<div class="relative min-w-[200px] flex-1 sm:max-w-[280px]">
			<Search size={16} strokeWidth={1.5} class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-q-tertiary" />
			<label for="iv-q" class="sr-only">Number</label>
			<input id="iv-q" name="q" type="search" class="q-input pl-9" placeholder="Document number" value={data.filters.q} />
		</div>
		<label class="flex items-center gap-2 text-[13px] text-q-secondary">From <input name="from" type="date" class="q-input w-auto" value={data.filters.from} /></label>
		<label class="flex items-center gap-2 text-[13px] text-q-secondary">To <input name="to" type="date" class="q-input w-auto" value={data.filters.to} /></label>
		<button type="submit" class="q-btn q-btn-secondary">Filter</button>
		{#if filtered}<a href="/admin/invoices{data.filters.kind ? `?kind=${data.filters.kind}` : ''}" class="q-btn q-btn-ghost"><X /> Clear</a>{/if}
	</form>

	{#if data.documents.length === 0}
		<div class="q-card">
			<EmptyState icon={FileText} title={filtered ? 'Nothing in these dates' : 'No invoices yet'} body={filtered ? 'Widen the dates.' : 'An invoice is issued automatically when an order is paid.'} compact />
		</div>
	{:else}
		<div class="q-table-wrap">
			<table class="q-table">
				<thead>
					<tr>
						<th scope="col">Number</th>
						<th scope="col">Date</th>
						<th scope="col">Customer</th>
						<th scope="col">Order</th>
						<th scope="col" class="num">Taxable</th>
						<th scope="col" class="num">GST</th>
						<th scope="col" class="num">Total</th>
					</tr>
				</thead>
				<tbody>
					{#each data.documents as doc (doc.id)}
						<tr>
							<td>
								<a class="row-link q-mono" href="/admin/invoices/{doc.id}">{doc.number}</a>
								{#if doc.kind === 'credit_note'}<span class="ml-2"><Chip label="Credit note" tone="warning" dot={false} /></span>{/if}
							</td>
							<td class="text-q-secondary">{shortDate(doc.issuedAt)}</td>
							<td>{doc.buyer.name}<span class="block text-[12px] text-q-tertiary">{doc.buyer.state ?? ''}</span></td>
							<td><a class="q-link q-mono" href="/admin/orders/{doc.orderId}">{doc.orderNumber}</a></td>
							<td class="num">{inr(doc.totals.taxable)}</td>
							<td class="num">{doc.gstRegistered ? inr(doc.totals.cgst + doc.totals.sgst + doc.totals.igst) : '—'}</td>
							<td class="num font-medium text-q-text">{doc.kind === 'credit_note' ? '−' : ''}{inr(doc.totals.total)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<Pager page={data.page} pageSize={data.pageSize} total={data.total} />
	{/if}
</div>
