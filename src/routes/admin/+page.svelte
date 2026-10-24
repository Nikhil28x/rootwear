<script lang="ts">
	import { ArrowRight, CircleCheck } from '@lucide/svelte';
	import PageHeader from '$lib/components/admin/ui/PageHeader.svelte';
	import Section from '$lib/components/admin/ui/Section.svelte';
	import StatTile from '$lib/components/admin/StatTile.svelte';
	import RevenueBars from '$lib/components/admin/RevenueBars.svelte';
	import { formatInr, paise } from '$lib/money';

	let { data } = $props();
	let t = $derived(data.today);
	let fortnight = $derived(t.daily.reduce((n, d) => n + d.revenue, 0));
	let hour = $derived(Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }).format(data.now)));
	let greeting = $derived(hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening');
	const DOT = { danger: 'bg-q-danger', warning: 'bg-q-warning', info: 'bg-q-info' } as const;
</script>

<svelte:head><title>Overview · Rootwear admin</title></svelte:head>

<div class="flex flex-col gap-10">
	<PageHeader title="{greeting}{data.name ? `, ${data.name}` : ''}" description="Yesterday’s sales and what is waiting today." />

	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<StatTile label="Yesterday" value={formatInr(t.yesterday.revenue)} note="{t.yesterday.orders} order{t.yesterday.orders === 1 ? '' : 's'}" />
		<StatTile label="Last 7 days" value={formatInr(t.last7.revenue)} note="{t.last7.orders} orders" />
		<StatTile label="Last 14 days" value={formatInr(paise(fortnight))} note="{t.daily.reduce((n, d) => n + d.orders, 0)} orders" />
		<StatTile label="Waiting on you" value={String(t.attention.reduce((n, a) => n + a.count, 0))} note="Across the list below" />
	</div>

	<div class="grid gap-10 xl:grid-cols-[minmax(0,1fr)_400px]">
		<Section title="Revenue, last 14 days" description="Paid orders by the day they were placed.">
			<div class="q-card p-4"><RevenueBars days={t.daily} /></div>
		</Section>

		<Section title="Needs attention">
			{#if t.attention.length === 0}
				<div class="q-card flex items-center gap-3 p-4 text-[14px] text-q-body">
					<CircleCheck size={20} strokeWidth={1.5} class="text-q-success-text" /> Nothing is waiting. Everything is packed, answered and in stock.
				</div>
			{:else}
				<ul class="q-card q-divide">
					{#each t.attention as item (item.key)}
						<li>
							<a href={item.href} class="flex items-center gap-3 p-3 pl-4 hover:bg-q-muted">
								<span class="size-2 flex-none rounded-full {DOT[item.tone]}" aria-hidden="true"></span>
								<span class="w-8 flex-none text-[16px] font-semibold text-q-text tabular-nums">{item.count}</span>
								<span class="min-w-0 flex-1">
									<span class="block text-[14px] font-medium text-q-text">{item.title}</span>
									<span class="block text-[13px] text-q-secondary">{item.detail}</span>
								</span>
								<ArrowRight size={16} strokeWidth={1.5} class="text-q-tertiary" />
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</Section>
	</div>

	{#if t.lowStock.length}
		<Section title="Running low" description="Sizes on published drops with few left to sell." id="low-stock">
			<div class="q-table-wrap">
				<table class="q-table">
					<thead><tr><th scope="col">Piece</th><th scope="col">Size</th><th scope="col">SKU</th><th scope="col" class="num">Left to sell</th></tr></thead>
					<tbody>
						{#each t.lowStock as s (s.sku)}
							<tr>
								<td><a class="row-link" href={s.href}>{s.product}</a></td>
								<td>{s.size}</td>
								<td class="q-mono text-q-secondary">{s.sku}</td>
								<td class="num font-medium {s.left <= 0 ? 'text-q-danger-text' : 'text-q-text'}">{s.left <= 0 ? 'Sold out' : s.left}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</Section>
	{/if}

	<p class="text-[13px] text-q-secondary">Drop performance, the pre-order ledger and revenue by drop are in <a class="q-link" href="/admin/reports">Reports</a>.</p>
</div>
