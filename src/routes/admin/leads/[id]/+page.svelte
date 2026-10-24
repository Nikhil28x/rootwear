<script lang="ts">
	import { enhance } from '$app/forms';
	import { AtSign, CalendarClock, Mail, MessageCircle, Pencil, Phone, PhoneCall, StickyNote } from '@lucide/svelte';
	import Chip from '$lib/components/admin/ui/Chip.svelte';
	import Drawer from '$lib/components/admin/ui/Drawer.svelte';
	import Field from '$lib/components/admin/ui/Field.svelte';
	import PageHeader from '$lib/components/admin/ui/PageHeader.svelte';
	import Section from '$lib/components/admin/ui/Section.svelte';
	import Notice from '$lib/components/admin/Notice.svelte';
	import { submitter } from '$lib/components/admin/enhance';
	import { getToaster } from '$lib/components/admin/toast.svelte';
	import { LEAD_SOURCE_LABEL, LEAD_STAGE, ORDER_STATE, formatPhone, label } from '$lib/components/admin/labels';
	import { istInputValue, shortDate, shortDateTime, timeAgo } from '$lib/components/admin/tone';
	import { formatInr } from '$lib/money';

	let { data, form } = $props();
	const toaster = getToaster();

	let lead = $derived(data.lead);
	let stage = $derived(label(LEAD_STAGE, lead.stage));
	let composer = $state<'note' | 'call' | 'email' | 'whatsapp'>('note');
	let editing = $state(false);
	let losing = $state(false);
	const STAGES = ['new', 'contacted', 'interested', 'won', 'lost'] as const;

	let windowLeft = $derived(
		lead.lastInboundAt ? Math.max(0, Math.round((lead.lastInboundAt + 24 * 3_600_000 - data.now) / 3_600_000)) : 0
	);
	let waLink = $derived(lead.phone ? `https://wa.me/${lead.phone.replace(/\D/g, '')}` : null);
	let igLink = $derived(lead.instagram ? `https://ig.me/m/${lead.instagram}` : null);

	const KIND: Record<string, { label: string; tone: string }> = {
		created: { label: 'Added', tone: '' },
		form: { label: 'Form', tone: '' },
		note: { label: 'Note', tone: 'note' },
		call: { label: 'Call', tone: '' },
		message_in: { label: 'They wrote', tone: 'in' },
		message_out: { label: 'We wrote', tone: 'out' },
		stage: { label: 'Stage', tone: '' },
		assigned: { label: 'Owner', tone: '' },
		order: { label: 'Order', tone: '' },
		follow_up: { label: 'Follow-up', tone: '' }
	};
	let followValue = $derived(lead.nextFollowUpAt ? istInputValue(lead.nextFollowUpAt).slice(0, 10) : '');
</script>

<svelte:head><title>{lead.name ?? lead.email ?? lead.phone ?? 'Lead'} · Leads · Rootwear admin</title></svelte:head>

