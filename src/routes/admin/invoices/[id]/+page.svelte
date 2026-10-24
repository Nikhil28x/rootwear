<script lang="ts">
	import { Printer } from '@lucide/svelte';
	import InvoiceDoc from '$lib/components/admin/InvoiceDoc.svelte';

	let { data } = $props();
</script>

<svelte:head><title>{data.doc.number} · Rootwear</title></svelte:head>

<div class="flex flex-col gap-4">
	<div class="no-print flex flex-wrap items-center justify-between gap-3">
		<a
			href="/admin/orders/{data.doc.orderId}"
			class="text-[13px] text-q-secondary hover:text-q-text">← Order {data.doc.orderNumber}</a
		>
		<button type="button" class="q-btn q-btn-primary" onclick={() => window.print()}
			><Printer /> Print or save as PDF</button
		>
	</div>
	<div class="overflow-x-auto rounded-[14px] border border-q-border bg-[#fff]">
		<InvoiceDoc doc={data.doc} words={data.words} />
	</div>
</div>

<style>
	@media print {
		.no-print {
			display: none;
		}
		div :global(.rounded-\[14px\]) {
			border: 0 !important;
		}
	}
</style>
