<script lang="ts">
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import Field from '$lib/components/admin/ui/Field.svelte';
	import Section from '$lib/components/admin/ui/Section.svelte';
	import Notice from '$lib/components/admin/Notice.svelte';
	import { submitter } from '$lib/components/admin/enhance';
	import { getToaster } from '$lib/components/admin/toast.svelte';
	import { CircleAlert, Package, Plus } from '@lucide/svelte';
	import Chip from '$lib/components/admin/ui/Chip.svelte';
	import EmptyState from '$lib/components/admin/ui/EmptyState.svelte';
	import PageHeader from '$lib/components/admin/ui/PageHeader.svelte';
	import { dropNumber, dropState } from '$lib/components/admin/drop-labels';
	import { storefrontStatus } from '$lib/components/admin/storefront';
	import { shortDateTime } from '$lib/components/admin/tone';

	let { data, form } = $props();
	const toaster = getToaster();
	const next = $derived(data.nextDrop);

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

	<Section
		title="Next drop in the shop"
		description="The teaser that closes the shop's list of drops. It shows the next issue number on its own; everything else is set here."
	>
		{#if form && 'error' in form && form.error}<Notice kind="error">{form.error}</Notice>{/if}
		<form
			method="POST"
			action="?/nextDrop"
			class="q-card flex flex-col gap-4 p-5"
			use:enhance={submitter(toaster)}
		>
			<fieldset disabled={!data.canEdit} class="flex flex-col gap-4">
				<label class="flex items-center gap-3 text-[14px]">
					<input type="checkbox" class="q-check" name="show" checked={next.show} />
					Show the teaser in the shop
				</label>
				<div class="grid gap-4 sm:grid-cols-2">
					<Field label="Title" id="nd-title">
						{#snippet children({ describedBy })}<input id="nd-title" name="title" class="q-input" maxlength="60" required value={next.title} aria-describedby={describedBy} />{/snippet}
					</Field>
					<Field label="Status line" id="nd-status" help="Beside the dot, e.g. Coming soon, or Opens 1 December.">
						{#snippet children({ describedBy })}<input id="nd-status" name="status" class="q-input" maxlength="60" value={next.status} aria-describedby={describedBy} />{/snippet}
					</Field>
					<Field label="Note" id="nd-note" help="Where a drop shows its piece count, e.g. Growing.">
						{#snippet children({ describedBy })}<input id="nd-note" name="note" class="q-input" maxlength="40" value={next.note} aria-describedby={describedBy} />{/snippet}
					</Field>
					<Field label="Image" id="nd-image" help="A web address or a site path. Empty shows a glimpse of the latest piece.">
						{#snippet children({ describedBy })}<input id="nd-image" name="image" class="q-input" maxlength="500" placeholder="/images/…" value={next.image} aria-describedby={describedBy} />{/snippet}
					</Field>
					<Field label="Link text" id="nd-link-label" help="Empty hides the link.">
						{#snippet children({ describedBy })}<input id="nd-link-label" name="linkLabel" class="q-input" maxlength="60" value={next.linkLabel} aria-describedby={describedBy} />{/snippet}
					</Field>
					<Field label="Link" id="nd-link" help="A web address, or a path like /contact.">
						{#snippet children({ describedBy })}<input id="nd-link" name="linkUrl" class="q-input" maxlength="500" value={next.linkUrl} aria-describedby={describedBy} />{/snippet}
					</Field>
				</div>
			</fieldset>
			{#if data.canEdit}<div><button type="submit" class="q-btn q-btn-primary">Save teaser</button></div>{/if}
		</form>
	</Section>
</div>
