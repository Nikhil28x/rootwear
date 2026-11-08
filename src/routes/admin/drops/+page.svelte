<script lang="ts">
	import { goto } from '$app/navigation';
	import { CircleAlert, Package, Plus } from '@lucide/svelte';
	import Chip from '$lib/components/admin/ui/Chip.svelte';
	import EmptyState from '$lib/components/admin/ui/EmptyState.svelte';
	import PageHeader from '$lib/components/admin/ui/PageHeader.svelte';
	import { dropNumber, dropState } from '$lib/components/admin/drop-labels';
	import { storefrontStatus } from '$lib/components/admin/storefront';
	import { shortDateTime } from '$lib/components/admin/tone';

	let { data } = $props();

	type Filter = 'all' | 'open' | 'hidden' | 'finished';
	let filter = $state<Filter>('all');

	let rows = $derived(
		data.drops.map((drop) => ({
			drop,
			shop: storefrontStatus({
				state: drop.state,
				published: drop.published,
				preorderMode: drop.preorderMode,
				liveProducts: drop.liveProducts,
				stock: drop.totals.stock
			})
		}))
	);

	const isFinished = (state: string) => state === 'SOLD_OUT' || state === 'ARCHIVED';
	let counts = $derived({
		all: rows.length,
		open: rows.filter((r) => r.shop.open).length,
		hidden: rows.filter((r) => !r.drop.published).length,
		finished: rows.filter((r) => isFinished(r.drop.state)).length
	});
	let shown = $derived(
		rows.filter((r) =>
			filter === 'open'
				? r.shop.open
				: filter === 'hidden'
					? !r.drop.published
					: filter === 'finished'
						? isFinished(r.drop.state)
						: true
		)
	);
	/** A drop that is ready for sale in every way but publication: the easy mistake. */
	let stuck = $derived(
		rows.filter(
			(r) =>
				!r.drop.published && ['LIVE', 'PARTIAL', 'RE_DROP'].includes(r.drop.state)
		)
	);

	const tabs: { id: Filter; label: string }[] = [
		{ id: 'all', label: 'All' },
		{ id: 'open', label: 'Open to order' },
		{ id: 'hidden', label: 'Hidden' },
		{ id: 'finished', label: 'Finished' }
	];
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
			<EmptyState
				icon={Package}
				title="No drops yet"
				body="Create the first drop, then add its pieces, sizes and photos."
			>
				{#snippet action()}
					{#if data.canEdit}<a href="/admin/drops/new" class="q-btn q-btn-primary"
							><Plus /> New drop</a
						>{/if}
				{/snippet}
			</EmptyState>
		</div>
	{:else}
		{#if stuck.length}
			<div
				class="flex items-start gap-3 rounded-[12px] bg-q-warning-tint p-4 text-q-warning-text"
				role="status"
			>
				<CircleAlert size={18} strokeWidth={1.75} class="mt-0.5 flex-none" />
				<div class="flex flex-col gap-1 text-[14px] leading-[20px]">
					<p class="font-medium">
						{stuck.map((r) => `Drop ${dropNumber(r.drop.number)} ${r.drop.name}`).join(' and ')}
						{stuck.length === 1 ? 'is' : 'are'} set to sell but not published, so the shop doesn’t show
						{stuck.length === 1 ? 'it' : 'them'}.
					</p>
					<p>
						Open {stuck.length === 1 ? 'it' : 'one'} and press Publish.
						{#each stuck as r (r.drop.id)}
							<a class="underline" href="/admin/drops/{r.drop.slug}">Drop {dropNumber(r.drop.number)}</a
							>{' '}
						{/each}
					</p>
				</div>
			</div>
		{/if}

		<div class="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter drops">
			{#each tabs as tab (tab.id)}
				<button
					type="button"
					role="tab"
					aria-selected={filter === tab.id}
					class="q-btn q-btn-sm {filter === tab.id ? 'q-btn-secondary' : 'q-btn-ghost'}"
					onclick={() => (filter = tab.id)}
				>
					{tab.label}
					<span class="text-q-tertiary tabular-nums">{counts[tab.id]}</span>
				</button>
			{/each}
		</div>

		{#if shown.length === 0}
			<div class="q-card"><EmptyState icon={Package} title="Nothing here" body="No drop matches this filter." compact /></div>
		{:else}
			<div class="q-table-wrap">
				<table class="q-table">
					<thead>
						<tr>
							<th scope="col">Drop</th>
							<th scope="col">In the shop</th>
							<th scope="col">State</th>
							<th scope="col">Launch (IST)</th>
							<th scope="col" class="num">Live pieces</th>
							<th scope="col" class="num">In stock</th>
							<th scope="col" class="num">Reserved</th>
							<th scope="col" class="num">Sold</th>
						</tr>
					</thead>
					<tbody>
						{#each shown as { drop, shop } (drop.id)}
							{@const state = dropState(drop.state)}
							<tr
								data-href="/admin/drops/{drop.slug}"
								onclick={(e) => {
									if (!(e.target as HTMLElement).closest('a')) goto(`/admin/drops/${drop.slug}`);
								}}
							>
								<td>
									<div class="flex items-center gap-3">
										{#if drop.lead}
											<img
												src={drop.lead}
												alt=""
												class="size-10 flex-none rounded-[8px] bg-q-muted object-cover"
											/>
										{:else}
											<span
												class="flex size-10 flex-none items-center justify-center rounded-[8px] bg-q-muted text-q-tertiary"
												><Package size={16} strokeWidth={1.5} /></span
											>
										{/if}
										<div class="flex flex-col">
											<a href="/admin/drops/{drop.slug}" class="row-link"
												>Drop {dropNumber(drop.number)} — {drop.name}</a
											>
											<span class="text-[13px] text-q-secondary">/drops/{drop.slug}</span>
										</div>
									</div>
								</td>
								<td>
									<Chip label={shop.label} tone={shop.tone} title={shop.headline} />
									{#if shop.hint}<span class="mt-1 block max-w-[28ch] text-[12px] text-q-tertiary"
											>{shop.hint}</span
										>{/if}
								</td>
								<td><Chip label={state.label} tone={state.tone} dot={false} /></td>
								<td class="whitespace-nowrap text-q-secondary">{shortDateTime(drop.launchInstant)}</td
								>
								<td class="num">
									{drop.liveProducts}<span class="text-q-tertiary"> / {drop.products}</span>
									{#if drop.drafts}<span class="block text-[12px] text-q-tertiary"
											>{drop.drafts} draft</span
										>{/if}
								</td>
								<td class="num">{drop.totals.stock}</td>
								<td class="num">{drop.totals.reserved}</td>
								<td class="num">{drop.totals.sold}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	{/if}
</div>
