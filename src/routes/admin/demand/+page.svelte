<script lang="ts">
	import SectionHead from '$lib/components/admin/SectionHead.svelte';
	import TableShell from '$lib/components/admin/TableShell.svelte';
	import StatePill from '$lib/components/admin/StatePill.svelte';
	import StatTile from '$lib/components/admin/StatTile.svelte';
	import Notice from '$lib/components/admin/Notice.svelte';
	import { dropTone, humanise, shortDateTime } from '$lib/components/admin/tone';
	import { SIZES } from '$lib/drop/sizes';

	let { data } = $props();

	/** One block per drop, sizes in garment order rather than alphabetical. */
	let boards = $derived.by(() => {
		const byDrop = new Map<
			string,
			{ dropId: string; dropName: string; dropSlug: string; dropState: string; rows: typeof data.rows }
		>();
		for (const row of data.rows) {
			const existing = byDrop.get(row.dropId);
			if (existing) existing.rows = [...existing.rows, row];
			else
				byDrop.set(row.dropId, {
					dropId: row.dropId,
					dropName: row.dropName,
					dropSlug: row.dropSlug,
					dropState: row.dropState,
					rows: [row]
				});
		}
		return [...byDrop.values()].map((board) => ({
			...board,
			rows: [...board.rows].sort((a, b) => SIZES.indexOf(a.size) - SIZES.indexOf(b.size))
		}));
	});

	let totals = $derived({
		requests: data.rows.reduce((n, r) => n + r.requests, 0),
		notifyMe: data.rows.reduce((n, r) => n + r.notifyMe, 0),
		waitlist: data.rows.reduce((n, r) => n + r.waitlist, 0)
	});

	let exportHref = $derived.by(() => {
		const params = new URLSearchParams();
		if (data.filter.dropId) params.set('drop', data.filter.dropId);
		if (data.filter.kind) params.set('kind', data.filter.kind);
		const query = params.toString();
		return query ? `/admin/demand/export?${query}` : '/admin/demand/export';
	});

	const KIND_LABEL: Record<string, string> = {
		request: 'Requested',
		notify_me: 'Notify me',
		waitlist: 'Waitlist'
	};

	const SORTS = [
		{ value: 'newest', label: 'Newest first' },
		{ value: 'oldest', label: 'Oldest first' },
		{ value: 'drop', label: 'By drop' },
		{ value: 'size', label: 'By size' },
		{ value: 'kind', label: 'By kind' }
	];
</script>

<svelte:head>
	<title>Demand board — Rootwear operations</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<SectionHead
	level={1}
	eyebrow="Report 03 in full"
	title="Demand board"
	note="Every signal that somebody wants a piece: a request for a finished drop to come back, a notify-me on a sold-out size, or a place in the waitlist when a tease overflowed. Counts first, then the individual entries with dates."
/>

<div class="mt-10 grid gap-px bg-white/10 sm:grid-cols-3">
	<StatTile
		label="Drop requests"
		value={String(totals.requests)}
		note="Asked for a finished drop to come back, in a stated size."
	/>
	<StatTile
		label="Notify-me"
		value={String(totals.notifyMe)}
		note="Sitting on a sold-out size, waiting to be told it is back."
	/>
	<StatTile
		label="Waitlist"
		value={String(totals.waitlist)}
		note="Ordered queue from an overflowed tease. First in the queue for any release."
	/>
</div>

