<script lang="ts">
	import { enhance } from '$app/forms';
	import { MessageSquare, Send } from '@lucide/svelte';
	import Chip from '$lib/components/admin/ui/Chip.svelte';
	import EmptyState from '$lib/components/admin/ui/EmptyState.svelte';
	import PageHeader from '$lib/components/admin/ui/PageHeader.svelte';
	import Tabs from '$lib/components/admin/ui/Tabs.svelte';
	import Notice from '$lib/components/admin/Notice.svelte';
	import { submitter } from '$lib/components/admin/enhance';
	import { getToaster } from '$lib/components/admin/toast.svelte';
	import { shortDateTime, timeAgo } from '$lib/components/admin/tone';

	let { data, form } = $props();
	const toaster = getToaster();
	let replying = $state<string | null>(null);
	const STATUS = {
		new: { label: 'New', tone: 'warning' },
		in_progress: { label: 'Replied', tone: 'accent' },
		closed: { label: 'Closed', tone: 'neutral' }
	} as const;
</script>

<svelte:head><title>Contact · Rootwear admin</title></svelte:head>

<div class="flex flex-col gap-6">
	<PageHeader
		title="Contact"
		description="Messages from the contact form. Reply by email from here; the reply is logged.{data.spam
			? ` ${data.spam} caught as spam are hidden.`
			: ''}"
	/>
	{#if form && 'error' in form && form.error}<Notice kind="error">{form.error}</Notice>{/if}
	<Tabs
		label="Status"
		tabs={[
			{ href: '/admin/contact', label: 'All', exact: true },
			{ href: '/admin/contact?status=new', label: 'New' },
			{ href: '/admin/contact?status=in_progress', label: 'Replied' },
			{ href: '/admin/contact?status=closed', label: 'Closed' }
		]}
	/>
	{#if data.submissions.length === 0}
		<div class="q-card">
			<EmptyState
				icon={MessageSquare}
				title="No messages here"
				body="Messages from the contact page arrive here."
				compact
			/>
		</div>
	{:else}
		<ul class="flex flex-col gap-3">
			{#each data.submissions as row (row.id)}
				{@const st = STATUS[row.status]}
				<li class="q-card flex flex-col gap-3 p-4">
					<div class="flex flex-wrap items-start justify-between gap-3">
						<div>
							<p class="text-[14px] font-medium text-q-text">{row.subject}</p>
							<p class="text-[13px] text-q-secondary">
								{row.name} · <a class="q-link" href="mailto:{row.email}">{row.email}</a> ·
								<span class="q-mono">{row.trackingId}</span>
							</p>
						</div>
						<div class="flex items-center gap-2">
							<Chip label={st.label} tone={st.tone} />
							<span class="text-[12px] text-q-tertiary" title={shortDateTime(row.createdAt)}
								>{timeAgo(row.createdAt, data.now)}</span
							>
						</div>
					</div>
					<p class="text-[14px] leading-[22px] whitespace-pre-wrap text-q-body">{row.message}</p>
					{#if data.canEdit}
						{#if replying === row.id}
							<form
								method="POST"
								action="?/reply"
								class="flex flex-col gap-2"
								use:enhance={submitter(toaster, { onSuccess: () => (replying = null) })}
							>
								<input type="hidden" name="id" value={row.id} />
								<label for="r-{row.id}" class="sr-only">Reply</label>
								<textarea
									id="r-{row.id}"
									name="message"
									class="q-textarea min-h-[120px]"
									placeholder="Hi {row.name.split(' ')[0]},"
									required></textarea>
								<div class="flex gap-2">
									<button type="submit" class="q-btn q-btn-primary"><Send /> Send reply</button>
									<button type="button" class="q-btn q-btn-ghost" onclick={() => (replying = null)}
										>Cancel</button
									>
								</div>
							</form>
						{:else}
							<div class="flex flex-wrap gap-2">
								<button
									type="button"
									class="q-btn q-btn-secondary q-btn-sm"
									onclick={() => (replying = row.id)}><Send /> Reply</button
								>
								<form method="POST" action="?/setStatus" use:enhance={submitter(toaster)}>
									<input type="hidden" name="id" value={row.id} />
									<input
										type="hidden"
										name="status"
										value={row.status === 'closed' ? 'new' : 'closed'}
									/>
									<button type="submit" class="q-btn q-btn-ghost q-btn-sm"
										>{row.status === 'closed' ? 'Reopen' : 'Close'}</button
									>
								</form>
							</div>
						{/if}
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>
