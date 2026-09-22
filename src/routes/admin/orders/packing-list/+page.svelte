<script lang="ts">
	import SectionHead from '$lib/components/admin/SectionHead.svelte';
	import Notice from '$lib/components/admin/Notice.svelte';
	import { BUSINESS_NAME, SUPPORT_EMAIL } from '$lib/content/business';
	import { RETURNS_SHORT } from '$lib/content/returns';
	import { shortDate } from '$lib/components/admin/tone';

	let { data } = $props();

	let pieceTotal = $derived(
		data.entries.reduce(
			(n, entry) => n + entry.lines.reduce((m, line) => m + line.quantity, 0),
			0
		)
	);
</script>

<svelte:head>
	<title>Packing list — Rootwear operations</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="no-print">
	<SectionHead
		level={1}
		eyebrow="Fulfilment"
		title="Packing list"
		note="Everything paid or packed and not yet dispatched. Print this, work down it, then mark each order dispatched with its reference. There is no carrier integration in this phase — the labels below are cut-and-stick."
	>
		{#snippet actions()}
			<button
				type="button"
				onclick={() => window.print()}
				class="border border-gold px-7 py-3 text-[11px] tracking-[0.2em] text-gold uppercase transition hover:bg-gold hover:text-forest-black font-medium"
			>
				Print
			</button>
			<a
				href="/admin/orders"
				class="border border-white/35 px-7 py-3 text-[11px] tracking-[0.2em] text-stone-100 uppercase transition hover:bg-white hover:text-black font-medium"
			>
				Back to orders
			</a>
		{/snippet}
	</SectionHead>

	<p class="mt-8 text-[15px] text-stone-400 tabular-nums">
		{data.entries.length} order{data.entries.length === 1 ? '' : 's'} · {pieceTotal} piece{pieceTotal ===
		1
			? ''
			: 's'} · prepared {shortDate(data.now)}
	</p>

	{#if data.entries.length === 0}
		<div class="mt-8">
			<Notice kind="info">
				Nothing is waiting to be packed. Orders appear here once payment is captured and leave once
				they are marked dispatched.
			</Notice>
		</div>
	{/if}
</div>

<!-- The printable sheet. Kept on its own surface so print CSS has one target. -->
<div class="packing-sheet mt-12 flex flex-col gap-6">
	{#each data.entries as entry, index (entry.orderId)}
		<article class="packing-card grid gap-8 border border-white/15 p-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
			<div class="flex flex-col gap-5">
				<div class="flex flex-wrap items-baseline justify-between gap-3">
					<p class="text-[15px] tracking-[0.2em] text-cream uppercase tabular-nums font-medium">
						{String(index + 1).padStart(2, '0')} · {entry.orderNumber}
					</p>
					{#if entry.isPreOrder}
						<p class="text-[11px] tracking-[0.2em] text-gold uppercase font-medium">
							Pre-order · include the dispatch note
						</p>
					{/if}
				</div>

				<ul class="flex flex-col gap-3">
					{#each entry.lines as line, lineIndex (lineIndex)}
						<li class="flex flex-wrap items-baseline justify-between gap-4 border-b border-white/10 pb-3">
							<span class="text-[15px] text-stone-200">
								{line.name}
								<span class="ml-3 text-[13px] tracking-[0.16em] text-stone-400 uppercase font-medium">
									{line.sku}
								</span>
							</span>
							<span class="text-[15px] text-cream tabular-nums">
								Size {line.size ?? '—'} · ×{line.quantity}
								{#if line.pieceNumber !== null}
									· piece {line.pieceNumber}
								{/if}
							</span>
						</li>
					{/each}
				</ul>

				{#if entry.notes}
					<p class="border-l-2 border-gold px-4 py-2 text-[15px] leading-relaxed text-stone-300">
						Customer note: {entry.notes}
					</p>
				{/if}

				<p class="text-[13px] text-stone-400">{RETURNS_SHORT}</p>
			</div>

			<!-- Address label: cut on the rule. -->
			<div class="address-label flex flex-col justify-between gap-6 border border-dashed border-white/25 p-5">
				<address class="text-[15px] leading-relaxed text-stone-100 not-italic">
					{entry.shipTo.name}<br />
					{entry.shipTo.line1}<br />
					{#if entry.shipTo.line2}{entry.shipTo.line2}<br />{/if}
					{entry.shipTo.city}, {entry.shipTo.state}<br />
					<span class="text-base tracking-[0.12em] tabular-nums">{entry.shipTo.pincode}</span><br />
					{entry.shipTo.country} · <span class="tabular-nums">{entry.shipTo.phone}</span>
				</address>
				<p class="text-[11px] leading-relaxed tracking-[0.14em] text-stone-400 uppercase font-medium">
					From {BUSINESS_NAME}<br />{SUPPORT_EMAIL}
				</p>
			</div>
		</article>
	{/each}
</div>

<style>
	/* One card per sheet, and the chrome falls away entirely. Black on white:
	   printing the dark surface would empty a cartridge for no benefit. */
	@media print {
		:global(body) {
			background: white;
		}

		.no-print {
			display: none;
		}

		.packing-sheet {
			gap: 0;
			margin: 0;
			color: black;
		}

		.packing-card {
			page-break-after: always;
			break-after: page;
			padding: 0;
			border: 0;
			color: black;
		}

		.packing-card :global(*) {
			color: black !important;
		}

		.address-label {
			border: 1px dashed black;
		}
	}
</style>
