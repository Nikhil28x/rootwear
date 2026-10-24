<script lang="ts">
	import InvoiceDoc from '$lib/components/admin/InvoiceDoc.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>Invoice {data.doc.number} | Rootwear</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="invoice-page">
	<div class="invoice-page__bar">
		<button type="button" onclick={() => window.print()}>Print or save as PDF</button>
	</div>
	<InvoiceDoc doc={data.doc} words={data.words} />
</main>

<style>
	.invoice-page {
		background: #f4f4f5;
		padding: 32px 16px 64px;
		color: #18181b;
	}
	.invoice-page__bar {
		max-width: 210mm;
		margin: 0 auto 16px;
		display: flex;
		justify-content: flex-end;
	}
	.invoice-page__bar button {
		height: 44px;
		padding: 0 20px;
		background: #1f382a;
		color: #fff;
		font-size: 14px;
		cursor: pointer;
	}
	@media print {
		:global(header),
		:global(footer) {
			display: none !important;
		}
		.invoice-page {
			background: #fff;
			padding: 0;
		}
		.invoice-page__bar {
			display: none;
		}
	}
</style>