<div class="flex flex-col gap-8">
	<PageHeader
		title={lead.name ?? (lead.instagram ? `@${lead.instagram}` : (lead.email ?? (formatPhone(lead.phone) || 'Lead')))}
		back={{ href: '/admin/leads', label: 'Leads' }}
		description="{LEAD_SOURCE_LABEL[lead.source]}{lead.sourceDetail ? ` · ${lead.sourceDetail}` : ''} · first seen {shortDateTime(lead.createdAt)}"
	>
		{#snippet meta()}<Chip label={stage.label} tone={stage.tone} />{/snippet}
	</PageHeader>

	{#if form && 'error' in form && form.error}<Notice kind="error">{form.error}</Notice>{/if}
	{#if data.added}<Notice kind="success">Lead added. Log what happens next below.</Notice>{/if}

	{#if data.canEdit}
		<div class="flex flex-wrap items-center gap-2" role="group" aria-label="Stage">
			{#each STAGES as s, i (s)}
				{#if s === 'lost'}
					<button type="button" class="stage {lead.stage === s ? 'is-on' : ''}" onclick={() => (losing = true)} aria-pressed={lead.stage === s}>Lost</button>
				{:else}
					<form method="POST" action="?/stage" use:enhance={submitter(toaster)}>
						<input type="hidden" name="stage" value={s} />
						<button type="submit" class="stage {lead.stage === s ? 'is-on' : ''} {STAGES.indexOf(lead.stage) > i && lead.stage !== 'lost' ? 'is-past' : ''}" aria-pressed={lead.stage === s}>{LEAD_STAGE[s].label}</button>
					</form>
				{/if}
			{/each}
			{#if lead.stage === 'lost' && lead.lostReason}<span class="text-[13px] text-q-secondary">— {lead.lostReason}</span>{/if}
		</div>
	{/if}

	<div class="grid gap-10 xl:grid-cols-[minmax(0,1fr)_340px]">
		<div class="flex min-w-0 flex-col gap-8">
			{#if data.canEdit}
				<Section title="Log or reply">
					<div class="q-card flex flex-col">
						<div class="flex gap-1 border-b border-q-border p-1.5" role="tablist" aria-label="Composer">
							{#each [{ id: 'note', label: 'Note', icon: StickyNote }, { id: 'call', label: 'Call', icon: PhoneCall }, { id: 'email', label: 'Email', icon: Mail, off: !lead.email }, { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, off: !lead.phone }] as const as tab (tab.id)}
								<button
									type="button"
									role="tab"
									aria-selected={composer === tab.id}
									disabled={'off' in tab && tab.off}
									class="flex h-9 items-center gap-2 rounded-[8px] px-3 text-[14px] disabled:opacity-40 {composer === tab.id ? 'bg-q-muted font-medium text-q-text' : 'text-q-secondary hover:text-q-text'}"
									onclick={() => (composer = tab.id)}
								><tab.icon size={16} strokeWidth={1.5} /> {tab.label}</button>
							{/each}
						</div>
						<div class="p-4">
							{#if composer === 'note' || composer === 'call'}
								<form method="POST" action="?/log" class="flex flex-col gap-3" use:enhance={submitter(toaster, { reset: true })}>
									<input type="hidden" name="kind" value={composer} />
									<label for="lg-body" class="sr-only">{composer === 'call' ? 'What was said' : 'Note'}</label>
									<textarea id="lg-body" name="body" class="q-textarea min-h-[88px]" placeholder={composer === 'call' ? 'What was said on the call' : 'A note for the team'} required></textarea>
									<div><button type="submit" class="q-btn q-btn-primary">{composer === 'call' ? 'Log call' : 'Add note'}</button></div>
								</form>
							{:else if composer === 'email'}
								<form method="POST" action="?/email" class="flex flex-col gap-3" use:enhance={submitter(toaster, { reset: true })}>
									{#if !data.channels.email}<Notice kind="warning">Email is not connected yet; the message will be logged as not sent.</Notice>{/if}
									<input name="subject" class="q-input" placeholder="Subject" aria-label="Subject" required />
									<textarea name="message" class="q-textarea min-h-[140px]" placeholder="Hi {lead.name?.split(' ')[0] ?? 'there'}," aria-label="Message" required></textarea>
									<div class="flex items-center gap-3">
										<button type="submit" class="q-btn q-btn-primary"><Mail /> Send email</button>
										<span class="q-help">To {lead.email}, from your business address, signed Rootwear.</span>
									</div>
								</form>
							{:else}
								<form method="POST" action="?/whatsapp" class="flex flex-col gap-3" use:enhance={submitter(toaster, { reset: true })}>
									{#if !data.channels.whatsapp}
										<Notice kind="warning">WhatsApp is not connected yet. Until it is, use “Open in WhatsApp” to reply from your phone.</Notice>
									{:else if !data.lead.whatsappWindowOpen}
										<Notice kind="info">WhatsApp allows a free reply only within 24 hours of their last message. Email them, or reply from your phone.</Notice>
									{:else}
										<p class="q-help">Reply window open for {windowLeft} more hour{windowLeft === 1 ? '' : 's'}.</p>
									{/if}
									<textarea name="message" class="q-textarea min-h-[100px]" aria-label="WhatsApp message" required disabled={!data.channels.whatsapp || !data.lead.whatsappWindowOpen}></textarea>
									<div class="flex flex-wrap items-center gap-2">
										<button type="submit" class="q-btn q-btn-primary" disabled={!data.channels.whatsapp || !data.lead.whatsappWindowOpen}><MessageCircle /> Send</button>
										{#if waLink}<a class="q-btn q-btn-ghost" href={waLink} target="_blank" rel="noopener">Open in WhatsApp</a>{/if}
									</div>
								</form>
							{/if}
						</div>
					</div>
				</Section>
			{/if}

			<Section title="History">
				<ol class="flex flex-col gap-3">
					{#each lead.activities as a (a.id)}
						{@const k = KIND[a.kind] ?? { label: a.kind, tone: '' }}
						<li class="flex flex-col gap-1 {k.tone === 'in' ? 'items-start' : k.tone === 'out' ? 'items-end' : ''}">
							{#if k.tone === 'in' || k.tone === 'out' || k.tone === 'note'}
								<div class="max-w-[560px] rounded-[14px] px-4 py-3 text-[14px] leading-[20px] whitespace-pre-wrap {k.tone === 'in' ? 'rounded-tl-[4px] bg-q-surface border border-q-border' : k.tone === 'out' ? 'rounded-tr-[4px] bg-q-accent-tint' : 'bg-q-warning-tint'} text-q-body">{a.body}</div>
								<p class="text-[12px] text-q-tertiary">{k.label}{a.meta?.channel ? ` · ${a.meta.channel === 'whatsapp' ? 'WhatsApp' : 'Email'}` : ''} · {shortDateTime(a.at)}{a.actor && a.actor !== 'system' ? ` · ${a.actor}` : ''}</p>
							{:else}
								<p class="text-[13px] text-q-secondary">
									<span class="font-medium text-q-body">{k.label}</span> — <span class="whitespace-pre-wrap">{a.body}</span>
									<span class="text-q-tertiary"> · {shortDateTime(a.at)}{a.actor && a.actor !== 'system' ? ` · ${a.actor}` : ''}</span>
								</p>
							{/if}
						</li>
					{/each}
				</ol>
			</Section>
		</div>

		<aside class="flex flex-col gap-8">
			<Section title="Contact">
				{#snippet actions()}{#if data.canEdit}<button type="button" class="q-btn q-btn-ghost q-btn-sm" onclick={() => (editing = true)}><Pencil /> Edit</button>{/if}{/snippet}
				<div class="q-card flex flex-col gap-2 p-4 text-[14px]">
					{#if lead.instagram}<p class="flex items-center gap-2"><AtSign size={16} strokeWidth={1.5} class="text-q-tertiary" /><a class="q-link" href={igLink} target="_blank" rel="noopener">@{lead.instagram}</a></p>{/if}
					{#if lead.phone}<p class="flex items-center gap-2"><Phone size={16} strokeWidth={1.5} class="text-q-tertiary" /><a class="q-link" href="tel:+{lead.phone.replace(/\D/g, '')}">{formatPhone(lead.phone)}</a>{#if waLink}<a class="text-[13px] text-q-secondary hover:text-q-text" href={waLink} target="_blank" rel="noopener">WhatsApp</a>{/if}</p>{/if}
					{#if lead.email}<p class="flex items-center gap-2 break-all"><Mail size={16} strokeWidth={1.5} class="flex-none text-q-tertiary" /><a class="q-link" href="mailto:{lead.email}">{lead.email}</a></p>{/if}
					{#if lead.interest}<p class="mt-2 text-q-body"><span class="block text-[12px] text-q-tertiary">Wants</span>{lead.interest}</p>{/if}
					<p class="mt-2 text-[12px] text-q-tertiary">Agreed to: {[lead.consentEmail && 'email', lead.consentWhatsapp && 'WhatsApp'].filter(Boolean).join(', ') || 'nothing recorded'}</p>
				</div>
			</Section>

			<Section title="Owner and follow-up">
				<div class="q-card flex flex-col gap-4 p-4">
					<form method="POST" action="?/assign" use:enhance={submitter(toaster)}>
						<label for="ld-owner" class="q-label mb-2 block">Owner</label>
						<select id="ld-owner" name="owner" class="q-select" disabled={!data.canEdit} onchange={(e) => e.currentTarget.form?.requestSubmit()}>
							<option value="">Unassigned</option>
							{#each data.owners as o (o)}<option value={o} selected={lead.owner === o}>{o}{o === data.me ? ' (you)' : ''}</option>{/each}
						</select>
					</form>
					<form method="POST" action="?/followUp" class="flex flex-col gap-2" use:enhance={submitter(toaster)}>
						<label for="ld-follow" class="q-label">Follow up on</label>
						<div class="flex gap-2">
							<input id="ld-follow" name="date" type="date" class="q-input" value={followValue} disabled={!data.canEdit} />
							{#if data.canEdit}<button type="submit" class="q-btn q-btn-secondary"><CalendarClock /> Set</button>{/if}
						</div>
						{#if lead.nextFollowUpAt}<p class="q-help {lead.nextFollowUpAt <= data.now ? '!text-q-danger-text' : ''}">{lead.nextFollowUpAt <= data.now ? 'Due now' : `On ${shortDate(lead.nextFollowUpAt)}`}</p>{/if}
					</form>
					{#if lead.lastContactedAt}<p class="text-[13px] text-q-secondary">Last contacted {timeAgo(lead.lastContactedAt, data.now)}</p>{/if}
				</div>
			</Section>

			<Section title="Where they came from">
				<dl class="q-card grid grid-cols-[100px_1fr] gap-x-3 gap-y-1.5 p-4 text-[13px]">
					<dt class="text-q-secondary">Channel</dt><dd>{LEAD_SOURCE_LABEL[lead.source]}</dd>
					{#if lead.sourceDetail}<dt class="text-q-secondary">Detail</dt><dd>{lead.sourceDetail}</dd>{/if}
					<dt class="text-q-secondary">Campaign</dt><dd>{lead.campaign}</dd>
					{#if lead.utm.first?.landing}<dt class="text-q-secondary">Landed on</dt><dd class="q-mono break-all">{lead.utm.first.landing}</dd>{/if}
				</dl>
			</Section>

			<Section title="Orders">
				{#if lead.orders.length === 0}
					<p class="text-[14px] text-q-secondary">No orders yet. When they pay, this lead is marked won by itself.</p>
				{:else}
					<ul class="q-card q-divide">
						{#each lead.orders as order (order.id)}
							{@const os = label(ORDER_STATE, order.state)}
							<li class="flex items-center justify-between gap-3 p-3 pl-4 text-[14px]">
								{#if data.canOrders}<a class="q-link q-mono" href="/admin/orders/{order.id}">{order.number}</a>{:else}<span class="q-mono">{order.number}</span>{/if}
								<span class="flex items-center gap-2"><Chip label={os.label} tone={os.tone} />{formatInr(order.total)}</span>
							</li>
						{/each}
					</ul>
				{/if}
			</Section>
		</aside>
	</div>
</div>

<Drawer bind:open={editing} title="Contact details">
	<form id="lead-edit" method="POST" action="?/details" class="flex flex-col gap-4" use:enhance={submitter(toaster, { onSuccess: () => (editing = false) })}>
		{#each [['name', 'Name', lead.name], ['instagram', 'Instagram', lead.instagram ? `@${lead.instagram}` : ''], ['phone', 'Phone', lead.phone], ['email', 'Email', lead.email], ['interest', 'What they want', lead.interest]] as [name, text, value] (name)}
			<Field label={text ?? ''} id="le-{name}" optional>
				{#snippet children({ describedBy })}<input id="le-{name}" name={name} class="q-input" value={value ?? ''} aria-describedby={describedBy} />{/snippet}
			</Field>
		{/each}
		<fieldset class="flex flex-col gap-2">
			<legend class="q-label mb-1">They agreed to hear from us by</legend>
			<label class="flex items-center gap-2 text-[14px]"><input type="checkbox" class="q-check" name="consentWhatsapp" checked={lead.consentWhatsapp} /> WhatsApp</label>
			<label class="flex items-center gap-2 text-[14px]"><input type="checkbox" class="q-check" name="consentEmail" checked={lead.consentEmail} /> Email</label>
		</fieldset>
	</form>
	{#snippet footer()}
		<button type="button" class="q-btn q-btn-secondary" onclick={() => (editing = false)}>Cancel</button>
		<button type="submit" form="lead-edit" class="q-btn q-btn-primary">Save</button>
	{/snippet}
</Drawer>

<Drawer bind:open={losing} title="Mark as lost" description="Why it did not happen. These add up into useful patterns.">
	<form id="lead-lost" method="POST" action="?/stage" class="flex flex-col gap-4" use:enhance={submitter(toaster, { onSuccess: () => (losing = false) })}>
		<input type="hidden" name="stage" value="lost" />
		<Field label="Reason" id="ll-reason">
			{#snippet children({ describedBy })}
				<input id="ll-reason" name="lostReason" list="lost-reasons" class="q-input" required aria-describedby={describedBy} />
				<datalist id="lost-reasons">
					<option value="Size sold out"></option><option value="Too expensive"></option><option value="No reply"></option><option value="Bought elsewhere"></option><option value="Just browsing"></option>
				</datalist>
			{/snippet}
		</Field>
	</form>
	{#snippet footer()}
		<button type="button" class="q-btn q-btn-secondary" onclick={() => (losing = false)}>Cancel</button>
		<button type="submit" form="lead-lost" class="q-btn q-btn-primary">Mark lost</button>
	{/snippet}
</Drawer>

<style>
	.stage {
		height: 36px;
		padding: 0 14px;
		border-radius: 999px;
		border: 1px solid var(--color-q-border-strong);
		font-size: 14px;
		color: var(--color-q-secondary);
		background: var(--color-q-surface);
		transition: background-color 150ms ease-out, color 150ms ease-out;
	}
	.stage:hover {
		color: var(--color-q-text);
		background: var(--color-q-muted);
	}
	.stage.is-past {
		color: var(--color-q-body);
	}
	.stage.is-on {
		background: var(--color-q-accent);
		border-color: var(--color-q-accent);
		color: var(--color-q-on-accent);
		font-weight: 500;
	}
</style>
