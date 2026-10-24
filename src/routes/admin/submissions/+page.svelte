<script lang="ts">
	import { Inbox, Search, X } from '@lucide/svelte';
	import Chip from '$lib/components/admin/ui/Chip.svelte';
	import EmptyState from '$lib/components/admin/ui/EmptyState.svelte';
	import PageHeader from '$lib/components/admin/ui/PageHeader.svelte';
	import Tabs from '$lib/components/admin/ui/Tabs.svelte';
	import StatTile from '$lib/components/admin/StatTile.svelte';
	import { shortDateTime, timeAgo } from '$lib/components/admin/tone';

	/**
	 * Every customer form, newest first, with its tracking ID — the number the
	 * customer was shown on screen, so a message quoting it can be found here.
	 * Leads holds the same people as a pipeline; this is the raw record.
	 */
	let { data } = $props();

	const KIND: Record<string, string> = {
		contact: 'Contact form',
		drop_request: 'Request this drop',
		notify_me: 'Notify me',
		preorder: 'Pre-order signup'
	};
	let filtered = $derived(Boolean(data.filter.query || data.filter.status));
</script>

<svelte:head><title>Form inbox · Rootwear admin</title></svelte:head>

<div class="flex flex-col gap-6">
	<PageHeader
		title="Form inbox"
		description="Every form a customer sent, with the tracking ID they were shown. Each one is also a lead."
	>
		{#snippet actions()}<a class="q-btn q-btn-secondary" href="/admin/leads">Open leads</a
			>{/snippet}
	</PageHeader>

	<div class="grid gap-4 sm:grid-cols-3">
		<StatTile label="All forms" value={String(data.counts.total)} />
		<StatTile label="Open" value={String(data.counts.open)} note="Not yet answered or fulfilled" />
		<StatTile label="Today" value={String(data.counts.today)} />
	</div>

	<Tabs
		label="Form type"
		tabs={[
			{ href: '/admin/submissions', label: 'All', exact: true },
			...data.kinds.map((kind) => ({
				href: `/admin/submissions?kind=${kind}`,
				label: KIND[kind] ?? kind
			}))
		]}
	/>

	<form method="GET" class="flex flex-wrap items-end gap-2" data-sveltekit-keepfocus>
		{#if data.filter.kind}<input type="hidden" name="kind" value={data.filter.kind} />{/if}
		<div class="relative min-w-[240px] flex-1 sm:max-w-[360px]">
			<Search
				size={16}
				strokeWidth={1.5}
				class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-q-tertiary"
			/>
			<label for="s-q" class="sr-only">Search forms</label>
			<input
				id="s-q"
				name="q"
				type="search"
				class="q-input pl-9"
				placeholder="Tracking ID, name, email, words"
				value={data.filter.query}
			/>
		</div>
		<label for="s-status" class="sr-only">Status</label>
		<select
			id="s-status"
			name="status"
			class="q-select w-auto"
			onchange={(e) => e.currentTarget.form?.requestSubmit()}
		>
			<option value="">Any status</option>
			{#each data.statuses as s (s)}<option value={s} selected={data.filter.status === s}
					>{s.replace('_', ' ')}</option
				>{/each}
		</select>
		{#if filtered}<a
				href="/admin/submissions{data.filter.kind ? `?kind=${data.filter.kind}` : ''}"
				class="q-btn q-btn-ghost"><X /> Clear</a
			>{/if}
	</form>

	{#if data.submissions.length === 0}
		<div class="q-card">
			<EmptyState
				icon={filtered ? Search : Inbox}
				title={filtered ? 'Nothing matches' : 'No forms yet'}
				body={filtered
					? 'Try the tracking ID the customer quoted.'
					: 'Contact messages, drop requests, notify-me and pre-order signups arrive here.'}
				compact
			/>
		</div>
	{:else}
		<div class="q-table-wrap">
			<table class="q-table">
				<thead
					><tr
						><th scope="col">Tracking ID</th><th scope="col">Form</th><th scope="col">From</th><th
							scope="col">What they sent</th
						><th scope="col">Status</th><th scope="col" class="num">When</th></tr
					></thead
				>
				<tbody>
					{#each data.submissions as row (`${row.kind}-${row.sourceId}-${row.trackingId}`)}
						<tr>
							<td class="q-mono text-q-text">{row.trackingId}</td>
							<td>{KIND[row.kind] ?? row.kind}</td>
							<td>
								<p class="text-q-text">{row.name ?? row.email}</p>
								<p class="text-[13px] text-q-secondary">
									{row.name ? row.email : ''}{row.phone ? ` · ${row.phone}` : ''}
								</p>
							</td>
							<td class="max-w-[360px]">
								{#if row.subject}<p class="text-q-text">{row.subject}</p>{/if}
								{#if row.detail}<p class="line-clamp-2 text-[13px] text-q-secondary">
										{row.detail}
									</p>{/if}
								{#if row.dropId || row.variantId}<p class="q-mono text-[12px] text-q-tertiary">
										{row.variantId ?? row.dropId}
									</p>{/if}
							</td>
							<td>
								<div class="flex flex-wrap gap-1.5">
									<Chip
										label={row.status.replace('_', ' ')}
										tone={row.status === 'open' || row.status === 'new' ? 'warning' : 'neutral'}
									/>
									{#if row.isSpam}<Chip label="Spam" tone="danger" />{/if}
								</div>
							</td>
							<td class="num text-q-secondary" title={shortDateTime(row.createdAt)}
								>{timeAgo(row.createdAt, data.now)}</td
							>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
