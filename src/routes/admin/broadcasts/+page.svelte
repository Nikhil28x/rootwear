<script lang="ts">
	import { enhance, deserialize } from '$app/forms';
	import { Megaphone, Plus, Send, Users } from '@lucide/svelte';
	import Drawer from '$lib/components/admin/ui/Drawer.svelte';
	import EmptyState from '$lib/components/admin/ui/EmptyState.svelte';
	import Field from '$lib/components/admin/ui/Field.svelte';
	import Modal from '$lib/components/admin/ui/Modal.svelte';
	import PageHeader from '$lib/components/admin/ui/PageHeader.svelte';
	import Notice from '$lib/components/admin/Notice.svelte';
	import { submitter } from '$lib/components/admin/enhance';
	import { getToaster } from '$lib/components/admin/toast.svelte';
	import { shortDateTime } from '$lib/components/admin/tone';

	let { data, form } = $props();
	const toaster = getToaster();

	let composing = $state(false);
	let confirming = $state(false);
	let kind = $state<'drop_live' | 'custom'>('drop_live');
	let dropId = $state('');
	let audiences = $state<string[]>(['notify_me', 'waitlist', 'preorder', 'drop_request']);
	let channels = $state<string[]>(['email']);
	let name = $state('');
	let subject = $state('');
	let message = $state('');
	let counts = $state<{ email: number; whatsapp: number } | null>(null);
	let formEl: HTMLFormElement | undefined = $state();

	$effect.pre(() => {
		if (!dropId)
			dropId =
				data.drops.find((d) => ['LIVE', 'RE_DROP', 'REVEALED'].includes(d.state))?.id ??
				data.drops[0]?.id ??
				'';
	});

	// Live audience size as the choices change.
	$effect(() => {
		void [dropId, audiences.join(), composing];
		if (!composing) return;
		const body = new FormData();
		body.set('dropId', dropId);
		for (const a of audiences) body.append('audiences', a);
		const controller = new AbortController();
		fetch('?/preview', {
			method: 'POST',
			body,
			headers: { 'x-sveltekit-action': 'true' },
			signal: controller.signal
		})
			.then((r) => r.text())
			.then((text) => {
				const result = deserialize(text);
				if (result.type === 'success')
					counts = (result.data as { preview: { email: number; whatsapp: number } }).preview;
			})
			.catch(() => {});
		return () => controller.abort();
	});

	let reach = $derived(
		counts
			? (channels.includes('email') ? counts.email : 0) +
					(channels.includes('whatsapp') ? counts.whatsapp : 0)
			: 0
	);
	let dropLabel = $derived(data.drops.find((d) => d.id === dropId)?.label ?? '');
</script>

<svelte:head><title>Broadcasts · Rootwear admin</title></svelte:head>

