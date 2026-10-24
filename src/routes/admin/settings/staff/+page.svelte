<script lang="ts">
	import { enhance } from '$app/forms';
	import { Check, Copy, UserPlus } from '@lucide/svelte';
	import Chip from '$lib/components/admin/ui/Chip.svelte';
	import Drawer from '$lib/components/admin/ui/Drawer.svelte';
	import Field from '$lib/components/admin/ui/Field.svelte';
	import Modal from '$lib/components/admin/ui/Modal.svelte';
	import Notice from '$lib/components/admin/Notice.svelte';
	import PermissionPicker from '$lib/components/admin/PermissionPicker.svelte';
	import { submitter } from '$lib/components/admin/enhance';
	import { getToaster } from '$lib/components/admin/toast.svelte';
	import { timeAgo } from '$lib/components/admin/tone';

	let { data, form } = $props();
	const toaster = getToaster();

	let adding = $state(false);
	let selected = $state<string[]>([]);
	let isOwner = $state(false);
	let invited = $state<{ email: string; name: string | null; password: string | null } | null>(
		null
	);
	let copied = $state(false);

	// A no-JavaScript submit lands back here with the result in `form`.
	$effect(() => {
		if (form && 'invited' in form && form.invited) invited = form.invited;
	});

	async function copy(text: string) {
		await navigator.clipboard.writeText(text);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}
</script>

<svelte:head><title>Staff · Settings · Rootwear admin</title></svelte:head>

<div class="flex flex-col gap-4">
	<div class="flex flex-wrap items-end justify-between gap-3">
		<div class="flex flex-col gap-1">
			<h2 class="text-[16px] leading-[24px] font-semibold text-q-text">Staff</h2>
			<p class="text-[13px] leading-[18px] text-q-secondary">
				Everyone who can sign in to admin, and what each person can do.
			</p>
		</div>
		<button type="button" class="q-btn q-btn-primary" onclick={() => (adding = true)}>
			<UserPlus /> Add person
		</button>
	</div>

	<div class="q-table-wrap">
		<table class="q-table">
			<thead>
				<tr>
					<th scope="col">Person</th>
					<th scope="col">Access</th>
					<th scope="col">Last signed in</th>
					<th scope="col">Status</th>
				</tr>
			</thead>
			<tbody>
				{#each data.staff as person (person.userId)}
					<tr>
						<td>
							<a href="/admin/settings/staff/{person.userId}" class="row-link">
								{person.name ?? person.email}
							</a>
							{#if person.name}
								<p class="text-[13px] text-q-secondary">{person.email}</p>
							{/if}
							{#if person.userId === data.me}
								<p class="text-[12px] text-q-tertiary">You</p>
							{/if}
						</td>
						<td>
							{#if person.isOwner}
								<Chip label="Owner" tone="accent" />
							{:else if person.permissions.length === 0}
								<span class="text-q-tertiary">No access</span>
							{:else}
								<span class="text-q-body"
									>{person.permissions.length} permission{person.permissions.length === 1
										? ''
										: 's'}</span
								>
							{/if}
						</td>
						<td class="text-q-secondary">
							{person.lastSeenAt ? timeAgo(person.lastSeenAt) : 'Never'}
						</td>
						<td>
							{#if person.active}
								<Chip label="Active" tone="success" />
							{:else}
								<Chip label="Deactivated" />
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

<Drawer
	bind:open={adding}
	title="Add person"
	description="They sign in with their email and a temporary password."
	width={520}
>
	<form
		id="invite-form"
		method="POST"
		action="?/invite"
		class="flex flex-col gap-6"
		use:enhance={submitter(toaster, {
			reset: true,
			onSuccess: (result) => {
				adding = false;
				selected = [];
				isOwner = false;
				invited = (result?.invited as typeof invited) ?? null;
			}
		})}
	>
		{#if form?.error}
			<Notice kind="error">{form.error}</Notice>
		{/if}
		<Field label="Email" id="invite-email">
			{#snippet children({ describedBy })}
				<input
					id="invite-email"
					name="email"
					type="email"
					class="q-input"
					autocomplete="off"
					required
					value={form && 'email' in form ? form.email : ''}
					aria-describedby={describedBy}
				/>
			{/snippet}
		</Field>
		<Field
			label="Name"
			id="invite-name"
			optional
			help="Shown in the audit log and on their account."
		>
			{#snippet children({ describedBy })}
				<input
					id="invite-name"
					name="name"
					class="q-input"
					autocomplete="off"
					value={form && 'name' in form ? (form.name ?? '') : ''}
					aria-describedby={describedBy}
				/>
			{/snippet}
		</Field>
		<PermissionPicker bind:selected bind:isOwner canMakeOwners={data.canMakeOwners} />
	</form>
	{#snippet footer()}
		<button type="button" class="q-btn q-btn-secondary" onclick={() => (adding = false)}
			>Cancel</button
		>
		<button type="submit" form="invite-form" class="q-btn q-btn-primary">Add person</button>
	{/snippet}
</Drawer>

<Modal
	open={invited !== null}
	onclose={() => (invited = null)}
	title="{invited?.name ?? invited?.email ?? ''} can sign in"
	description={invited?.password
		? 'Send them this temporary password yourself, by a channel other than email. It is shown only once.'
		: 'They already had an account, so they sign in with their existing password.'}
>
	{#if invited?.password}
		<div class="flex items-center gap-2 rounded-[10px] bg-q-muted p-3">
			<code class="q-mono flex-1 text-[15px] text-q-text">{invited.password}</code>
			<button
				type="button"
				class="q-btn q-btn-secondary q-btn-sm"
				onclick={() => copy(invited!.password!)}
			>
				{#if copied}<Check /> Copied{:else}<Copy /> Copy{/if}
			</button>
		</div>
		<p class="q-help">
			{data.emailConnected
				? 'We emailed them a sign-in link without the password.'
				: 'Email is not connected yet, so no invitation email was sent.'}
		</p>
	{/if}
	{#snippet footer()}
		<button type="button" class="q-btn q-btn-primary" onclick={() => (invited = null)}>Done</button>
	{/snippet}
</Modal>
