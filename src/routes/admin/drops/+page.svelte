<script lang="ts">
	import { goto } from '$app/navigation';
	import { Package, Plus } from '@lucide/svelte';
	import Chip from '$lib/components/admin/ui/Chip.svelte';
	import EmptyState from '$lib/components/admin/ui/EmptyState.svelte';
	import PageHeader from '$lib/components/admin/ui/PageHeader.svelte';
	import { dropNumber, dropState } from '$lib/components/admin/drop-labels';
	import { shortDateTime } from '$lib/components/admin/tone';

	let { data } = $props();
</script>

<svelte:head><title>Drops · Rootwear admin</title></svelte:head>

<div class="flex flex-col gap-6">
	<PageHeader
		title="Drops"
		description="Every drop, newest first. A finished drop moves to the archive; nothing is deleted."
	>
		{#snippet actions()}
			{#if data.canEdit && data.drops.length > 0}
				<a href="/admin/drops/new" class="q-btn q-btn-primary"><Plus /> New drop</a>
			{/if}
		{/snippet}
	</PageHeader>

	{#if data.drops.length === 0}
		<div class="q-card">
			<EmptyState icon={Package} title="No drops yet" body="Create the first drop, then add its pieces, sizes and photos.">
				{#snippet action()}
					{#if data.canEdit}<a href="/admin/drops/new" class="q-btn q-btn-primary"><Plus /> New drop</a>{/if}
				{/snippet}
			</EmptyState>
		</div>
	{:else}
		<div class="q-table-wrap">
			<table class="q-table">
				<thead>
					<tr>
						<th scope="col">Drop</th>
						<th scope="col">State</th>
						<th scope="col">Launch (IST)</th>
						<th scope="col" class="num">Products</th>
						<th scope="col" class="num">In stock</th>
						<th scope="col" class="num">Reserved</th>
						<th scope="col" class="num">Sold</th>
						<th scope="col">On the site</th>
					</tr>
				</thead>
				<tbody>
					{#each data.drops as drop (drop.id)}
						{@const state = dropState(drop.state)}
						<tr data-href="/admin/drops/{drop.slug}" onclick={(e) => { if (!(e.target as HTMLElement).closest('a')) goto(`/admin/drops/${drop.slug}`); }}>
							<td>
								<div class="flex items-center gap-3">
									{#if drop.lead}
										<img src={drop.lead} alt="" class="size-10 flex-none rounded-[8px] bg-q-muted object-cover" />
									{:else}
										<span class="flex size-10 flex-none items-center justify-center rounded-[8px] bg-q-muted text-q-tertiary"><Package size={16} strokeWidth={1.5} /></span>
									{/if}
									<div class="flex flex-col">
										<a href="/admin/drops/{drop.slug}" class="row-link">Drop {dropNumber(drop.number)} — {drop.name}</a>
										<span class="text-[13px] text-q-secondary">/drops/{drop.slug}</span>
									</div>
								</div>
							</td>
							<td><Chip label={state.label} tone={state.tone} /></td>
							<td class="whitespace-nowrap text-q-secondary">{shortDateTime(drop.launchInstant)}</td>
							<td class="num">
								{drop.products}
								{#if drop.drafts}<span class="block text-[12px] text-q-tertiary">{drop.drafts} draft</span>{/if}
							</td>
							<td class="num">{drop.totals.stock}</td>
							<td class="num">{drop.totals.reserved}</td>
							<td class="num">{drop.totals.sold}</td>
							<td>
								{#if drop.published}<Chip label="Published" tone="success" />{:else}<Chip label="Hidden" />{/if}
								{#if drop.preorderMode}<span class="mt-1 block text-[12px] text-q-tertiary">Pre-order mode</span>{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
