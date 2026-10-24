<script lang="ts">
	import { enhance } from '$app/forms';
	import { PackageOpen } from '@lucide/svelte';
	import EmptyState from '$lib/components/admin/ui/EmptyState.svelte';
	import Field from '$lib/components/admin/ui/Field.svelte';
	import Section from '$lib/components/admin/ui/Section.svelte';
	import Notice from '$lib/components/admin/Notice.svelte';
	import { submitter } from '$lib/components/admin/enhance';
	import { getToaster } from '$lib/components/admin/toast.svelte';
	import { shortDateTime } from '$lib/components/admin/tone';

	let { data, form } = $props();
	const toaster = getToaster();

	let product = $derived(data.product);
	let edits = $state<Record<string, { stock: number; cap: number }>>({});
	$effect.pre(() => {
		edits = Object.fromEntries(data.product.variants.map((v) => [v.id, { stock: v.stock, cap: v.reserveCap }]));
	});
	let dirty = $derived(
		product.variants.filter((v) => edits[v.id] && (edits[v.id].stock !== v.stock || edits[v.id].cap !== v.reserveCap)).length
	);

	let groups = $derived(
		product.colourways.length
			? product.colourways.map((c) => ({ id: c.id, name: c.name, swatch: c.swatch, variants: product.variants.filter((v) => v.colourwayId === c.id) }))
			: [{ id: 'none', name: null, swatch: null, variants: product.variants }]
	);

	let skuOf = $derived(new Map(product.variants.map((v) => [v.id, `${v.sku}`])));
	const REASON_LABEL = $derived(new Map<string, string>(data.reasons.map((r) => [r.value, r.label])));
</script>

<svelte:head><title>Stock · {product.name} · Rootwear admin</title></svelte:head>

{#if form?.error}<Notice kind="error">{form.error}</Notice>{/if}

{#if product.variants.length === 0}
	<div class="q-card">
		<EmptyState icon={PackageOpen} title="No sizes yet" body="Pick the sizes on the Details tab, then set stock here." compact />
	</div>
{:else}
	<form method="POST" action="?/save" class="flex flex-col gap-4" use:enhance={submitter(toaster)}>
		<div class="q-table-wrap">
			<table class="q-table">
				<thead>
					<tr>
						<th scope="col">Size</th>
						<th scope="col">SKU</th>
						<th scope="col" class="num">In stock</th>
						<th scope="col" class="num" title="§08: tease reservations allowed for this size">Reservation cap</th>
						<th scope="col" class="num">Reserved</th>
						<th scope="col" class="num">Sold</th>
						<th scope="col" class="num">Can sell</th>
					</tr>
				</thead>
				{#each groups as group (group.id)}
					<tbody>
						{#if group.name}
							<tr>
								<th colspan="7" scope="colgroup" class="!static bg-q-muted !py-2 text-q-text">
									<span class="flex items-center gap-2">
										{#if group.swatch}<span class="size-3 rounded-full" style="background:{group.swatch}"></span>{/if}
										{group.name}
									</span>
								</th>
							</tr>
						{/if}
						{#each group.variants as variant (variant.id)}
							{@const edit = edits[variant.id]}
							{#if edit}
								<tr>
									<td class="font-medium text-q-text">{variant.size}</td>
									<td class="q-mono text-q-secondary">{variant.sku}</td>
									<td class="num">
										<input name="stock_{variant.id}" type="number" min={variant.reserved} aria-label="{variant.sku} in stock" class="q-input q-input-sm ml-auto w-20 text-right tabular-nums" bind:value={edit.stock} disabled={!data.canEdit} />
									</td>
									<td class="num">
										<input name="cap_{variant.id}" type="number" min={variant.reserved} max={edit.stock} aria-label="{variant.sku} reservation cap" class="q-input q-input-sm ml-auto w-20 text-right tabular-nums" bind:value={edit.cap} disabled={!data.canEdit} />
									</td>
									<td class="num">{variant.reserved}</td>
									<td class="num">{variant.sold}</td>
									<td class="num font-medium {edit.stock - variant.reserved <= 0 ? 'text-q-danger-text' : 'text-q-text'}">{Math.max(0, edit.stock - variant.reserved)}</td>
								</tr>
							{/if}
						{/each}
					</tbody>
				{/each}
			</table>
		</div>

		{#if data.canEdit}
			<div class="flex flex-wrap items-end gap-3">
				<Field label="Reason" id="st-reason">
					{#snippet children({ describedBy })}
						<select id="st-reason" name="reason" class="q-select w-56" aria-describedby={describedBy}>
							{#each data.reasons as reason (reason.value)}
								<option value={reason.value} selected={reason.value === 'restock'}>{reason.label}</option>
							{/each}
						</select>
					{/snippet}
				</Field>
				<Field label="Note" id="st-note" optional class="min-w-[220px] flex-1">
					{#snippet children({ describedBy })}
						<input id="st-note" name="note" class="q-input" placeholder="e.g. second batch from the mill" aria-describedby={describedBy} />
					{/snippet}
				</Field>
				<button type="submit" class="q-btn q-btn-primary" disabled={dirty === 0}>
					{dirty ? `Save ${dirty} change${dirty === 1 ? '' : 's'}` : 'Save stock'}
				</button>
			</div>
			<p class="q-help">“Can sell” is stock less reservations. Sales come off stock automatically when an order is placed.</p>
		{/if}
	</form>

	<Section title="Changes" description="Every manual change to stock, newest first. Sales are on each order.">
		{#if data.movements.length === 0}
			<p class="text-[14px] text-q-secondary">No manual changes yet.</p>
		{:else}
			<div class="q-table-wrap">
				<table class="q-table">
					<thead><tr><th scope="col">When</th><th scope="col">SKU</th><th scope="col" class="num">Change</th><th scope="col" class="num">After</th><th scope="col">Reason</th><th scope="col">By</th></tr></thead>
					<tbody>
						{#each data.movements as move (move.id)}
							<tr>
								<td class="whitespace-nowrap text-q-secondary">{shortDateTime(move.at)}</td>
								<td class="q-mono">{skuOf.get(move.variantId) ?? move.variantId}</td>
								<td class="num font-medium {move.delta > 0 ? 'text-q-success-text' : 'text-q-danger-text'}">{move.delta > 0 ? '+' : ''}{move.delta}</td>
								<td class="num">{move.stockAfter}</td>
								<td>{REASON_LABEL.get(move.reason) ?? move.reason}{#if move.note}<span class="block text-[13px] text-q-secondary">{move.note}</span>{/if}</td>
								<td class="text-q-secondary">{move.actor ?? '—'}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</Section>
{/if}
