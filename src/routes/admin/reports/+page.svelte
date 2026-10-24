<script lang="ts">
	import { addPaise, formatInr } from '$lib/money';
	import { DROP_STATE_DESCRIPTION } from '$lib/domain/drop-state';
	import { DEPOSIT_PERCENT_CONFIRMED } from '$lib/config/commerce';
	import SectionHead from '$lib/components/admin/SectionHead.svelte';
	import StatTile from '$lib/components/admin/StatTile.svelte';
	import StatePill from '$lib/components/admin/StatePill.svelte';
	import TableShell from '$lib/components/admin/TableShell.svelte';
	import BarMeter from '$lib/components/admin/BarMeter.svelte';
	import ClaimCurve from '$lib/components/admin/ClaimCurve.svelte';
	import Notice from '$lib/components/admin/Notice.svelte';
	import { dropTone, humanise, shortDateTime } from '$lib/components/admin/tone';

	let { data } = $props();

	let claimed = $derived(
		data.performance.reduce((n, drop) => n + drop.totals.reserved + drop.totals.sold, 0)
	);
	let remaining = $derived(data.performance.reduce((n, drop) => n + drop.totals.remaining, 0));
	let cut = $derived(data.performance.reduce((n, drop) => n + drop.totals.cut, 0));
	// Summed through the money module so the result stays Paise, not a bare number.
	let revenueTotal = $derived(addPaise(...data.revenue.map((row) => row.total)));

	/** Demand, heaviest first: the row that answers "what do we cut next". */
	let topDemand = $derived(
		[...data.demandRows]
			.map((row) => ({ ...row, total: row.requests + row.notifyMe + row.waitlist }))
			.filter((row) => row.total > 0)
			.sort((a, b) => b.total - a.total)
			.slice(0, 10)
	);

	let demandTotal = $derived(
		data.demandRows.reduce((n, row) => n + row.requests + row.notifyMe + row.waitlist, 0)
	);
</script>

<svelte:head>
	<title>Reports — Rootwear operations</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<SectionHead
	level={1}
	eyebrow="Operations"
	title="Reports"
	note="Four numbers decide the next cut: what sold and in what size, what money is still owed, who is waiting, and what came in. Everything below is read live — nothing here is cached or rounded."
/>

{#if data.liveWarning}
	<div class="mt-8">
		<Notice kind="warning">
			{data.liveWarning.length} drops are on sale at once ({data.liveWarning.join(', ')}). The
			storefront resolves a single live drop, so one of these is not reachable from the front page.
			The model permits two deliberately — if this was intended, ignore this.
		</Notice>
	</div>
{/if}

<!-- Summary before detail. -->
<div class="mt-10 grid gap-px bg-white/10 sm:grid-cols-2 xl:grid-cols-4">
	<StatTile
		label="Pieces claimed"
		value="{claimed} / {cut}"
		note="Reserved during the tease plus sold on open sale, across every drop."
	/>
	<StatTile
		label="Still sellable"
		value={String(remaining)}
		note="Stock less pieces already reserved. This is what a visitor can buy right now."
		severity={remaining === 0 ? 'act' : 'none'}
	/>
	<StatTile
		label="Deposits taken"
		value={formatInr(data.ledger.depositsTaken)}
		note="{data.ledger.depositCount} confirmed deposit{data.ledger.depositCount === 1 ? '' : 's'}."
	/>
	<StatTile
		label="Balances overdue"
		value={formatInr(data.ledger.balancesOverdue)}
		note="{data.ledger.balancesOverdueCount} reservation{data.ledger.balancesOverdueCount === 1
			? ''
			: 's'} past the stated due date."
		severity={data.ledger.balancesOverdueCount > 0 ? 'act' : 'none'}
	/>
</div>

