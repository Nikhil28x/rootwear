<script lang="ts">
	import { goto } from '$app/navigation';
	import { Download, Search, Users, X } from '@lucide/svelte';
	import Chip from '$lib/components/admin/ui/Chip.svelte';
	import EmptyState from '$lib/components/admin/ui/EmptyState.svelte';
	import PageHeader from '$lib/components/admin/ui/PageHeader.svelte';
	import Pager from '$lib/components/admin/ui/Pager.svelte';
	import Tabs from '$lib/components/admin/ui/Tabs.svelte';
	import StatTile from '$lib/components/admin/StatTile.svelte';
	import { formatPhone } from '$lib/components/admin/labels';
	import { timeAgo } from '$lib/components/admin/tone';
	import { formatInr } from '$lib/money';

	let { data } = $props();
	let filtered = $derived(Boolean(data.filters.q || data.filters.tag));
</script>

<svelte:head><title>Customers · Rootwear admin</title></svelte:head>

<div class="flex flex-col gap-6">
	<PageHeader title="Customers" description="Everyone who has ordered, with what they spent and when they last bought.">
		{#snippet actions()}
			<a class="q-btn q-btn-secondary" href="/admin/customers/export{data.query}"><Download /> Export CSV</a>
		{/snippet}
	</PageHeader>

	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<StatTile label="Customers who bought" value={String(data.stats.buyers)} />
		<StatTile label="Bought more than once" value={String(data.stats.repeat)} note={data.stats.buyers ? `${Math.round((data.stats.repeat / data.stats.buyers) * 100)}% come back` : ''} />
		<StatTile label="Average order" value={formatInr(data.stats.averageOrder)} />
		<StatTile label="Average spend per customer" value={formatInr(data.stats.lifetime)} />
	</div>

	<Tabs
		label="Segments"
		tabs={[
			{ href: '/admin/customers', label: 'All', exact: true },
			{ href: '/admin/customers?segment=buyers', label: 'Bought' },
			{ href: '/admin/customers?segment=repeat', label: 'Repeat' },
			{ href: '/admin/customers?segment=lapsed', label: 'Not for 4 months' },
			{ href: '/admin/customers?segment=never', label: 'Never paid' }
		]}
	/>

	<form method="GET" class="flex flex-wrap items-end gap-2" data-sveltekit-keepfocus>
		{#if data.filters.segment}<input type="hidden" name="segment" value={data.filters.segment} />{/if}
		<div class="relative min-w-[240px] flex-1 sm:max-w-[360px]">
			<Search size={16} strokeWidth={1.5} class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-q-tertiary" />
			<label for="c-q" class="sr-only">Search customers</label>
			<input id="c-q" name="q" type="search" class="q-input pl-9" placeholder="Name, email, phone or city" value={data.filters.q} />
		</div>
		{#if data.tags.length}
			<label for="c-tag" class="sr-only">Tag</label>
			<select id="c-tag" name="tag" class="q-select w-auto" onchange={(e) => e.currentTarget.form?.requestSubmit()}>
				<option value="">Any tag</option>
				{#each data.tags as tag (tag)}<option value={tag} selected={data.filters.tag === tag}>{tag}</option>{/each}
			</select>
		{/if}
		<label for="c-sort" class="sr-only">Sort</label>
		<select id="c-sort" name="sort" class="q-select w-auto" onchange={(e) => e.currentTarget.form?.requestSubmit()}>
			<option value="recent" selected={data.filters.sort === 'recent'}>Most recent</option>
			<option value="spent" selected={data.filters.sort === 'spent'}>Most spent</option>
			<option value="orders" selected={data.filters.sort === 'orders'}>Most orders</option>
		</select>
		{#if filtered}<a href="/admin/customers{data.filters.segment ? `?segment=${data.filters.segment}` : ''}" class="q-btn q-btn-ghost"><X /> Clear</a>{/if}
	</form>

	{#if data.customers.length === 0}
		<div class="q-card"><EmptyState icon={filtered ? Search : Users} title={filtered ? 'No customers match' : 'No customers here yet'} body={filtered ? 'Try an email, a phone number or a city.' : 'Customers appear when they place their first order.'} compact /></div>
	{:else}
		<div class="q-table-wrap">
			<table class="q-table">
				<thead><tr><th scope="col">Customer</th><th scope="col">City</th><th scope="col" class="num">Orders</th><th scope="col" class="num">Spent</th><th scope="col" class="num">Last order</th></tr></thead>
				<tbody>
					{#each data.customers as c (c.id)}
						<tr data-href="/admin/customers/{c.id}" onclick={(e) => { if (!(e.target as HTMLElement).closest('a')) goto(`/admin/customers/${c.id}`); }}>
							<td>
								<a class="row-link" href="/admin/customers/{c.id}">{c.name ?? c.email}</a>
								<p class="text-[13px] text-q-secondary">{c.email}{c.phone ? ` · ${formatPhone(c.phone)}` : ''}</p>
								{#if c.tags.length}<div class="mt-1 flex flex-wrap gap-1">{#each c.tags as tag (tag)}<Chip label={tag} dot={false} />{/each}</div>{/if}
							</td>
							<td class="text-q-secondary">{c.city ?? '—'}</td>
							<td class="num">{c.orders}</td>
							<td class="num font-medium text-q-text">{formatInr(c.spent)}</td>
							<td class="num text-q-secondary">{c.lastOrderAt ? timeAgo(c.lastOrderAt, data.now) : '—'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<Pager page={data.page} pageSize={data.pageSize} total={data.total} />
	{/if}
</div>
