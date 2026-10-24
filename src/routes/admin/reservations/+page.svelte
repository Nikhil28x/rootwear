<script lang="ts">
	import { goto } from '$app/navigation';
	import { Clock } from '@lucide/svelte';
	import Chip from '$lib/components/admin/ui/Chip.svelte';
	import EmptyState from '$lib/components/admin/ui/EmptyState.svelte';
	import PageHeader from '$lib/components/admin/ui/PageHeader.svelte';
	import Tabs from '$lib/components/admin/ui/Tabs.svelte';
	import StatTile from '$lib/components/admin/StatTile.svelte';
	import { RESERVATION_STATE, label } from '$lib/components/admin/labels';
	import { relativeDays, shortDateTime } from '$lib/components/admin/tone';
	import { formatInr } from '$lib/money';

	/**
	 * §08: "A reservation, its deposit, its balance payment and its final order
	 * are ONE CONTINUOUS RECORD … admin sees one row with a clear state."
	 */
	let { data } = $props();

	function overdue(balanceDueBy: number | null, state: string): boolean {
		return state === 'balance_due' && balanceDueBy !== null && balanceDueBy < data.now;
	}
</script>

<svelte:head><title>Pre-orders · Rootwear admin</title></svelte:head>

<div class="flex flex-col gap-6">
	<PageHeader
		title="Pre-orders"
		description="One row per reserved piece. The deposit, the balance and the final order all hang off it; open one to see the whole record."
	/>

	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<StatTile
			label="Deposits taken"
			value={formatInr(data.ledger.depositsTaken)}
			note="{data.ledger.depositCount} confirmed"
		/>
		<StatTile
			label="Balances outstanding"
			value={formatInr(data.ledger.balancesOutstanding)}
			note="{data.ledger.balancesOutstandingCount} piece{data.ledger.balancesOutstandingCount === 1
				? ''
				: 's'} waiting"
			severity={data.ledger.balancesOutstandingCount > 0 ? 'watch' : 'none'}
		/>
		<StatTile
			label="Overdue"
			value={formatInr(data.ledger.balancesOverdue)}
			note="{data.ledger.balancesOverdueCount} past the due date"
			severity={data.ledger.balancesOverdueCount > 0 ? 'act' : 'none'}
		/>
		<StatTile
			label="Refunded"
			value={formatInr(data.ledger.refundsIssued)}
			note="{data.ledger.refundCount} refunds"
		/>
	</div>

	<Tabs
		label="Pre-order states"
		tabs={[
			{ href: '/admin/reservations', label: 'All', exact: true },
			{ href: '/admin/reservations?state=reserved', label: 'Reserved' },
			{ href: '/admin/reservations?state=balance_due', label: 'Balance due' },
			{ href: '/admin/reservations?state=balance_paid', label: 'Ready to ship' },
			{ href: '/admin/reservations?state=dispatched', label: 'Dispatched' },
			{ href: '/admin/reservations?state=cancelled', label: 'Cancelled' }
		]}
	/>

	{#if data.reservations.length === 0}
		<div class="q-card">
			<EmptyState
				icon={Clock}
				title="No pre-orders here"
				body="A row appears the moment a deposit is confirmed and a piece number is given."
				compact
			/>
		</div>
	{:else}
		<div class="q-table-wrap">
			<table class="q-table">
				<thead>
					<tr>
						<th scope="col">Piece</th>
						<th scope="col">State</th>
						<th scope="col">Drop and size</th>
						<th scope="col">Customer</th>
						<th scope="col" class="num">Locked price</th>
						<th scope="col" class="num">Deposit</th>
						<th scope="col" class="num">Balance</th>
						<th scope="col">Balance due</th>
					</tr>
				</thead>
				<tbody>
					{#each data.reservations as row (row.id)}
						{@const st = label(RESERVATION_STATE, row.state)}
						<tr
							data-href="/admin/reservations/{row.id}"
							onclick={(e) => {
								if (!(e.target as HTMLElement).closest('a')) goto(`/admin/reservations/${row.id}`);
							}}
						>
							<td>
								<a class="row-link" href="/admin/reservations/{row.id}"
									>{row.pieceNumber === null ? 'No piece yet' : `No. ${row.pieceNumber}`}</a
								>
								<span class="block text-[12px] text-q-tertiary">{shortDateTime(row.createdAt)}</span
								>
							</td>
							<td><Chip label={st.label} tone={st.tone} /></td>
							<td
								>{row.dropName}<span class="q-mono block text-[12px] text-q-tertiary"
									>{row.sku}</span
								></td
							>
							<td class="text-q-secondary">{row.email}</td>
							<td class="num">{formatInr(row.lockedPrice)}</td>
							<td class="num">{formatInr(row.deposit)}</td>
							<td class="num">{formatInr(row.balance)}</td>
							<td class="whitespace-nowrap">
								{#if row.balanceDueBy === null}
									<span class="text-q-tertiary">—</span>
								{:else if overdue(row.balanceDueBy, row.state)}
									<span class="font-medium text-q-danger-text"
										>{relativeDays(row.balanceDueBy, data.now)} · overdue</span
									>
								{:else}
									<span class="text-q-secondary">{relativeDays(row.balanceDueBy, data.now)}</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
