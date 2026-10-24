<script lang="ts">
	import { enhance } from '$app/forms';
	import { Mail, MessageCircle, RotateCw, Search, Send, X } from '@lucide/svelte';
	import Chip from '$lib/components/admin/ui/Chip.svelte';
	import Drawer from '$lib/components/admin/ui/Drawer.svelte';
	import EmptyState from '$lib/components/admin/ui/EmptyState.svelte';
	import Pager from '$lib/components/admin/ui/Pager.svelte';
	import { submitter } from '$lib/components/admin/enhance';
	import { getToaster } from '$lib/components/admin/toast.svelte';
	import { MESSAGE_STATUS, label } from '$lib/components/admin/labels';
	import { shortDateTime, timeAgo } from '$lib/components/admin/tone';

	let { data } = $props();
	const toaster = getToaster();

	let openId = $state<string | null>(null);
	let open = $derived(data.messages.find((m) => m.id === openId) ?? null);
	let filtered = $derived(Boolean(data.filters.search || data.filters.channel));
</script>

<svelte:head><title>Messages · Rootwear admin</title></svelte:head>

<div class="flex flex-col gap-4">
	<form method="GET" class="flex flex-wrap items-end gap-2" data-sveltekit-keepfocus>
		{#if data.filters.status}<input type="hidden" name="status" value={data.filters.status} />{/if}
		<div class="relative min-w-[240px] flex-1 sm:max-w-[360px]">
			<Search size={16} strokeWidth={1.5} class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-q-tertiary" />
			<label for="msg-search" class="sr-only">Search messages</label>
			<input
				id="msg-search"
				name="q"
				type="search"
				class="q-input pl-9"
				placeholder="Search recipient or subject"
				value={data.filters.search}
			/>
		</div>
		<label for="msg-channel" class="sr-only">Channel</label>
		<select
			id="msg-channel"
			name="channel"
			class="q-select w-auto"
			onchange={(event) => event.currentTarget.form?.requestSubmit()}
		>
			<option value="">All channels</option>
			<option value="email" selected={data.filters.channel === 'email'}>Email</option>
			<option value="whatsapp" selected={data.filters.channel === 'whatsapp'}>WhatsApp</option>
		</select>
		<button type="submit" class="q-btn q-btn-secondary">Search</button>
		{#if filtered}
			<a class="q-btn q-btn-ghost" href="/admin/messages{data.filters.status ? `?status=${data.filters.status}` : ''}">
				<X /> Clear
			</a>
		{/if}
	</form>

	{#if data.messages.length === 0}
		<div class="q-card">
			{#if filtered}
				<EmptyState icon={Search} title="No messages match" body="Try a different name, email or number." compact />
			{:else if data.filters.status === 'problem'}
				<EmptyState icon={Send} title="Nothing is stuck" body="Every message went out. Failed or skipped messages would appear here." compact />
			{:else}
				<EmptyState
					icon={Send}
					title="No messages yet"
					body="Order confirmations, dispatch updates and reminders appear here as they are sent."
					compact
				/>
			{/if}
		</div>
	{:else}
		<div class="q-table-wrap">
			<table class="q-table">
				<thead>
					<tr>
						<th scope="col">To</th>
						<th scope="col">Message</th>
						<th scope="col">Status</th>
						<th scope="col" class="num">When</th>
					</tr>
				</thead>
				<tbody>
					{#each data.messages as message (message.id)}
						{@const status = label(MESSAGE_STATUS, message.status)}
						<tr aria-selected={openId === message.id}>
							<td>
								<button
									type="button"
									class="row-link flex items-center gap-2 text-left"
									onclick={() => (openId = message.id)}
								>
									<span class="text-q-tertiary">
										{#if message.channel === 'email'}<Mail size={16} strokeWidth={1.5} />{:else}<MessageCircle
												size={16}
												strokeWidth={1.5}
											/>{/if}
									</span>
									<span class="flex flex-col">
										<span>{message.recipientName ?? message.recipient}</span>
										{#if message.recipientName}
											<span class="text-[13px] font-normal text-q-secondary">{message.recipient}</span>
										{/if}
									</span>
								</button>
							</td>
							<td class="max-w-[420px]">
								<p class="truncate text-q-text">{message.subject ?? message.body.split('\n')[0]}</p>
								{#if message.lastError && (message.status === 'failed' || message.status === 'skipped' || message.status === 'queued')}
									<p class="truncate text-[13px] text-q-secondary">{message.lastError}</p>
								{/if}
							</td>
							<td><Chip label={status.label} tone={status.tone} /></td>
							<td class="num text-q-secondary" title={shortDateTime(message.createdAt)}>
								{timeAgo(message.createdAt)}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<Pager page={data.page} pageSize={data.pageSize} total={data.total} />
	{/if}
</div>

<Drawer
	open={open !== null}
	onclose={() => (openId = null)}
	title={open?.subject ?? (open?.channel === 'whatsapp' ? 'WhatsApp message' : 'Message')}
	description={open ? `To ${open.recipientName ? `${open.recipientName} · ` : ''}${open.recipient}` : ''}
>
	{#if open}
		{@const status = label(MESSAGE_STATUS, open.status)}
		<div class="flex flex-col gap-6">
			<div class="flex flex-wrap items-center gap-2">
				<Chip label={status.label} tone={status.tone} />
				<Chip label={open.channel === 'email' ? 'Email' : 'WhatsApp'} dot={false} />
				<Chip label={open.purpose === 'marketing' ? 'Marketing' : 'Transactional'} dot={false} />
			</div>

			{#if open.lastError}
				<div class="rounded-[10px] bg-q-warning-tint px-4 py-3 text-[14px] text-q-warning-text">
					{open.lastError}
				</div>
			{/if}

			<div class="rounded-[10px] border border-q-border bg-q-surface p-4">
				<p class="text-[14px] leading-[22px] whitespace-pre-wrap text-q-body">{open.body}</p>
			</div>

			<dl class="grid grid-cols-[140px_1fr] gap-x-4 gap-y-2 text-[14px]">
				<dt class="text-q-secondary">Created</dt>
				<dd>{shortDateTime(open.createdAt)} by {open.createdBy ?? 'system'}</dd>
				{#if open.sentAt}<dt class="text-q-secondary">Sent</dt><dd>{shortDateTime(open.sentAt)}</dd>{/if}
				{#if open.deliveredAt}<dt class="text-q-secondary">Delivered</dt><dd>{shortDateTime(open.deliveredAt)}</dd>{/if}
				{#if open.readAt}<dt class="text-q-secondary">Read</dt><dd>{shortDateTime(open.readAt)}</dd>{/if}
				<dt class="text-q-secondary">Attempts</dt>
				<dd>{open.attempts} of {open.maxAttempts}</dd>
				{#if open.templateKey}<dt class="text-q-secondary">Template</dt><dd class="q-mono">{open.templateKey}</dd>{/if}
				{#if open.provider}<dt class="text-q-secondary">Provider</dt><dd>{open.provider}</dd>{/if}
				{#if open.contextType}<dt class="text-q-secondary">About</dt><dd>{open.contextType} {open.contextId}</dd>{/if}
			</dl>
		</div>
	{/if}
	{#snippet footer()}
		{#if open && data.canResend}
			{#if open.status === 'queued'}
				<form method="POST" action="?/cancel" use:enhance={submitter(toaster, { onSuccess: () => (openId = null) })}>
					<input type="hidden" name="id" value={open.id} />
					<button type="submit" class="q-btn q-btn-secondary">Cancel message</button>
				</form>
			{/if}
			{#if ['failed', 'skipped', 'cancelled'].includes(open.status)}
				<form method="POST" action="?/retry" use:enhance={submitter(toaster)}>
					<input type="hidden" name="id" value={open.id} />
					<button type="submit" class="q-btn q-btn-primary"><RotateCw /> Send again</button>
				</form>
			{/if}
		{/if}
	{/snippet}
</Drawer>
