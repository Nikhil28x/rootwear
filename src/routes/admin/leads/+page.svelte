<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { AtSign, CalendarClock, Inbox, LayoutGrid, List, Mail, Phone, Plus, Search, UserRound, X } from '@lucide/svelte';
	import Chip from '$lib/components/admin/ui/Chip.svelte';
	import Drawer from '$lib/components/admin/ui/Drawer.svelte';
	import EmptyState from '$lib/components/admin/ui/EmptyState.svelte';
	import Field from '$lib/components/admin/ui/Field.svelte';
	import PageHeader from '$lib/components/admin/ui/PageHeader.svelte';
	import Pager from '$lib/components/admin/ui/Pager.svelte';
	import Tabs from '$lib/components/admin/ui/Tabs.svelte';
	import Notice from '$lib/components/admin/Notice.svelte';
	import { submitter } from '$lib/components/admin/enhance';
	import { getToaster } from '$lib/components/admin/toast.svelte';
	import { LEAD_SOURCE_LABEL, LEAD_STAGE, formatPhone, label } from '$lib/components/admin/labels';
	import { shortDate, timeAgo } from '$lib/components/admin/tone';

	let { data, form } = $props();
	const toaster = getToaster();
	let adding = $state(false);

	type L = (typeof data.leads)[number];
	const COLUMNS = ['new', 'contacted', 'interested'] as const;
	let board = $derived(data.view === 'open' && data.filters.layout !== 'list');
	let filtered = $derived(Boolean(data.filters.q || data.filters.source || data.filters.owner));

	function withParam(key: string, value: string) {
		const url = new URL(page.url);
		if (value) url.searchParams.set(key, value);
		else url.searchParams.delete(key);
		url.searchParams.delete('page');
		return url.pathname + url.search;
	}

	function due(lead: L) {
		return lead.nextFollowUpAt !== null && lead.nextFollowUpAt <= data.now;
	}

	function contact(lead: L) {
		return lead.instagram ? `@${lead.instagram}` : lead.phone ? formatPhone(lead.phone) : (lead.email ?? '');
	}
</script>

<svelte:head><title>Leads · Rootwear admin</title></svelte:head>