<!-- Filter / sort. A GET form, so it works with no JavaScript. -->
<form method="GET" class="mt-12 flex flex-wrap items-end gap-6 border-y border-white/10 py-6">
	<div class="flex min-w-[12rem] flex-col gap-2">
		<label for="f-drop" class="text-[11px] tracking-[0.2em] text-stone-400 uppercase font-medium">Drop</label>
		<select
			id="f-drop"
			name="drop"
			value={data.filter.dropId}
			class="w-full border-b border-white/25 bg-transparent px-0 py-2.5 text-[15px] text-stone-100 outline-none focus:border-white"
		>
			<option value="">Every drop</option>
			{#each data.drops as drop (drop.id)}
				<option value={drop.id}>{drop.label}</option>
			{/each}
		</select>
	</div>

	<div class="flex min-w-[10rem] flex-col gap-2">
		<label for="f-kind" class="text-[11px] tracking-[0.2em] text-stone-400 uppercase font-medium">Kind</label>
		<select
			id="f-kind"
			name="kind"
			value={data.filter.kind}
			class="w-full border-b border-white/25 bg-transparent px-0 py-2.5 text-[15px] text-stone-100 outline-none focus:border-white"
		>
			<option value="">All three</option>
			<option value="request">Drop requests</option>
			<option value="notify_me">Notify-me</option>
			<option value="waitlist">Waitlist</option>
		</select>
	</div>

	<div class="flex min-w-[10rem] flex-col gap-2">
		<label for="f-sort" class="text-[11px] tracking-[0.2em] text-stone-400 uppercase font-medium">Sort</label>
		<select
			id="f-sort"
			name="sort"
			value={data.filter.sort}
			class="w-full border-b border-white/25 bg-transparent px-0 py-2.5 text-[15px] text-stone-100 outline-none focus:border-white"
		>
			{#each SORTS as option (option.value)}
				<option value={option.value}>{option.label}</option>
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
		href={exportHref}
		class="border border-gold px-7 py-3 text-[11px] tracking-[0.2em] text-gold uppercase transition hover:bg-gold hover:text-forest-black font-medium"
		data-sveltekit-reload
	>
		Export CSV
	</a>
	<a
		href="/admin/demand"
		class="text-[11px] tracking-[0.2em] text-stone-400 uppercase underline underline-offset-4 hover:text-stone-200 font-medium"
	>
		Clear
	</a>
</form>

<!-- Counts by size, per drop. -->
<section class="mt-14 flex flex-col gap-10">
	<SectionHead eyebrow="Summary" title="By drop and size" />

	{#each boards as board (board.dropId)}
		<div class="flex flex-col gap-4">
			<div class="flex flex-wrap items-center gap-4">
				<h3 class="display text-xl leading-none tracking-[-0.03em] text-cream">{board.dropName}</h3>
				<StatePill label={humanise(board.dropState)} tone={dropTone(board.dropState)} />
			</div>

			<TableShell caption="{board.dropName} demand by size" captionVisible={false}>
				<thead>
					<tr class="text-[11px] tracking-[0.2em] text-stone-400 uppercase font-medium">
						<th scope="col" class="border-b border-white/10 px-4 py-3 text-left">Size</th>
						<th scope="col" class="border-b border-white/10 px-4 py-3 text-right">Requests</th>
						<th scope="col" class="border-b border-white/10 px-4 py-3 text-right">Notify-me</th>
						<th scope="col" class="border-b border-white/10 px-4 py-3 text-right">Waitlist</th>
						<th scope="col" class="border-b border-white/10 px-4 py-3 text-right">Total</th>
					</tr>
				</thead>
				<tbody>
					{#each board.rows as row (row.variantId)}
						{@const total = row.requests + row.notifyMe + row.waitlist}
						<tr class="text-stone-200">
							<th
								scope="row"
								class="border-b border-white/5 px-4 py-3 text-left font-normal text-cream"
							>
								{row.size}
							</th>
							<td class="border-b border-white/5 px-4 py-3 text-right tabular-nums">{row.requests}</td>
							<td class="border-b border-white/5 px-4 py-3 text-right tabular-nums">{row.notifyMe}</td>
							<td class="border-b border-white/5 px-4 py-3 text-right tabular-nums">{row.waitlist}</td>
							<td
								class="border-b border-white/5 px-4 py-3 text-right tabular-nums {total > 0
									? 'text-cream'
									: 'text-stone-400'}"
							>
								{total}
							</td>
						</tr>
					{/each}
				</tbody>
			</TableShell>
		</div>
	{:else}
		<Notice kind="info">No drops to report on yet.</Notice>
	{/each}
</section>

<!-- Every individual entry. -->
<section class="mt-16 flex flex-col gap-6">
	<SectionHead
		eyebrow="Detail"
		title="Individual entries"
		note="One row per person per size. Consent was captured and logged at the point of signup; the date below is that moment."
	/>

	<TableShell
		caption="Demand entries"
		note="{data.entries.length} entr{data.entries.length === 1 ? 'y' : 'ies'}"
	>
		<thead>
			<tr class="text-[11px] tracking-[0.2em] text-stone-400 uppercase font-medium">
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-left">Kind</th>
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-left">Drop</th>
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-left">Size</th>
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-left">Email</th>
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-right">Queue</th>
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-left">State</th>
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-left">Recorded</th>
			</tr>
		</thead>
		<tbody>
			{#each data.entries as entry (entry.id)}
				<tr class="align-top text-stone-200">
					<td class="border-b border-white/5 px-4 py-3">
						<StatePill
							label={KIND_LABEL[entry.kind] ?? entry.kind}
							tone={entry.kind === 'request' ? 'attention' : 'outline'}
						/>
					</td>
					<td class="border-b border-white/5 px-4 py-3 text-[15px]">{entry.dropName}</td>
					<th scope="row" class="border-b border-white/5 px-4 py-3 text-left font-normal text-cream">
						{entry.size ?? '—'}
					</th>
					<td class="border-b border-white/5 px-4 py-3 text-[15px]">
						{entry.email}
						{#if entry.note}
							<span class="mt-1 block max-w-[28rem] text-[13px] leading-relaxed text-stone-400">
								{entry.note}
							</span>
						{/if}
					</td>
					<td class="border-b border-white/5 px-4 py-3 text-right text-stone-400 tabular-nums">
						{entry.position ?? '—'}
					</td>
					<td class="border-b border-white/5 px-4 py-3 text-[13px] tracking-[0.12em] text-stone-400 uppercase font-medium">
						{humanise(entry.state)}
					</td>
					<td class="border-b border-white/5 px-4 py-3 text-[13px] whitespace-nowrap text-stone-400 tabular-nums">
						{shortDateTime(entry.createdAt)}
					</td>
				</tr>
			{:else}
				<tr>
					<td colspan="7" class="px-4 py-10 text-[15px] text-stone-400">
						Nothing recorded for this filter. Clear the filter, or wait for the first request.
					</td>
				</tr>
			{/each}
		</tbody>
	</TableShell>
</section>
