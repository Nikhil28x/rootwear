<script lang="ts">
	import { History, Search, X } from '@lucide/svelte';
	import EmptyState from '$lib/components/admin/ui/EmptyState.svelte';
	import PageHeader from '$lib/components/admin/ui/PageHeader.svelte';
	import Pager from '$lib/components/admin/ui/Pager.svelte';
	import { shortDateTime } from '$lib/components/admin/tone';

	let { data } = $props();
	let filtered = $derived(Object.values(data.filters).some(Boolean));
	let expanded = $state<string | null>(null);

	function sentence(action: string): string {
		return action.charAt(0).toUpperCase() + action.slice(1);
	}

	function hasDetail(detail: Record<string, unknown>): boolean {
		return Object.keys(detail).length > 0;
	}
</script>

<svelte:head><title>Audit log · Rootwear admin</title></svelte:head>

<div class="flex flex-col gap-6">
	<PageHeader
		title="Audit log"
		description="Every change made in admin, who made it and when. Entries cannot be edited or deleted."
	/>

	<form method="GET" class="flex flex-wrap items-end gap-2">
		<div class="relative min-w-[220px] flex-1 sm:max-w-[300px]">
			<Search size={16} strokeWidth={1.5} class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-q-tertiary" />
			<label for="audit-q" class="sr-only">Search</label>
			<input id="audit-q" name="q" type="search" class="q-input pl-9" placeholder="Search action or record" value={data.filters.search} />
		</div>
		<div class="flex flex-col gap-1">
			<label for="audit-actor" class="sr-only">Person</label>
			<select id="audit-actor" name="actor" class="q-select w-auto">
				<option value="">Everyone</option>
				{#each data.facets.actors as actor (actor)}
					<option value={actor} selected={data.filters.actor === actor}>{actor}</option>
				{/each}
			</select>
		</div>
		<div class="flex flex-col gap-1">
			<label for="audit-entity" class="sr-only">Record type</label>
			<select id="audit-entity" name="entity" class="q-select w-auto">
				<option value="">All records</option>
				{#each data.facets.entities as entity (entity)}
					<option value={entity} selected={data.filters.entity === entity}>{entity.replace(/_/g, ' ')}</option>
				{/each}
			</select>
		</div>
		<label for="audit-from" class="sr-only">From</label>
		<input id="audit-from" name="from" type="date" class="q-input w-auto" value={data.filters.from} />
		<label for="audit-to" class="sr-only">To</label>
		<input id="audit-to" name="to" type="date" class="q-input w-auto" value={data.filters.to} />
		<button type="submit" class="q-btn q-btn-secondary">Filter</button>
		{#if filtered}<a href="/admin/audit" class="q-btn q-btn-ghost"><X /> Clear</a>{/if}
	</form>

	{#if data.entries.length === 0}
		<div class="q-card">
			<EmptyState
				icon={filtered ? Search : History}
				title={filtered ? 'No changes match' : 'No changes yet'}
				body={filtered ? 'Widen the dates or clear a filter.' : 'Changes to drops, orders, staff and templates are recorded here.'}
				compact
			/>
		</div>
	{:else}
		<div class="q-table-wrap">
			<table class="q-table">
				<thead>
					<tr>
						<th scope="col">When</th>
						<th scope="col">Who</th>
						<th scope="col">What</th>
						<th scope="col">Record</th>
					</tr>
				</thead>
				<tbody>
					{#each data.entries as entry (entry.id)}
						<tr>
							<td class="whitespace-nowrap text-q-secondary">{shortDateTime(entry.occurredAt)}</td>
							<td class="max-w-[220px] truncate">{entry.actor}</td>
							<td>
								<p class="text-q-text">{sentence(entry.action)}</p>
								{#if hasDetail(entry.detail)}
									<button
										type="button"
										class="text-[13px] text-q-secondary underline underline-offset-2 hover:text-q-text"
										aria-expanded={expanded === entry.id}
										onclick={() => (expanded = expanded === entry.id ? null : entry.id)}
									>
										{expanded === entry.id ? 'Hide details' : 'Details'}
									</button>
									{#if expanded === entry.id}
										<pre class="q-mono mt-2 max-w-[560px] overflow-x-auto rounded-[10px] bg-q-muted p-3 text-[12px] leading-[18px] text-q-body">{JSON.stringify(entry.detail, null, 2)}</pre>
									{/if}
								{/if}
							</td>
							<td class="text-q-secondary">
								{entry.entity.replace(/_/g, ' ')}
								{#if entry.entityId}<span class="q-mono block text-[12px] text-q-tertiary">{entry.entityId}</span>{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<Pager page={data.page} pageSize={data.pageSize} total={data.total} />
	{/if}
</div>
