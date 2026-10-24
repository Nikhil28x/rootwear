<script lang="ts">
	import { Check, Copy, TrendingUp } from '@lucide/svelte';
	import EmptyState from '$lib/components/admin/ui/EmptyState.svelte';
	import Field from '$lib/components/admin/ui/Field.svelte';
	import PageHeader from '$lib/components/admin/ui/PageHeader.svelte';
	import Section from '$lib/components/admin/ui/Section.svelte';
	import { LEAD_SOURCE_LABEL } from '$lib/components/admin/labels';
	import { formatInr } from '$lib/money';

	let { data } = $props();

	// A tagged-link builder, so every bio link and story sticker is counted.
	let path = $state('/drops');
	let source = $state('instagram');
	let medium = $state('story');
	let campaign = $state('');
	let copied = $state(false);
	let link = $derived.by(() => {
		const url = new URL(path || '/', data.site);
		if (source) url.searchParams.set('utm_source', source.trim().toLowerCase());
		if (medium) url.searchParams.set('utm_medium', medium.trim().toLowerCase());
		if (campaign)
			url.searchParams.set('utm_campaign', campaign.trim().toLowerCase().replace(/\s+/g, '-'));
		return url.toString();
	});

	const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—');
</script>

<svelte:head><title>Where leads come from · Rootwear admin</title></svelte:head>

<div class="flex flex-col gap-8">
	<PageHeader
		title="Where they come from"
		description="Leads by channel, and orders by the campaign link people arrived on."
		back={{ href: '/admin/leads', label: 'Leads' }}
	>
		{#snippet actions()}
			<div class="flex rounded-[10px] bg-q-muted p-0.5" role="group" aria-label="Period">
				{#each [7, 30, 90] as d (d)}
					<a
						href="?days={d}"
						class="rounded-[8px] px-3 py-1.5 text-[13px] {data.days === d
							? 'bg-q-surface font-medium text-q-text shadow-[var(--q-shadow-active)]'
							: 'text-q-secondary'}">{d} days</a
					>
				{/each}
			</div>
		{/snippet}
	</PageHeader>

	<Section title="Leads by channel">
		{#if data.sources.length === 0}
			<div class="q-card">
				<EmptyState
					icon={TrendingUp}
					title="No leads in this period"
					body="Pick a longer period, or add leads as they come in."
					compact
				/>
			</div>
		{:else}
			<div class="q-table-wrap">
				<table class="q-table">
					<thead
						><tr
							><th scope="col">Channel</th><th scope="col" class="num">Leads</th><th
								scope="col"
								class="num">Bought</th
							><th scope="col" class="num">Rate</th><th scope="col" class="num">Revenue</th></tr
						></thead
					>
					<tbody>
						{#each data.sources as row (row.source)}
							<tr>
								<td class="font-medium text-q-text"
									>{LEAD_SOURCE_LABEL[row.source] ?? row.source}</td
								>
								<td class="num">{row.leads}</td>
								<td class="num">{row.won}</td>
								<td class="num">{pct(row.won, row.leads)}</td>
								<td class="num">{formatInr(row.revenue)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</Section>

	<Section
		title="Orders by campaign"
		description="The tagged link a buyer first arrived on. Untagged visits count as Direct."
	>
		{#if data.campaigns.length === 0}
			<p class="text-[14px] text-q-secondary">No orders in this period.</p>
		{:else}
			<div class="q-table-wrap">
				<table class="q-table">
					<thead
						><tr
							><th scope="col">Source / medium / campaign</th><th scope="col" class="num">Leads</th
							><th scope="col" class="num">Orders</th><th scope="col" class="num">Revenue</th></tr
						></thead
					>
					<tbody>
						{#each data.campaigns as row (row.campaign)}
							<tr
								><td class="q-mono">{row.campaign}</td><td class="num">{row.leads}</td><td
									class="num">{row.orders}</td
								><td class="num">{formatInr(row.revenue)}</td></tr
							>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</Section>

	<Section
		title="Make a tracked link"
		description="Use one for every bio link, story sticker, influencer and ad, so the tables above can tell them apart."
	>
		<div class="q-card flex flex-col gap-4 p-4">
			<div class="grid gap-4 sm:grid-cols-4">
				<Field label="Page" id="ut-path"
					>{#snippet children({ describedBy })}<input
							id="ut-path"
							class="q-input q-mono"
							bind:value={path}
							aria-describedby={describedBy}
						/>{/snippet}</Field
				>
				<Field label="Source" id="ut-source" help="instagram, whatsapp, creator"
					>{#snippet children({ describedBy })}<input
							id="ut-source"
							class="q-input"
							bind:value={source}
							aria-describedby={describedBy}
						/>{/snippet}</Field
				>
				<Field label="Medium" id="ut-medium" help="story, bio, post, dm"
					>{#snippet children({ describedBy })}<input
							id="ut-medium"
							class="q-input"
							bind:value={medium}
							aria-describedby={describedBy}
						/>{/snippet}</Field
				>
				<Field label="Campaign" id="ut-campaign" help="drop02, aisha-collab"
					>{#snippet children({ describedBy })}<input
							id="ut-campaign"
							class="q-input"
							bind:value={campaign}
							aria-describedby={describedBy}
						/>{/snippet}</Field
				>
			</div>
			<div class="flex items-center gap-2">
				<code class="q-mono min-w-0 flex-1 truncate rounded-[8px] bg-q-muted px-3 py-2">{link}</code
				>
				<button
					type="button"
					class="q-btn q-btn-secondary"
					onclick={async () => {
						await navigator.clipboard.writeText(link);
						copied = true;
						setTimeout(() => (copied = false), 2000);
					}}
				>
					{#if copied}<Check /> Copied{:else}<Copy /> Copy{/if}
				</button>
			</div>
		</div>
	</Section>
</div>
