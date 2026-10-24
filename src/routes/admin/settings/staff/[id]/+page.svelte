<script lang="ts">
	import { enhance } from '$app/forms';
	import { Check, Copy, KeyRound, Trash2 } from '@lucide/svelte';
	import Chip from '$lib/components/admin/ui/Chip.svelte';
	import Field from '$lib/components/admin/ui/Field.svelte';
	import Modal from '$lib/components/admin/ui/Modal.svelte';
	import Section from '$lib/components/admin/ui/Section.svelte';
	import Timeline from '$lib/components/admin/ui/Timeline.svelte';
	import Notice from '$lib/components/admin/Notice.svelte';
	import PermissionPicker from '$lib/components/admin/PermissionPicker.svelte';
	import { submitter } from '$lib/components/admin/enhance';
	import { getToaster } from '$lib/components/admin/toast.svelte';
	import { timeAgo } from '$lib/components/admin/tone';

	let { data, form } = $props();
	const toaster = getToaster();

	let selected = $state<string[]>([]);
	let isOwner = $state(false);
	let active = $state(true);
	let password = $state<string | null>(null);
	let confirmRemove = $state(false);
	let copied = $state(false);

	// Re-seed the editable copy whenever the saved record changes.
	$effect.pre(() => {
		selected = [...data.person.permissions];
		isOwner = data.person.isOwner;
		active = data.person.active;
	});

	$effect(() => {
		if (form && 'password' in form && form.password) password = form.password;
	});

	let person = $derived(data.person);
</script>

<svelte:head><title>{person.name ?? person.email} · Staff · Rootwear admin</title></svelte:head>

<div class="flex flex-col gap-8">
	<div class="flex flex-col gap-3">
		<a href="/admin/settings/staff" class="w-fit text-[13px] text-q-secondary hover:text-q-text"
			>← Staff</a
		>
		<div class="flex flex-wrap items-center gap-3">
			<h2 class="text-[20px] leading-[28px] font-semibold tracking-[-0.005em] text-q-text">
				{person.name ?? person.email}
			</h2>
			{#if person.isOwner}<Chip label="Owner" tone="accent" />{/if}
			{#if !person.active}<Chip label="Deactivated" />{/if}
			{#if data.isMe}<Chip label="You" dot={false} />{/if}
		</div>
		<p class="text-[13px] text-q-secondary">
			{person.email} · Added {timeAgo(person.createdAt)}{person.invitedBy
				? ` by ${person.invitedBy}`
				: ''}
			· {person.lastSeenAt
				? `Last signed in ${timeAgo(person.lastSeenAt)}`
				: 'Has not signed in yet'}
		</p>
	</div>

	{#if form?.error}<Notice kind="error">{form.error}</Notice>{/if}
	{#if !data.canEdit}
		<Notice kind="info"
			>Only an owner can change the access of an owner, or of someone with permissions you do not
			have.</Notice
		>
	{/if}

	<div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
		<form
			method="POST"
			action="?/save"
			class="flex max-w-[640px] flex-col gap-6"
			use:enhance={submitter(toaster)}
		>
			<fieldset disabled={!data.canEdit} class="flex flex-col gap-6">
				<Field label="Name" id="staff-name" optional>
					{#snippet children({ describedBy })}
						<input
							id="staff-name"
							name="name"
							class="q-input"
							value={person.name ?? ''}
							aria-describedby={describedBy}
						/>
					{/snippet}
				</Field>

				<PermissionPicker bind:selected bind:isOwner canMakeOwners={data.canMakeOwners} />

				<label class="flex items-start gap-3 rounded-[10px] border border-q-border p-3">
					<input type="checkbox" class="q-check mt-0.5" name="active" bind:checked={active} />
					<span class="flex flex-col gap-0.5">
						<span class="text-[14px] font-medium text-q-text">Can sign in</span>
						<span class="text-[13px] leading-[18px] text-q-secondary">
							Untick to stop this person signing in without losing their settings.
						</span>
					</span>
				</label>
			</fieldset>
			{#if data.canEdit}
				<div>
					<button type="submit" class="q-btn q-btn-primary">Save access</button>
				</div>
			{/if}
		</form>

		<aside class="flex flex-col gap-8">
			{#if data.canEdit}
				<Section title="Sign-in">
					<div class="flex flex-col gap-3">
						<form method="POST" action="?/resetPassword" use:enhance={submitter(toaster)}>
							<button type="submit" class="q-btn q-btn-secondary w-full">
								<KeyRound /> Reset password
							</button>
						</form>
						<p class="q-help">
							Creates a new temporary password for you to pass on. Their old one stops working.
						</p>
						<button
							type="button"
							class="q-btn q-btn-danger-ghost w-full"
							onclick={() => (confirmRemove = true)}
						>
							<Trash2 /> Remove from team
						</button>
					</div>
				</Section>
			{/if}
			<Section title="History">
				<Timeline
					events={data.history.map((entry) => ({
						at: entry.occurredAt,
						title: entry.action.charAt(0).toUpperCase() + entry.action.slice(1),
						actor: entry.actor
					}))}
				/>
			</Section>
		</aside>
	</div>
</div>

<Modal
	open={password !== null}
	onclose={() => (password = null)}
	title="New temporary password"
	description="Send it to them yourself, not by email. It is shown only once."
>
	<div class="flex items-center gap-2 rounded-[10px] bg-q-muted p-3">
		<code class="q-mono flex-1 text-[15px] text-q-text">{password}</code>
		<button
			type="button"
			class="q-btn q-btn-secondary q-btn-sm"
			onclick={async () => {
				await navigator.clipboard.writeText(password ?? '');
				copied = true;
				setTimeout(() => (copied = false), 2000);
			}}
		>
			{#if copied}<Check /> Copied{:else}<Copy /> Copy{/if}
		</button>
	</div>
	{#snippet footer()}
		<button type="button" class="q-btn q-btn-primary" onclick={() => (password = null)}>Done</button
		>
	{/snippet}
</Modal>

<Modal
	bind:open={confirmRemove}
	title="Remove {person.name ?? person.email}?"
	description="They will no longer be able to sign in to admin. Their history in the audit log stays. You can add them again later."
>
	{#snippet footer()}
		<button type="button" class="q-btn q-btn-secondary" onclick={() => (confirmRemove = false)}
			>Keep</button
		>
		<form method="POST" action="?/remove" use:enhance={submitter(toaster)}>
			<button type="submit" class="q-btn q-btn-danger">Remove from team</button>
		</form>
	{/snippet}
</Modal>
