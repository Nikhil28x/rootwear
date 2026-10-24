<script lang="ts">
	import { enhance } from '$app/forms';
	import Field from '$lib/components/admin/ui/Field.svelte';
	import PageHeader from '$lib/components/admin/ui/PageHeader.svelte';
	import Section from '$lib/components/admin/ui/Section.svelte';
	import Notice from '$lib/components/admin/Notice.svelte';
	import { submitter } from '$lib/components/admin/enhance';
	import { getToaster } from '$lib/components/admin/toast.svelte';

	let { data, form } = $props();
	const toaster = getToaster();
</script>

<svelte:head><title>Your account · Rootwear admin</title></svelte:head>

<div class="flex max-w-[520px] flex-col gap-10">
	<PageHeader title="Your account" description={data.me.email} />

	{#if form?.error}<Notice kind="error">{form.error}</Notice>{/if}

	<Section title="Name">
		<form method="POST" action="?/name" class="flex items-end gap-2" use:enhance={submitter(toaster)}>
			<Field label="Name shown to the team" id="me-name" class="flex-1">
				{#snippet children({ describedBy })}
					<input id="me-name" name="name" class="q-input" value={data.me.name ?? ''} aria-describedby={describedBy} />
				{/snippet}
			</Field>
			<button type="submit" class="q-btn q-btn-secondary">Save name</button>
		</form>
	</Section>

	<Section title="Password">
		<form method="POST" action="?/password" class="flex flex-col gap-4" use:enhance={submitter(toaster, { reset: true })}>
			<Field label="Current password" id="pw-current">
				{#snippet children({ describedBy })}
					<input id="pw-current" name="current" type="password" class="q-input" autocomplete="current-password" required aria-describedby={describedBy} />
				{/snippet}
			</Field>
			<Field label="New password" id="pw-next" help="At least 12 characters.">
				{#snippet children({ describedBy })}
					<input id="pw-next" name="next" type="password" class="q-input" autocomplete="new-password" minlength="12" required aria-describedby={describedBy} />
				{/snippet}
			</Field>
			<Field label="New password again" id="pw-confirm">
				{#snippet children({ describedBy })}
					<input id="pw-confirm" name="confirm" type="password" class="q-input" autocomplete="new-password" required aria-describedby={describedBy} />
				{/snippet}
			</Field>
			<div><button type="submit" class="q-btn q-btn-primary">Change password</button></div>
		</form>
	</Section>

	<Section title="What you can do" description={data.me.isOwner ? 'You are an owner: full access.' : 'Ask an owner if you need more.'}>
		{#if !data.me.isOwner}
			<ul class="flex flex-col gap-1 text-[14px] text-q-body">
				{#each data.granted as item (item)}<li>· {item}</li>{/each}
			</ul>
		{/if}
	</Section>
</div>
