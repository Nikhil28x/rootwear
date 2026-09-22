<script lang="ts">
	import { formatInr } from '$lib/money';
	import SectionHead from '$lib/components/admin/SectionHead.svelte';
	import TableShell from '$lib/components/admin/TableShell.svelte';
	import StatePill from '$lib/components/admin/StatePill.svelte';
	import StatTile from '$lib/components/admin/StatTile.svelte';
	import { humanise, relativeDays, reservationTone, shortDateTime } from '$lib/components/admin/tone';

	let { data } = $props();

	function overdue(balanceDueBy: number | null, state: string): boolean {
		return state === 'balance_due' && balanceDueBy !== null && balanceDueBy < data.now;
	}
</script>

<svelte:head>
	<title>Reservations — Rootwear operations</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<SectionHead
	level={1}
	eyebrow="Pre-orders"
	title="Reservations"
	note="One row per reservation, with its state spelled out. The deposit, the balance and the final order all hang off this row — open one to see the whole record end to end."
/>

<div class="mt-10 grid gap-px bg-white/10 sm:grid-cols-2 xl:grid-cols-4">
	<StatTile
		label="Deposits taken"
		value={formatInr(data.ledger.depositsTaken)}
		note="{data.ledger.depositCount} confirmed."
	/>
	<StatTile
		label="Balances outstanding"
		value={formatInr(data.ledger.balancesOutstanding)}
		note="{data.ledger.balancesOutstandingCount} piece{data.ledger.balancesOutstandingCount === 1
			? ''
			: 's'} held against an unpaid balance."
		severity={data.ledger.balancesOutstandingCount > 0 ? 'watch' : 'none'}
	/>
	<StatTile
		label="Overdue"
		value={formatInr(data.ledger.balancesOverdue)}
		note="{data.ledger.balancesOverdueCount} past the stated date. A lapsed balance releases the piece to the waitlist."
		severity={data.ledger.balancesOverdueCount > 0 ? 'act' : 'none'}
	/>
	<StatTile
		label="Refunded"
		value={formatInr(data.ledger.refundsIssued)}
		note="{data.ledger.refundCount} processed, cap-race refunds included."
	/>
</div>

<form method="GET" class="mt-12 flex flex-wrap items-end gap-6 border-y border-white/10 py-6">
	<div class="flex min-w-[14rem] flex-col gap-2">
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
		href="/admin/reservations"
		class="text-[11px] tracking-[0.2em] text-stone-400 uppercase underline underline-offset-4 hover:text-stone-200 font-medium"
	>
		Clear
	</a>
</form>

<div class="mt-12">
	<TableShell
		caption="Reservations"
		note="{data.reservations.length} record{data.reservations.length === 1 ? '' : 's'}"
	>
		<thead>
			<tr class="text-[11px] tracking-[0.2em] text-stone-400 uppercase font-medium">
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-left">Piece</th>
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-left">State</th>
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-left">Drop / size</th>
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-left">Customer</th>
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-right">Locked</th>
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-right">Deposit</th>
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-right">Balance</th>
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-left">Balance due</th>
			</tr>
		</thead>
		<tbody>
			{#each data.reservations as row (row.id)}
				<tr class="text-stone-200">
					<th scope="row" class="border-b border-white/5 px-4 py-3 text-left font-normal">
						<a
							class="text-cream underline decoration-white/25 underline-offset-4 hover:decoration-cream tabular-nums"
							href="/admin/reservations/{row.id}"
						>
							{row.pieceNumber === null ? 'No piece' : `Piece ${row.pieceNumber}`}
						</a>
						<span class="mt-1 block text-[13px] text-stone-400 tabular-nums">
							{shortDateTime(row.createdAt)}
						</span>
					</th>
					<td class="border-b border-white/5 px-4 py-3">
						<StatePill label={humanise(row.state)} tone={reservationTone(row.state)} />
					</td>
					<td class="border-b border-white/5 px-4 py-3 text-[15px]">
						{row.dropName}
						<span class="block text-[13px] text-stone-400">{row.sku} · {row.size}</span>
					</td>
					<td class="border-b border-white/5 px-4 py-3 text-[15px]">{row.email}</td>
					<td class="border-b border-white/5 px-4 py-3 text-right tabular-nums">
						{formatInr(row.lockedPrice)}
					</td>
					<td class="border-b border-white/5 px-4 py-3 text-right tabular-nums">
						{formatInr(row.deposit)}
					</td>
					<td class="border-b border-white/5 px-4 py-3 text-right tabular-nums">
						{formatInr(row.balance)}
					</td>
					<td class="border-b border-white/5 px-4 py-3 text-[13px] whitespace-nowrap tabular-nums">
						{#if row.balanceDueBy === null}
							<span class="text-stone-400">—</span>
						{:else if overdue(row.balanceDueBy, row.state)}
							<span class="text-cream">
								{relativeDays(row.balanceDueBy, data.now)} · overdue
							</span>
						{:else}
							<span class="text-stone-400">{relativeDays(row.balanceDueBy, data.now)}</span>
						{/if}
					</td>
				</tr>
			{:else}
				<tr>
					<td colspan="8" class="px-4 py-10 text-[15px] text-stone-400">
						No reservations in this view. They appear the moment a deposit is confirmed and a piece
						number is allocated.
					</td>
				</tr>
			{/each}
		</tbody>
	</TableShell>
</div>
