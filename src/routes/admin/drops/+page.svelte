<script lang="ts">
	import SectionHead from '$lib/components/admin/SectionHead.svelte';
	import TableShell from '$lib/components/admin/TableShell.svelte';
	import StatePill from '$lib/components/admin/StatePill.svelte';
	import Notice from '$lib/components/admin/Notice.svelte';
	import { dropTone, humanise, shortDateTime } from '$lib/components/admin/tone';
	import { DROP_STATE_DESCRIPTION } from '$lib/domain/drop-state';

	let { data } = $props();

	function stock(row: (typeof data.rows)[number]) {
		return row.variants.reduce((n, v) => n + v.stockCount, 0);
	}
	function reserved(row: (typeof data.rows)[number]) {
		return row.variants.reduce((n, v) => n + v.reservedCount, 0);
	}
</script>

<svelte:head>
	<title>Drops — Rootwear operations</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<SectionHead
	level={1}
	eyebrow="Catalogue"
	title="Drops"
	note="State, launch instant, stock and caps. A drop is never deleted — a finished one moves to the archive with its story and its price history intact."
/>

{#if data.liveWarning}
	<div class="mt-8">
		<Notice kind="warning">
			{data.liveWarning.length} drops are on sale at once ({data.liveWarning.join(', ')}). The
			storefront resolves a single live drop, so one of these will not be reachable from the front
			page.
		</Notice>
	</div>
{/if}

<div class="mt-10">
	<TableShell caption="Every drop" note="Newest first">
		<thead>
			<tr class="text-[11px] tracking-[0.2em] text-stone-400 uppercase font-medium">
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-left">Drop</th>
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-left">State</th>
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-left">Launch (IST)</th>
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-right">Edition</th>
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-right">Stock</th>
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-right">Reserved</th>
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-left">Published</th>
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-right">Edit</th>
			</tr>
		</thead>
		<tbody>
			{#each data.rows as row (row.id)}
				<tr class="text-stone-200">
					<th scope="row" class="border-b border-white/5 px-4 py-3 text-left font-normal">
						<span class="block text-cream">
							Drop {String(row.number).padStart(2, '0')} — {row.name}
						</span>
						<span class="block text-[13px] text-stone-400">/drops/{row.slug}</span>
					</th>
					<td class="border-b border-white/5 px-4 py-3">
						<StatePill
							label={humanise(row.state)}
							tone={dropTone(row.state)}
							title={DROP_STATE_DESCRIPTION[row.state]}
						/>
					</td>
					<td class="border-b border-white/5 px-4 py-3 text-[13px] whitespace-nowrap tabular-nums">
						{shortDateTime(row.launchInstant)}
					</td>
					<td class="border-b border-white/5 px-4 py-3 text-right tabular-nums">{row.editionSize}</td>
					<td class="border-b border-white/5 px-4 py-3 text-right tabular-nums">{stock(row)}</td>
					<td class="border-b border-white/5 px-4 py-3 text-right tabular-nums">{reserved(row)}</td>
					<td class="border-b border-white/5 px-4 py-3">
						<StatePill
							label={row.published ? 'Live on site' : 'Hidden'}
							tone={row.published ? 'outline' : 'quiet'}
						/>
					</td>
					<td class="border-b border-white/5 px-4 py-3 text-right">
						<a
							class="text-[13px] tracking-[0.16em] text-stone-300 uppercase underline underline-offset-4 hover:text-cream font-medium"
							href="/admin/drops/{row.slug}">Open</a
						>
					</td>
				</tr>
			{:else}
				<tr>
					<td colspan="8" class="px-4 py-10 text-[15px] text-stone-400">
						No drops yet. Drop 01 is seeded by the catalogue fixtures and by migration 0008.
					</td>
				</tr>
			{/each}
		</tbody>
	</TableShell>
</div>