<div class="flex flex-col gap-6">
	<PageHeader
		title="Broadcasts"
		description="Tell everyone who asked to hear first. Only people who agreed are included, each once."
	>
		{#snippet actions()}
			{#if data.broadcasts.length}<button
					type="button"
					class="q-btn q-btn-primary"
					onclick={() => (composing = true)}><Plus /> New broadcast</button
				>{/if}
		{/snippet}
	</PageHeader>

	{#if !data.channels.email}
		<Notice kind="warning"
			>Email is not connected, so broadcasts would be logged but not sent. Connect it in Settings →
			Email & WhatsApp.</Notice
		>
	{/if}

	{#if data.broadcasts.length === 0}
		<div class="q-card">
			<EmptyState
				icon={Megaphone}
				title="No broadcasts yet"
				body="When a drop opens, message the notify-me list, the waitlist and pre-order sign-ups in one go."
			>
				{#snippet action()}<button
						type="button"
						class="q-btn q-btn-primary"
						onclick={() => (composing = true)}><Plus /> New broadcast</button
					>{/snippet}
			</EmptyState>
		</div>
	{:else}
		<div class="q-table-wrap">
			<table class="q-table">
				<thead
					><tr
						><th scope="col">Broadcast</th><th scope="col">Sent</th><th scope="col" class="num"
							>To</th
						><th scope="col" class="num">Delivered</th><th scope="col" class="num">Failed</th><th
							scope="col"
							class="num">Waiting</th
						></tr
					></thead
				>
				<tbody>
					{#each data.broadcasts as b (b.id)}
						<tr>
							<td>
								<a class="row-link" href="/admin/messages?context=broadcast:{b.id}">{b.name}</a>
								<p class="text-[12px] text-q-tertiary">
									{b.audiences
										.map((a) => data.audiences.find((x) => x.value === a)?.label ?? a)
										.join(', ')} · {b.channels.join(' + ')}
								</p>
							</td>
							<td class="text-q-secondary"
								>{b.sentAt ? shortDateTime(b.sentAt) : '—'}{#if b.createdBy}<span
										class="block text-[12px]">{b.createdBy}</span
									>{/if}</td
							>
							<td class="num">{b.recipients}</td>
							<td class="num">{b.stats.sent}</td>
							<td class="num {b.stats.failed ? 'text-q-danger-text' : ''}">{b.stats.failed}</td>
							<td class="num">{b.stats.queued}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<Drawer bind:open={composing} title="New broadcast" width={560}>
	<form
		id="broadcast-form"
		bind:this={formEl}
		method="POST"
		action="?/send"
		class="flex flex-col gap-5"
		use:enhance={submitter(toaster, {
			onSuccess: () => {
				composing = false;
				confirming = false;
			}
		})}
	>
		{#if form && 'error' in form && form.error}<Notice kind="error">{form.error}</Notice>{/if}
		<Field label="Name" id="bc-name" help="For you, e.g. “Drop 02 is live”.">
			{#snippet children({ describedBy })}<input
					id="bc-name"
					name="name"
					class="q-input"
					bind:value={name}
					required
					aria-describedby={describedBy}
				/>{/snippet}
		</Field>
		<Field label="Drop" id="bc-drop">
			{#snippet children({ describedBy })}
				<select
					id="bc-drop"
					name="dropId"
					class="q-select"
					bind:value={dropId}
					aria-describedby={describedBy}
				>
					<option value="">No drop</option>
					{#each data.drops as d (d.id)}<option value={d.id}>{d.label}</option>{/each}
				</select>
			{/snippet}
		</Field>
		<fieldset class="flex flex-col gap-1">
			<legend class="q-label mb-2">Who</legend>
			{#each data.audiences as a (a.value)}
				<label class="flex items-start gap-3 rounded-[10px] px-2 py-2 hover:bg-q-muted">
					<input
						type="checkbox"
						class="q-check mt-0.5"
						name="audiences"
						value={a.value}
						bind:group={audiences}
						disabled={a.needsDrop && !dropId}
					/>
					<span class="flex flex-col"
						><span class="text-[14px] text-q-text">{a.label}</span><span
							class="text-[13px] text-q-secondary">{a.detail}</span
						></span
					>
				</label>
			{/each}
		</fieldset>
		<fieldset class="flex flex-col gap-2">
			<legend class="q-label mb-1">How</legend>
			<label class="flex items-center gap-2 text-[14px]"
				><input
					type="checkbox"
					class="q-check"
					name="channels"
					value="email"
					bind:group={channels}
				/>
				Email {#if counts}<span class="text-q-tertiary">· {counts.email} people</span>{/if}</label
			>
			<label class="flex items-center gap-2 text-[14px]"
				><input
					type="checkbox"
					class="q-check"
					name="channels"
					value="whatsapp"
					bind:group={channels}
					disabled={!data.channels.whatsapp}
				/>
				WhatsApp {#if counts}<span class="text-q-tertiary">· {counts.whatsapp} people</span
					>{/if}{#if !data.channels.whatsapp}<span class="text-q-tertiary">· not connected</span
					>{/if}</label
			>
		</fieldset>
		<fieldset class="flex flex-col gap-2">
			<legend class="q-label mb-1">Message</legend>
			<label class="flex items-center gap-2 text-[14px]"
				><input type="radio" class="q-check" name="kind" value="drop_live" bind:group={kind} /> “The drop
				is live” (the saved template)</label
			>
			<label class="flex items-center gap-2 text-[14px]"
				><input type="radio" class="q-check" name="kind" value="custom" bind:group={kind} /> Write my
				own</label
			>
		</fieldset>
		{#if kind === 'custom'}
			<Field label="Subject" id="bc-subject" help="Email only.">
				{#snippet children({ describedBy })}<input
						id="bc-subject"
						name="subject"
						class="q-input"
						bind:value={subject}
						aria-describedby={describedBy}
					/>{/snippet}
			</Field>
			<Field
				label="Message"
				id="bc-message"
				help="Starts with “Hi <name>,” and ends with “Rootwear”."
			>
				{#snippet children({ describedBy })}<textarea
						id="bc-message"
						name="message"
						class="q-textarea min-h-[140px]"
						bind:value={message}
						aria-describedby={describedBy}></textarea>{/snippet}
			</Field>
		{:else}
			<p class="q-help">Edit its words in Messages → Templates → Drop is live.</p>
		{/if}
	</form>
	{#snippet footer()}
		<p class="mr-auto flex items-center gap-2 text-[13px] text-q-secondary">
			<Users size={16} strokeWidth={1.5} />
			{counts ? `${reach} message${reach === 1 ? '' : 's'}` : 'Counting…'}
		</p>
		<button type="button" class="q-btn q-btn-secondary" onclick={() => (composing = false)}
			>Cancel</button
		>
		<button
			type="button"
			class="q-btn q-btn-primary"
			disabled={!reach || !name.trim()}
			onclick={() => (confirming = true)}><Send /> Review and send</button
		>
	{/snippet}
</Drawer>

<Modal
	bind:open={confirming}
	title="Send {reach} message{reach === 1 ? '' : 's'}?"
	description="Once sent, a broadcast cannot be recalled."
>
	<dl class="grid grid-cols-[90px_1fr] gap-x-3 gap-y-1.5 text-[14px]">
		<dt class="text-q-secondary">Name</dt>
		<dd>{name}</dd>
		{#if dropLabel}<dt class="text-q-secondary">Drop</dt>
			<dd>{dropLabel}</dd>{/if}
		<dt class="text-q-secondary">By</dt>
		<dd>{channels.join(' and ')}</dd>
		<dt class="text-q-secondary">Message</dt>
		<dd>{kind === 'drop_live' ? '“The drop is live”' : subject || message.slice(0, 60)}</dd>
	</dl>
	{#snippet footer()}
		<button type="button" class="q-btn q-btn-secondary" onclick={() => (confirming = false)}
			>Back</button
		>
		<button type="button" class="q-btn q-btn-primary" onclick={() => formEl?.requestSubmit()}
			><Send /> Send now</button
		>
	{/snippet}
</Modal>