{#snippet card(lead: L)}
	{@const st = label(LEAD_STAGE, lead.stage)}
	<a href="/admin/leads/{lead.id}" class="lead-card q-card flex flex-col gap-2 p-3 hover:border-q-border-strong">
		<div class="flex items-start justify-between gap-2">
			<p class="truncate text-[14px] font-medium text-q-text">{lead.name ?? contact(lead)}</p>
			<span class="flex-none text-[12px] text-q-tertiary">{timeAgo(lead.updatedAt, data.now)}</span>
		</div>
		{#if lead.name}<p class="truncate text-[13px] text-q-secondary">{contact(lead)}</p>{/if}
		{#if lead.interest}<p class="line-clamp-2 text-[13px] text-q-body">{lead.interest}</p>{/if}
		<div class="flex flex-wrap items-center gap-1.5">
			<Chip label={LEAD_SOURCE_LABEL[lead.source] ?? lead.source} dot={false} />
			{#if !board}<Chip label={st.label} tone={st.tone} />{/if}
			{#if lead.nextFollowUpAt}
				<Chip label="{due(lead) ? 'Due' : 'Follow up'} {shortDate(lead.nextFollowUpAt).replace(/ \d{4}$/, '')}" tone={due(lead) ? 'danger' : 'neutral'} />
			{/if}
			{#if lead.owner}<span class="ml-auto truncate text-[12px] text-q-tertiary">{lead.owner.split('@')[0]}</span>{/if}
		</div>
	</a>
{/snippet}

<div class="flex flex-col gap-6">
	<PageHeader title="Leads" description="Everyone who has asked, messaged or signed up, from every channel, until they buy.">
		{#snippet actions()}
			<a class="q-btn q-btn-secondary" href="/admin/leads/sources">Where they come from</a>
			{#if data.canEdit}
				<button type="button" class="q-btn q-btn-primary" onclick={() => (adding = true)}><Plus /> Add lead</button>
			{/if}
		{/snippet}
	</PageHeader>

	{#if form && 'error' in form && form.error}<Notice kind="error">{form.error}</Notice>{/if}

	<Tabs
		label="Lead views"
		tabs={[
			{ href: '/admin/leads', label: 'Open', count: data.counts.new + data.counts.contacted + data.counts.interested, exact: true },
			{ href: '/admin/leads?view=due', label: 'Follow up now', count: data.counts.due || null },
			{ href: '/admin/leads?view=won', label: 'Won', count: data.counts.won || null },
			{ href: '/admin/leads?view=lost', label: 'Lost' },
			{ href: '/admin/leads?view=all', label: 'All' }
		]}
	/>

	<div class="flex flex-wrap items-end gap-2">
		<form method="GET" class="flex flex-1 flex-wrap items-end gap-2" data-sveltekit-keepfocus>
			{#if data.view !== 'open'}<input type="hidden" name="view" value={data.view} />{/if}
			{#if data.filters.layout === 'list'}<input type="hidden" name="layout" value="list" />{/if}
			<div class="relative min-w-[220px] flex-1 sm:max-w-[320px]">
				<Search size={16} strokeWidth={1.5} class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-q-tertiary" />
				<label for="l-q" class="sr-only">Search leads</label>
				<input id="l-q" name="q" type="search" class="q-input pl-9" placeholder="Name, email, phone, @handle" value={data.filters.q} />
			</div>
			<label for="l-source" class="sr-only">Source</label>
			<select id="l-source" name="source" class="q-select w-auto" onchange={(e) => e.currentTarget.form?.requestSubmit()}>
				<option value="">All sources</option>
				{#each data.sources as s (s.value)}<option value={s.value} selected={data.filters.source === s.value}>{s.label}</option>{/each}
			</select>
			<label for="l-owner" class="sr-only">Owner</label>
			<select id="l-owner" name="owner" class="q-select w-auto" onchange={(e) => e.currentTarget.form?.requestSubmit()}>
				<option value="">Anyone’s</option>
				<option value="me" selected={data.filters.owner === 'me'}>Mine</option>
				<option value="none" selected={data.filters.owner === 'none'}>Unassigned</option>
				{#each data.owners as o (o)}<option value={o} selected={data.filters.owner === o}>{o}</option>{/each}
			</select>
			{#if filtered}<a href={`/admin/leads${data.view !== 'open' ? `?view=${data.view}` : ''}`} class="q-btn q-btn-ghost"><X /> Clear</a>{/if}
		</form>
		{#if data.view === 'open'}
			<div class="flex rounded-[10px] bg-q-muted p-0.5" role="group" aria-label="Layout">
				<a href={withParam('layout', '')} class="flex size-8 items-center justify-center rounded-[8px] {board ? 'bg-q-surface text-q-text shadow-[var(--q-shadow-active)]' : 'text-q-secondary'}" aria-label="Board" aria-current={board ? 'true' : undefined}><LayoutGrid size={16} strokeWidth={1.5} /></a>
				<a href={withParam('layout', 'list')} class="flex size-8 items-center justify-center rounded-[8px] {!board ? 'bg-q-surface text-q-text shadow-[var(--q-shadow-active)]' : 'text-q-secondary'}" aria-label="List" aria-current={!board ? 'true' : undefined}><List size={16} strokeWidth={1.5} /></a>
			</div>
		{/if}
	</div>

	{#if data.leads.length === 0}
		<div class="q-card">
			{#if filtered}
				<EmptyState icon={Search} title="No leads match" body="Try a name, an email, a phone number or an Instagram handle." compact />
			{:else if data.view === 'due'}
				<EmptyState icon={CalendarClock} title="Nobody to follow up" body="Leads whose follow-up date has come appear here." compact />
			{:else}
				<EmptyState icon={Inbox} title="No leads here yet" body="Website forms, WhatsApp messages and lead ads arrive on their own. Add Instagram DMs by hand.">
					{#snippet action()}{#if data.canEdit}<button type="button" class="q-btn q-btn-primary" onclick={() => (adding = true)}><Plus /> Add lead</button>{/if}{/snippet}
				</EmptyState>
			{/if}
		</div>
	{:else if board}
		<div class="grid gap-4 lg:grid-cols-3">
			{#each COLUMNS as stage (stage)}
				{@const items = data.leads.filter((l) => l.stage === stage)}
				<section class="flex flex-col gap-3 rounded-[14px] bg-q-muted/60 p-3" aria-labelledby="col-{stage}">
					<h2 id="col-{stage}" class="flex items-center justify-between px-1 text-[13px] font-medium text-q-secondary">
						{LEAD_STAGE[stage].label}<span class="tabular-nums">{data.counts[stage]}</span>
					</h2>
					{#each items as lead (lead.id)}{@render card(lead)}{:else}<p class="px-1 py-4 text-center text-[13px] text-q-tertiary">None</p>{/each}
				</section>
			{/each}
		</div>
		{#if data.total > data.leads.length}<p class="text-[13px] text-q-secondary">Showing the {data.leads.length} most recent. Switch to the list to see all.</p>{/if}
	{:else}
		<div class="q-table-wrap">
			<table class="q-table">
				<thead><tr><th scope="col">Lead</th><th scope="col">Interest</th><th scope="col">Stage</th><th scope="col">Source</th><th scope="col">Follow up</th><th scope="col" class="num">Updated</th></tr></thead>
				<tbody>
					{#each data.leads as lead (lead.id)}
						{@const st = label(LEAD_STAGE, lead.stage)}
						<tr data-href="/admin/leads/{lead.id}" onclick={(e) => { if (!(e.target as HTMLElement).closest('a')) goto(`/admin/leads/${lead.id}`); }}>
							<td>
								<a class="row-link" href="/admin/leads/{lead.id}">{lead.name ?? contact(lead)}</a>
								<p class="flex items-center gap-2 text-[13px] text-q-secondary">
									{#if lead.instagram}<AtSign size={12} />{lead.instagram}{:else if lead.phone}<Phone size={12} />{formatPhone(lead.phone)}{:else if lead.email}<Mail size={12} />{lead.email}{/if}
								</p>
							</td>
							<td class="max-w-[260px] truncate">{lead.interest ?? '—'}</td>
							<td><Chip label={st.label} tone={st.tone} /></td>
							<td>{LEAD_SOURCE_LABEL[lead.source]}{#if lead.sourceDetail}<span class="block text-[12px] text-q-tertiary">{lead.sourceDetail}</span>{/if}</td>
							<td class={due(lead) ? 'font-medium text-q-danger-text' : 'text-q-secondary'}>{lead.nextFollowUpAt ? shortDate(lead.nextFollowUpAt) : '—'}</td>
							<td class="num text-q-secondary">{timeAgo(lead.updatedAt, data.now)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<Pager page={data.page} pageSize={data.pageSize} total={data.total} />
	{/if}
</div>

<Drawer bind:open={adding} title="Add a lead" description="For someone who messaged on Instagram, met you at a pop-up, or was referred.">
	<form id="lead-add" method="POST" action="?/add" class="flex flex-col gap-4" use:enhance={submitter(toaster, { onSuccess: () => (adding = false) })}>
		<div class="grid gap-4 sm:grid-cols-2">
			<Field label="Where from" id="la-source">
				{#snippet children({ describedBy })}
					<select id="la-source" name="source" class="q-select" aria-describedby={describedBy}>
						{#each data.sources as s (s.value)}<option value={s.value} selected={s.value === 'instagram'}>{s.label}</option>{/each}
					</select>
				{/snippet}
			</Field>
			<Field label="Detail" id="la-detail" optional help="The post, the event, who referred them.">
				{#snippet children({ describedBy })}<input id="la-detail" name="sourceDetail" class="q-input" aria-describedby={describedBy} />{/snippet}
			</Field>
		</div>
		<Field label="Name" id="la-name" optional>
			{#snippet children({ describedBy })}<input id="la-name" name="name" class="q-input" aria-describedby={describedBy} />{/snippet}
		</Field>
		<div class="grid gap-4 sm:grid-cols-2">
			<Field label="Instagram" id="la-ig" optional>
				{#snippet children({ describedBy })}<input id="la-ig" name="instagram" class="q-input" placeholder="@handle" aria-describedby={describedBy} />{/snippet}
			</Field>
			<Field label="Phone" id="la-phone" optional>
				{#snippet children({ describedBy })}<input id="la-phone" name="phone" type="tel" class="q-input" placeholder="98765 43210" aria-describedby={describedBy} />{/snippet}
			</Field>
		</div>
		<Field label="Email" id="la-email" optional help="At least one of Instagram, phone or email.">
			{#snippet children({ describedBy })}<input id="la-email" name="email" type="email" class="q-input" aria-describedby={describedBy} />{/snippet}
		</Field>
		<Field label="What they want" id="la-interest" optional>
			{#snippet children({ describedBy })}<input id="la-interest" name="interest" class="q-input" placeholder="Forest Floor tee in XL" aria-describedby={describedBy} />{/snippet}
		</Field>
		<Field label="Note" id="la-note" optional>
			{#snippet children({ describedBy })}<textarea id="la-note" name="note" class="q-textarea min-h-[72px]" placeholder="What they said" aria-describedby={describedBy}></textarea>{/snippet}
		</Field>
		<div class="grid gap-4 sm:grid-cols-2">
			<Field label="Follow up on" id="la-follow" optional>
				{#snippet children({ describedBy })}<input id="la-follow" name="followUp" type="date" class="q-input" aria-describedby={describedBy} />{/snippet}
			</Field>
			<label class="flex items-center gap-2 self-end pb-2 text-[14px]"><input type="checkbox" class="q-check" name="assignMe" checked /> <UserRound size={16} strokeWidth={1.5} class="text-q-tertiary" /> Assign to me</label>
		</div>
		<fieldset class="flex flex-col gap-2">
			<legend class="q-label mb-1">They agreed to hear from us by</legend>
			<label class="flex items-center gap-2 text-[14px]"><input type="checkbox" class="q-check" name="consentWhatsapp" /> WhatsApp</label>
			<label class="flex items-center gap-2 text-[14px]"><input type="checkbox" class="q-check" name="consentEmail" /> Email</label>
		</fieldset>
	</form>
	{#snippet footer()}
		<button type="button" class="q-btn q-btn-secondary" onclick={() => (adding = false)}>Cancel</button>
		<button type="submit" form="lead-add" class="q-btn q-btn-primary">Add lead</button>
	{/snippet}
</Drawer>
