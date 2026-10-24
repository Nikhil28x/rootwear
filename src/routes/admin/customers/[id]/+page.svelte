<script lang="ts">
	import { enhance } from '$app/forms';
	import { Mail, MessageCircle } from '@lucide/svelte';
	import Chip from '$lib/components/admin/ui/Chip.svelte';
	import Field from '$lib/components/admin/ui/Field.svelte';
	import PageHeader from '$lib/components/admin/ui/PageHeader.svelte';
	import Section from '$lib/components/admin/ui/Section.svelte';
	import StatTile from '$lib/components/admin/StatTile.svelte';
	import Notice from '$lib/components/admin/Notice.svelte';
	import { submitter } from '$lib/components/admin/enhance';
	import { getToaster } from '$lib/components/admin/toast.svelte';
	import { LEAD_SOURCE_LABEL, LEAD_STAGE, MESSAGE_STATUS, ORDER_STATE, formatPhone, label } from '$lib/components/admin/labels';
	import { shortDate, shortDateTime, timeAgo } from '$lib/components/admin/tone';
	import { formatInr } from '$lib/money';

	let { data, form } = $props();
	const toaster = getToaster();
	let c = $derived(data.customer);
	let wa = $derived(c.phone ? `https://wa.me/${c.phone.replace(/\D/g, '').replace(/^(\d{10})$/, '91$1')}` : null);
</script>

<svelte:head><title>{c.name ?? c.email} · Customers · Rootwear admin</title></svelte:head>