<!-- 1. DROP PERFORMANCE ---------------------------------------------------- -->
<section class="mt-20 flex flex-col gap-10">
	<SectionHead
		eyebrow="Report 01"
		title="Drop performance"
		note="Reserved, sold and remaining by size, against time from launch. This is the number that decides how big the next drop is cut."
	/>

	{#each data.performance as drop (drop.dropId)}
		<article class="flex flex-col gap-6 border-t border-white/10 pt-8">
			<div class="flex flex-wrap items-center justify-between gap-4">
				<div class="flex flex-wrap items-center gap-4">
					<h3 class="display text-2xl leading-none tracking-[-0.03em] text-paper">
						Drop {String(drop.number).padStart(2, '0')} — {drop.name}
					</h3>
					<StatePill
						label={humanise(drop.state)}
						tone={dropTone(drop.state)}
						title={DROP_STATE_DESCRIPTION[drop.state]}
					/>
					{#if !drop.published}
						<StatePill label="Unpublished" tone="quiet" />
					{/if}
				</div>
				<p class="text-[13px] text-stone-400 tabular-nums">
					Launch {shortDateTime(drop.launchInstant)} IST · edition of {drop.editionSize}
				</p>
			</div>

			<div class="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
				<TableShell
					caption="Drop {String(drop.number).padStart(2, '0')} by size"
					note="cut = remaining + reserved + sold"
				>
					<thead>
						<tr class="text-[11px] tracking-[0.2em] text-stone-400 uppercase font-medium">
							<th scope="col" class="border-b border-white/10 px-4 py-3 text-left">Size</th>
							<th scope="col" class="border-b border-white/10 px-4 py-3 text-left">SKU</th>
							<th scope="col" class="border-b border-white/10 px-4 py-3 text-right">Cut</th>
							<th scope="col" class="border-b border-white/10 px-4 py-3 text-right">Reserved</th>
							<th scope="col" class="border-b border-white/10 px-4 py-3 text-right">Sold</th>
							<th scope="col" class="border-b border-white/10 px-4 py-3 text-right">Remaining</th>
							<th scope="col" class="border-b border-white/10 px-4 py-3 text-right">Cap</th>
							<th scope="col" class="border-b border-white/10 px-4 py-3 text-left">Split</th>
						</tr>
					</thead>
					<tbody>
						{#each drop.bySize as row (row.variantId)}
							<tr class="text-stone-200">
								<th
									scope="row"
									class="border-b border-white/5 px-4 py-3 text-left text-[15px] font-normal text-paper"
								>
									{row.size}
								</th>
								<td class="border-b border-white/5 px-4 py-3 text-[13px] text-stone-400">{row.sku}</td>
								<td class="border-b border-white/5 px-4 py-3 text-right tabular-nums">{row.cut}</td>
								<td class="border-b border-white/5 px-4 py-3 text-right tabular-nums">
									{row.reserved}
								</td>
								<td class="border-b border-white/5 px-4 py-3 text-right tabular-nums">{row.sold}</td>
								<td
									class="border-b border-white/5 px-4 py-3 text-right tabular-nums {row.remaining ===
									0
										? 'text-gold'
										: ''}"
								>
									{row.remaining}{#if row.remaining === 0}<span class="sr-only">
											— sold out</span
										>{/if}
								</td>
								<td class="border-b border-white/5 px-4 py-3 text-right text-stone-400 tabular-nums">
									{row.reserveCap}
								</td>
								<td class="w-40 border-b border-white/5 px-4 py-3">
									<BarMeter
										sold={row.sold}
										reserved={row.reserved}
										remaining={row.remaining}
										label="{row.size}: {row.sold} sold, {row.reserved} reserved, {row.remaining} remaining"
									/>
								</td>
							</tr>
						{/each}
					</tbody>
					<tfoot>
						<tr class="text-paper">
							<th scope="row" class="px-4 py-3 text-left text-[11px] tracking-[0.2em] uppercase font-medium">
								Total
							</th>
							<td></td>
							<td class="px-4 py-3 text-right tabular-nums">{drop.totals.cut}</td>
							<td class="px-4 py-3 text-right tabular-nums">{drop.totals.reserved}</td>
							<td class="px-4 py-3 text-right tabular-nums">{drop.totals.sold}</td>
							<td class="px-4 py-3 text-right tabular-nums">{drop.totals.remaining}</td>
							<td></td>
							<td></td>
						</tr>
					</tfoot>
				</TableShell>

				<div class="border border-white/10">
					<div class="border-b border-white/10 px-5 py-4">
						<p class="text-[11px] tracking-[0.28em] text-stone-300 uppercase font-medium">Sell-out curve</p>
					</div>
					<ClaimCurve
						points={[...drop.curve]}
						editionSize={drop.editionSize}
						launchInstant={drop.launchInstant}
						now={data.now}
					/>
				</div>
			</div>

			<p class="flex flex-wrap gap-6 text-[13px] text-stone-400">
				<span class="flex items-center gap-2"
					><span class="inline-block h-2 w-4 bg-paper"></span> Sold</span
				>
				<span class="flex items-center gap-2"
					><span class="inline-block h-2 w-4 bg-gold"></span> Reserved</span
				>
				<span class="flex items-center gap-2"
					><span class="inline-block h-2 w-4 bg-white/15"></span> Remaining</span
				>
				<a class="underline underline-offset-4 hover:text-stone-200" href="/admin/drops/{drop.slug}">
					Edit stock and state →
				</a>
			</p>
		</article>
	{:else}
		<Notice kind="info">No drops exist yet. Create one before there is anything to report on.</Notice>
	{/each}
</section>

<!-- 2. PRE-ORDER LEDGER ---------------------------------------------------- -->
<section class="mt-20 flex flex-col gap-8">
	<SectionHead
		eyebrow="Report 02"
		title="Pre-order ledger"
		note={DEPOSIT_PERCENT_CONFIRMED
			? 'Deposits taken, balances still owed, and what has been returned.'
			: 'Deposits taken, balances still owed, and what has been returned. The deposit share is not yet confirmed in writing, so no percentage is printed anywhere — here or on the storefront.'}
	/>

	<div class="grid gap-px bg-white/10 sm:grid-cols-2 xl:grid-cols-4">
		<StatTile
			label="Deposits taken"
			value={formatInr(data.ledger.depositsTaken)}
			note="{data.ledger.depositCount} confirmed. Money already received against reserved pieces."
		/>
		<StatTile
			label="Balances outstanding"
			value={formatInr(data.ledger.balancesOutstanding)}
			note="{data.ledger.balancesOutstandingCount} reservation{data.ledger
				.balancesOutstandingCount === 1
				? ''
				: 's'} holding a piece with the balance unpaid."
			severity={data.ledger.balancesOutstandingCount > 0 ? 'watch' : 'none'}
		/>
		<StatTile
			label="Balances overdue"
			value={formatInr(data.ledger.balancesOverdue)}
			note="Past the due date stated to the customer. A lapsed balance releases the piece to the waitlist."
			severity={data.ledger.balancesOverdueCount > 0 ? 'act' : 'none'}
		/>
		<StatTile
			label="Refunds issued"
			value={formatInr(data.ledger.refundsIssued)}
			note="{data.ledger.refundCount} processed, including automatic refunds to anyone who lost the cap race."
		/>
	</div>

	<p class="text-[15px] leading-relaxed text-stone-400">
		A reservation, its deposit, its balance payment and its final order are one continuous record.
		Open any row in
		<a class="underline underline-offset-4 hover:text-stone-200" href="/admin/reservations"
			>reservations</a
		>
		to see that record end to end.
	</p>
</section>

<!-- 3. DEMAND BOARD -------------------------------------------------------- -->
<section class="mt-20 flex flex-col gap-8">
	<SectionHead
		eyebrow="Report 03"
		title="Demand board"
		note="How many people asked for a drop, and in what size. Requests come from the archive, notify-me from a sold-out size, and the waitlist from an overflowed tease."
	/>

	<TableShell
		caption="Demand by drop and size"
		note="{demandTotal} signal{demandTotal === 1 ? '' : 's'} recorded · heaviest first"
	>
		<thead>
			<tr class="text-[11px] tracking-[0.2em] text-stone-400 uppercase font-medium">
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-left">Drop</th>
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-left">Size</th>
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-right">Requests</th>
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-right">Notify-me</th>
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-right">Waitlist</th>
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-right">Total</th>
			</tr>
		</thead>
		<tbody>
			{#each topDemand as row (row.variantId)}
				<tr class="text-stone-200">
					<td class="border-b border-white/5 px-4 py-3">
						<a
							class="underline decoration-white/25 underline-offset-4 hover:decoration-paper"
							href="/admin/demand?drop={row.dropId}">{row.dropName}</a
						>
					</td>
					<th scope="row" class="border-b border-white/5 px-4 py-3 text-left font-normal text-paper">
						{row.size}
					</th>
					<td class="border-b border-white/5 px-4 py-3 text-right tabular-nums">{row.requests}</td>
					<td class="border-b border-white/5 px-4 py-3 text-right tabular-nums">{row.notifyMe}</td>
					<td class="border-b border-white/5 px-4 py-3 text-right tabular-nums">{row.waitlist}</td>
					<td class="border-b border-white/5 px-4 py-3 text-right text-paper tabular-nums">
						{row.total}
					</td>
				</tr>
			{:else}
				<tr>
					<td colspan="6" class="px-4 py-8 text-[15px] text-stone-400">
						Nobody has asked for anything yet. Requests appear here the moment a drop is finished and
						someone asks for it back.
					</td>
				</tr>
			{/each}
		</tbody>
	</TableShell>

	<p class="text-[15px] text-stone-400">
		<a class="underline underline-offset-4 hover:text-stone-200" href="/admin/demand">
			Open the full demand board, with every individual entry and a CSV export →
		</a>
	</p>
</section>

<!-- 4. REVENUE ------------------------------------------------------------- -->
<section class="mt-20 flex flex-col gap-8">
	<SectionHead
		eyebrow="Report 04"
		title="Revenue by drop"
		note="Captured payments only. The deposit and balance halves stay separate, because a deposit taken is not a sale completed."
	/>

	<TableShell caption="Captured revenue by drop" note="Total {formatInr(revenueTotal)}">
		<thead>
			<tr class="text-[11px] tracking-[0.2em] text-stone-400 uppercase font-medium">
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-left">Drop</th>
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-right">Deposits</th>
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-right">Balances</th>
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-right">Open sale</th>
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-right">Total</th>
			</tr>
		</thead>
		<tbody>
			{#each data.revenue as row (row.dropId)}
				<tr class="text-stone-200">
					<th scope="row" class="border-b border-white/5 px-4 py-3 text-left font-normal text-paper">
						{row.dropName}
					</th>
					<td class="border-b border-white/5 px-4 py-3 text-right tabular-nums">
						{formatInr(row.deposits)}
					</td>
					<td class="border-b border-white/5 px-4 py-3 text-right tabular-nums">
						{formatInr(row.balances)}
					</td>
					<td class="border-b border-white/5 px-4 py-3 text-right tabular-nums">
						{formatInr(row.orders)}
					</td>
					<td class="border-b border-white/5 px-4 py-3 text-right text-paper tabular-nums">
						{formatInr(row.total)}
					</td>
				</tr>
			{:else}
				<tr>
					<td colspan="5" class="px-4 py-8 text-[15px] text-stone-400">Nothing captured yet.</td>
				</tr>
			{/each}
		</tbody>
	</TableShell>

	<p class="text-[13px] leading-relaxed text-stone-400">
		Prices are shown inclusive of tax, as they are to the customer. A payment appears here only once
		the gateway has confirmed capture — the browser redirect is never treated as proof of payment.
	</p>
</section>
