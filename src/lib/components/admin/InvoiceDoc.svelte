<script lang="ts">
	/**
	 * One invoice or credit note, laid out for an A4 page. Always light, in
	 * admin's dark mode too: it is a piece of paper.
	 *
	 * Plain invoice while the business is not GST registered; a tax invoice
	 * (GSTIN, HSN, taxable value, CGST + SGST or IGST) once it is. The figures
	 * come frozen from app.invoices, never recomputed here.
	 */
	type Doc = {
		kind: 'invoice' | 'credit_note';
		number: string;
		orderNumber: string;
		issuedAt: number;
		gstRegistered: boolean;
		intraState: boolean;
		against: string | null;
		seller: {
			legalName: string;
			tradeName: string;
			address: string;
			state: string | null;
			stateCode: string | null;
			gstin: string | null;
			email: string | null;
			phone: string | null;
			footer: string;
			signatory: string;
			pan: string;
		};
		buyer: {
			name: string;
			address: string;
			state: string | null;
			stateCode: string | null;
			email: string | null;
			phone: string | null;
		};
		lines: readonly {
			description: string;
			detail: string | null;
			sku: string | null;
			hsn: string | null;
			quantity: number;
			unitPrice: number;
			gross: number;
			taxRate: number;
			taxable: number;
			cgst: number;
			sgst: number;
			igst: number;
		}[];
		totals: {
			subtotal: number;
			shipping: number;
			discount: number;
			taxable: number;
			cgst: number;
			sgst: number;
			igst: number;
			total: number;
		};
	};

	let { doc, words }: { doc: Doc; words: string } = $props();

	const inr = (paise: number) =>
		(paise / 100).toLocaleString('en-IN', {
			style: 'currency',
			currency: 'INR',
			minimumFractionDigits: 2
		});
	const date = (ms: number) =>
		new Intl.DateTimeFormat('en-IN', {
			day: '2-digit',
			month: 'short',
			year: 'numeric',
			timeZone: 'Asia/Kolkata'
		}).format(ms);

	let title = $derived(
		doc.kind === 'credit_note' ? 'Credit note' : doc.gstRegistered ? 'Tax invoice' : 'Invoice'
	);
	let tax = $derived(doc.gstRegistered);
</script>