<div class="flex flex-col gap-8">
	<PageHeader title={c.name ?? c.email} back={{ href: '/admin/customers', label: 'Customers' }} description="Customer since {shortDate(c.createdAt)}{c.hasAccount ? ' · has an account' : ' · guest checkout'}">
		{#snippet meta()}{#each c.tags as tag (tag)}<Chip label={tag} dot={false} />{/each}{/snippet}
	</PageHeader>

	{#if form && 'error' in form && form.error}<Notice kind="error">{form.error}</Notice>{/if}

	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<StatTile label="Spent" value={formatInr(c.spent)} />
		<StatTile label="Orders" value={String(c.orders)} />
		<StatTile label="Last order" value={c.lastOrderAt ? timeAgo(c.lastOrderAt, data.now) : '—'} />
		<StatTile label="Came from" value={c.campaign} />
	</div>

	<div class="grid gap-10 xl:grid-cols-[minmax(0,1fr)_360px]">
		<div class="flex min-w-0 flex-col gap-10">
			<Section title="Orders">
				{#if c.orders_.length === 0}
					<p class="text-[14px] text-q-secondary">No orders yet.</p>
				{:else}
					<div class="q-table-wrap">
						<table class="q-table">
							<thead><tr><th scope="col">Order</th><th scope="col">Status</th><th scope="col">Campaign</th><th scope="col" class="num">Total</th><th scope="col" class="num">Placed</th></tr></thead>
							<tbody>
								{#each c.orders_ as o (o.id)}
									{@const os = label(ORDER_STATE, o.state)}
									<tr>
										<td>{#if data.canOrders}<a class="row-link q-mono" href="/admin/orders/{o.id}">{o.number}</a>{:else}<span class="q-mono">{o.number}</span>{/if}</td>
										<td><Chip label={os.label} tone={os.tone} /></td>
										<td class="text-q-secondary">{o.campaign}</td>
										<td class="num">{formatInr(o.total)}</td>
										<td class="num text-q-secondary">{shortDate(o.at)}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</Section>

			{#if c.sizes.length}
				<Section title="What they buy" description="Useful for knowing what to tell them about next.">
					<div class="flex flex-wrap gap-2">{#each c.sizes as s (s.label)}<Chip label="{s.label} × {s.count}" dot={false} />{/each}</div>
				</Section>
			{/if}

			{#if data.canEdit}
				<Section title="Email them">
					<form method="POST" action="?/email" class="flex flex-col gap-3" use:enhance={submitter(toaster, { reset: true })}>
						<input name="subject" class="q-input" placeholder="Subject" aria-label="Subject" required />
						<textarea name="message" class="q-textarea min-h-[120px]" placeholder="Hi {c.name?.split(' ')[0] ?? 'there'}," aria-label="Message" required></textarea>
						<div><button type="submit" class="q-btn q-btn-primary"><Mail /> Send email</button></div>
					</form>
				</Section>
			{/if}

			<Section title="Messages">
				{#if c.messages.length === 0}
					<p class="text-[14px] text-q-secondary">Nothing sent yet.</p>
				{:else}
					<ul class="q-card q-divide">
						{#each c.messages as m (m.id)}
							{@const ms = label(MESSAGE_STATUS, m.status)}
							<li class="flex items-center justify-between gap-3 p-3 pl-4 text-[14px]">
								<span class="flex min-w-0 items-center gap-2">
									{#if m.channel === 'email'}<Mail size={16} strokeWidth={1.5} class="flex-none text-q-tertiary" />{:else}<MessageCircle size={16} strokeWidth={1.5} class="flex-none text-q-tertiary" />{/if}
									<span class="truncate">{m.subject ?? m.body}</span>
								</span>
								<span class="flex flex-none items-center gap-2 text-[12px] text-q-tertiary">{shortDateTime(m.createdAt)}<Chip label={ms.label} tone={ms.tone} /></span>
							</li>
						{/each}
					</ul>
				{/if}
			</Section>
		</div>

		<aside class="flex flex-col gap-8">
			<Section title="Contact">
				<form method="POST" action="?/save" class="q-card flex flex-col gap-4 p-4" use:enhance={submitter(toaster)}>
					<p class="text-[14px] break-all"><a class="q-link" href="mailto:{c.email}">{c.email}</a></p>
					<fieldset disabled={!data.canEdit} class="flex flex-col gap-4">
						<Field label="Phone" id="cu-phone" optional>
							{#snippet children({ describedBy })}<input id="cu-phone" name="phone" class="q-input" value={c.phone ? formatPhone(c.phone) : ''} aria-describedby={describedBy} />{/snippet}
						</Field>
						{#if wa}<a class="q-link -mt-2 w-fit text-[13px]" href={wa} target="_blank" rel="noopener">Open in WhatsApp</a>{/if}
						<Field label="Tags" id="cu-tags" optional help="Comma separated: vip, wholesale, friend">
							{#snippet children({ describedBy })}<input id="cu-tags" name="tags" class="q-input" value={c.tags.join(', ')} aria-describedby={describedBy} />{/snippet}
						</Field>
						<fieldset class="flex flex-col gap-2">
							<legend class="q-label mb-1">Agreed to marketing by</legend>
							<label class="flex items-center gap-2 text-[14px]"><input type="checkbox" class="q-check" name="marketingEmail" checked={c.marketingEmail} /> Email</label>
							<label class="flex items-center gap-2 text-[14px]"><input type="checkbox" class="q-check" name="marketingWhatsapp" checked={c.marketingWhatsapp} /> WhatsApp</label>
							<p class="q-help">Broadcasts only go to people who agreed. Order updates always go.</p>
						</fieldset>
					</fieldset>
					{#if data.canEdit}<div><button type="submit" class="q-btn q-btn-secondary">Save</button></div>{/if}
				</form>
			</Section>

			{#if c.addresses.length}
				<Section title="Addresses used">
					<ul class="flex flex-col gap-2 text-[14px] text-q-body">{#each c.addresses as a (a.line)}<li>{a.line}</li>{/each}</ul>
				</Section>
			{/if}

			{#if c.leads.length && data.canLeads}
				<Section title="As a lead">
					<ul class="flex flex-col gap-2 text-[14px]">
						{#each c.leads as l (l.id)}
							{@const ls = label(LEAD_STAGE, l.stage)}
							<li class="flex items-center justify-between gap-2"><a class="q-link" href="/admin/leads/{l.id}">{LEAD_SOURCE_LABEL[l.source]} · {shortDate(l.at)}</a><Chip label={ls.label} tone={ls.tone} /></li>
						{/each}
					</ul>
				</Section>
			{/if}

			<Section title="Notes">
				{#if data.canEdit}
					<form method="POST" action="?/note" class="flex flex-col gap-2" use:enhance={submitter(toaster, { reset: true })}>
						<label for="cu-note" class="sr-only">Note</label>
						<textarea id="cu-note" name="body" class="q-textarea min-h-[64px]" placeholder="Prefers XL; friend of Aaron’s" required></textarea>
						<div><button type="submit" class="q-btn q-btn-secondary q-btn-sm">Add note</button></div>
					</form>
				{/if}
				{#each c.notes as n (n.id)}
					<div class="rounded-[10px] bg-q-warning-tint px-4 py-3">
						<p class="text-[14px] whitespace-pre-wrap text-q-body">{n.body}</p>
						<p class="mt-1 text-[12px] text-q-tertiary">{n.author} · {timeAgo(n.at, data.now)}</p>
					</div>
				{/each}
			</Section>
		</aside>
	</div>
</div>
