<script lang="ts">
	import SectionHead from '$lib/components/admin/SectionHead.svelte';
	import StatePill from '$lib/components/admin/StatePill.svelte';
	import StatTile from '$lib/components/admin/StatTile.svelte';
	import TableShell from '$lib/components/admin/TableShell.svelte';
	import { contactTone, humanise, shortDateTime } from '$lib/components/admin/tone';

	let { data } = $props();

	const KIND_LABEL: Record<string, string> = {
		contact: 'Contact',
		drop_request: 'Drop request',
		notify_me: 'Notify me',
		preorder: 'Pre-order'
	};

	function destination(kind: string): string {
		return kind === 'contact' ? '/admin/contact' : '/admin/demand';
	}
</script>

<svelte:head>
	<title>Submissions — Rootwear operations</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<SectionHead
	level={1}
	eyebrow="Customer records"
	title="Form submissions"
	note="One chronological inbox for contact messages, drop requests, notify-me requests and pre-order signups. Every record has an immutable reference shared with the customer."
/>

<div class="mt-10 grid gap-px bg-white/10 sm:grid-cols-3">
	<StatTile
		label="All records"
		value={String(data.counts.total)}
		note="Across every customer lead form."
	/>
	<StatTile
		label="Open"
		value={String(data.counts.open)}
		note="New contact messages and unconverted requests."
		severity={data.counts.open > 0 ? 'act' : 'none'}
	/>
	<StatTile label="Today" value={String(data.counts.today)} note="Recorded since midnight IST." />
</div>

<form
	method="GET"
	class="mt-12 grid gap-6 border-y border-white/10 py-6 lg:grid-cols-[1fr_12rem_12rem_auto_auto] lg:items-end"
>
	<div class="flex flex-col gap-2">
		<label
			for="submission-search"
			class="text-[11px] font-medium tracking-[0.2em] text-stone-400 uppercase"
		>
			Search
		</label>
		<input
			id="submission-search"
			name="q"
			value={data.filter.query}
			placeholder="Reference, name, email or phone"
			class="w-full border-b border-white/25 bg-transparent px-0 py-2.5 text-[15px] text-stone-100 outline-none placeholder:text-stone-400 focus:border-white"
		/>
	</div>

	<div class="flex flex-col gap-2">
		<label
			for="submission-kind"
			class="text-[11px] font-medium tracking-[0.2em] text-stone-400 uppercase">Kind</label
		>
		<select
			id="submission-kind"
			name="kind"
			value={data.filter.kind}
			class="w-full border-b border-white/25 bg-transparent px-0 py-2.5 text-[15px] text-stone-100 outline-none focus:border-white"
		>
			<option value="">Every form</option>
			{#each data.kinds as kind (kind)}
				<option value={kind}>{KIND_LABEL[kind]}</option>
			{/each}
		</select>
	</div>

	<div class="flex flex-col gap-2">
		<label
			for="submission-status"
			class="text-[11px] font-medium tracking-[0.2em] text-stone-400 uppercase">Status</label
		>
		<select
			id="submission-status"
			name="status"
			value={data.filter.status}
			class="w-full border-b border-white/25 bg-transparent px-0 py-2.5 text-[15px] text-stone-100 outline-none focus:border-white"
		>
			<option value="">Every status</option>
			{#each data.statuses as status (status)}
				<option value={status}>{humanise(status)}</option>
			{/each}
		</select>
	</div>

	<button
		type="submit"
		class="border border-white/35 px-7 py-3 text-[11px] font-medium tracking-[0.2em] text-stone-100 uppercase transition hover:bg-white hover:text-black"
	>
		Apply
	</button>
	<a
		href="/admin/submissions"
		class="pb-3 text-[11px] font-medium tracking-[0.2em] text-stone-400 uppercase underline underline-offset-4 hover:text-stone-200"
	>
		Clear
	</a>
</form>

<section class="mt-12">
	<TableShell
		caption="Customer form submissions"
		note="{data.submissions.length} record{data.submissions.length === 1 ? '' : 's'}"
	>
		<thead>
			<tr class="text-[11px] font-medium tracking-[0.2em] text-stone-400 uppercase">
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-left">Reference</th>
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-left">Form</th>
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-left">Customer</th>
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-left">Details</th>
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-left">Status</th>
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-left">Recorded</th>
			</tr>
		</thead>
		<tbody>
			{#each data.submissions as row (`${row.trackingId}:${row.sourceId}`)}
				<tr class="align-top text-stone-200">
					<th
						scope="row"
						class="border-b border-white/5 px-4 py-4 text-left text-[12px] font-medium whitespace-nowrap text-gold tabular-nums"
					>
						{row.trackingId}
					</th>
					<td class="border-b border-white/5 px-4 py-4">
						<a
							class="text-[13px] underline decoration-white/25 underline-offset-4 hover:text-paper"
							href={destination(row.kind)}
						>
							{KIND_LABEL[row.kind]}
						</a>
					</td>
					<td class="min-w-[12rem] border-b border-white/5 px-4 py-4 text-[14px]">
						{#if row.name}<span class="block text-paper">{row.name}</span>{/if}
						<a
							class="block break-words underline decoration-white/20 underline-offset-4 hover:text-paper"
							href="mailto:{row.email}">{row.email}</a
						>
						{#if row.phone}<span class="mt-1 block text-stone-400">{row.phone}</span>{/if}
					</td>
					<td
						class="min-w-[18rem] border-b border-white/5 px-4 py-4 text-[13px] leading-relaxed text-stone-400"
					>
						{#if row.subject}<span class="block text-stone-200">{row.subject}</span>{/if}
						{#if row.detail}<span class="mt-1 block max-w-[28rem]">{row.detail}</span>{/if}
						{#if row.dropId || row.variantId}
							<span class="mt-2 block text-[11px] tracking-[0.08em] uppercase">
								{row.dropId ?? ''}{row.variantId ? ` · ${row.variantId}` : ''}
							</span>
						{/if}
					</td>
					<td class="border-b border-white/5 px-4 py-4">
						<StatePill label={humanise(row.status)} tone={contactTone(row.status)} />
						{#if row.isSpam}<span class="mt-2 block text-[11px] text-alert-light uppercase"
								>Spam signal</span
							>{/if}
					</td>
					<td
						class="border-b border-white/5 px-4 py-4 text-[13px] whitespace-nowrap text-stone-400 tabular-nums"
					>
						{shortDateTime(row.createdAt)}
					</td>
				</tr>
			{:else}
				<tr>
					<td colspan="6" class="px-4 py-12 text-[15px] text-stone-400">
						No submissions match this filter.
					</td>
				</tr>
			{/each}
		</tbody>
	</TableShell>
</section>