<article class="doc">
	<header class="doc__head">
		<div>
			<p class="doc__brand">{doc.seller.tradeName}</p>
			<p class="doc__muted">{doc.seller.legalName}</p>
			<p class="doc__muted">{doc.seller.address}</p>
			{#if doc.seller.gstin}<p><strong>GSTIN</strong> {doc.seller.gstin}</p>{/if}
			{#if doc.seller.email || doc.seller.phone}<p class="doc__muted">
					{[doc.seller.email, doc.seller.phone].filter(Boolean).join(' · ')}
				</p>{/if}
		</div>
		<div class="doc__meta">
			<h1>{title}</h1>
			<dl>
				<dt>Number</dt>
				<dd>{doc.number}</dd>
				<dt>Date</dt>
				<dd>{date(doc.issuedAt)}</dd>
				<dt>Order</dt>
				<dd>{doc.orderNumber}</dd>
				{#if doc.against}<dt>Against</dt>
					<dd>{doc.against}</dd>{/if}
				{#if tax && doc.buyer.state}<dt>Place of supply</dt>
					<dd>{doc.buyer.state}{doc.buyer.stateCode ? ` (${doc.buyer.stateCode})` : ''}</dd>{/if}
			</dl>
		</div>
	</header>

	<section class="doc__party">
		<p class="doc__label">Bill and ship to</p>
		<p><strong>{doc.buyer.name}</strong></p>
		<p>{doc.buyer.address}</p>
		<p class="doc__muted">{[doc.buyer.phone, doc.buyer.email].filter(Boolean).join(' · ')}</p>
	</section>

	<table class="doc__table">
		<thead>
			<tr>
				<th>#</th>
				<th>Item</th>
				{#if tax}<th>HSN/SAC</th>{/if}
				<th class="num">Qty</th>
				<th class="num">Rate</th>
				{#if tax}
					<th class="num">Taxable</th>
					{#if doc.intraState}<th class="num">CGST</th><th class="num">SGST</th>{:else}<th
							class="num">IGST</th
						>{/if}
				{/if}
				<th class="num">Amount</th>
			</tr>
		</thead>
		<tbody>
			{#each doc.lines as line, i (i)}
				<tr>
					<td>{i + 1}</td>
					<td>
						{line.description}
						{#if line.detail || line.sku}<span class="doc__muted doc__small"
								>{[line.detail, line.sku].filter(Boolean).join(' · ')}</span
							>{/if}
					</td>
					{#if tax}<td>{line.hsn ?? ''}</td>{/if}
					<td class="num">{line.quantity}</td>
					<td class="num">{inr(line.unitPrice)}</td>
					{#if tax}
						<td class="num">{inr(line.taxable)}</td>
						{#if doc.intraState}
							<td class="num"
								>{inr(line.cgst)}<span class="doc__small doc__muted">{line.taxRate / 2}%</span></td
							>
							<td class="num"
								>{inr(line.sgst)}<span class="doc__small doc__muted">{line.taxRate / 2}%</span></td
							>
						{:else}
							<td class="num"
								>{inr(line.igst)}<span class="doc__small doc__muted">{line.taxRate}%</span></td
							>
						{/if}
					{/if}
					<td class="num">{inr(line.gross)}</td>
				</tr>
			{/each}
		</tbody>
	</table>

	<section class="doc__totals">
		<p class="doc__words"><span class="doc__label">Amount in words</span>{words}</p>
		<dl>
			{#if doc.totals.discount}<dt>Discount</dt>
				<dd>−{inr(doc.totals.discount)}</dd>{/if}
			{#if tax}
				<dt>Taxable value</dt>
				<dd>{inr(doc.totals.taxable)}</dd>
				{#if doc.intraState}
					<dt>CGST</dt>
					<dd>{inr(doc.totals.cgst)}</dd>
					<dt>SGST</dt>
					<dd>{inr(doc.totals.sgst)}</dd>
				{:else}
					<dt>IGST</dt>
					<dd>{inr(doc.totals.igst)}</dd>
				{/if}
			{/if}
			<dt class="doc__grand">{doc.kind === 'credit_note' ? 'Credited' : 'Total'}</dt>
			<dd class="doc__grand">{inr(doc.totals.total)}</dd>
		</dl>
	</section>

	<footer class="doc__foot">
		{#if !tax}<p class="doc__muted">
				The seller is not registered under GST; no GST is charged on this invoice.
			</p>{:else}<p class="doc__muted">
				Prices include GST. Tax payable on reverse charge: No.
			</p>{/if}
		{#if doc.seller.footer}<p>{doc.seller.footer}</p>{/if}
		<div class="doc__sign">
			<p>For {doc.seller.legalName}</p>
			<p class="doc__line">{doc.seller.signatory || 'Authorised signatory'}</p>
		</div>
		<p class="doc__muted doc__small">This is a computer-generated document.</p>
	</footer>
</article>

<style>
	.doc {
		width: 100%;
		max-width: 210mm;
		margin: 0 auto;
		padding: 16mm 14mm;
		background: #fff;
		color: #18181b;
		font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
		font-size: 12px;
		line-height: 1.5;
		font-variant-numeric: tabular-nums;
	}
	.doc p {
		margin: 0;
	}
	.doc__head {
		display: flex;
		justify-content: space-between;
		gap: 24px;
		padding-bottom: 16px;
		border-bottom: 1px solid #d4d4d8;
	}
	.doc__brand {
		font-size: 18px;
		font-weight: 600;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: #1f382a;
		margin-bottom: 4px !important;
	}
	.doc__meta {
		text-align: right;
	}
	.doc__meta h1 {
		font-size: 18px;
		font-weight: 600;
		margin: 0 0 8px;
	}
	.doc dl {
		display: grid;
		grid-template-columns: auto auto;
		gap: 2px 16px;
		margin: 0;
		justify-content: end;
	}
	.doc dt {
		color: #52525b;
	}
	.doc dd {
		margin: 0;
		text-align: right;
		white-space: nowrap;
	}
	.doc__party {
		padding: 16px 0;
	}
	.doc__label {
		display: block;
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #6b6b74;
		margin-bottom: 4px !important;
	}
	.doc__muted {
		color: #52525b;
	}
	.doc__small {
		display: block;
		font-size: 10.5px;
	}
	.doc__table {
		width: 100%;
		border-collapse: collapse;
		margin: 8px 0 16px;
	}
	.doc__table th {
		text-align: left;
		font-weight: 500;
		font-size: 11px;
		color: #52525b;
		border-bottom: 1px solid #d4d4d8;
		padding: 6px 6px;
	}
	.doc__table td {
		padding: 8px 6px;
		border-bottom: 1px solid #e4e4e7;
		vertical-align: top;
	}
	.doc .num {
		text-align: right;
		white-space: nowrap;
	}
	.doc__totals {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 24px;
	}
	.doc__words {
		max-width: 55%;
	}
	.doc__grand {
		font-size: 14px;
		font-weight: 600;
		color: #18181b !important;
		padding-top: 6px;
		border-top: 1px solid #d4d4d8;
	}
	.doc__foot {
		margin-top: 28px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.doc__sign {
		align-self: flex-end;
		text-align: right;
		margin-top: 24px;
	}
	.doc__line {
		margin-top: 36px !important;
		padding-top: 4px;
		border-top: 1px solid #a1a1aa;
		min-width: 180px;
	}
	@media print {
		.doc {
			padding: 0;
			max-width: none;
		}
	}
</style>
