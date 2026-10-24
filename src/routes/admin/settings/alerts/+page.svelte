<script lang="ts">
	import { enhance } from '$app/forms';
	import { Send } from '@lucide/svelte';
	import Field from '$lib/components/admin/ui/Field.svelte';
	import Section from '$lib/components/admin/ui/Section.svelte';
	import Notice from '$lib/components/admin/Notice.svelte';
	import { submitter } from '$lib/components/admin/enhance';
	import { getToaster } from '$lib/components/admin/toast.svelte';

	let { data, form } = $props();
	const toaster = getToaster();
</script>

<svelte:head><title>Alerts & digest · Settings · Rootwear admin</title></svelte:head>

<div class="flex max-w-[640px] flex-col gap-10">
	{#if form && 'error' in form && form.error}<Notice kind="error">{form.error}</Notice>{/if}
	<form method="POST" action="?/save" class="flex flex-col gap-10" use:enhance={submitter(toaster)}>
		<Section title="Low stock" description="A size counts as low when this many or fewer are left to sell. It shows on the Overview and in the digest.">
			<Field label="Low at" id="al-low">
				{#snippet children({ describedBy })}<input id="al-low" name="lowStock" type="number" min="0" max="50" class="q-input w-24" value={data.alerts.lowStock} aria-describedby={describedBy} />{/snippet}
			</Field>
		</Section>
		<Section title="Morning digest" description="One email each morning: yesterday’s sales and everything waiting. Needs the cron at /api/cron/digest once a day.">
			<fieldset class="q-card q-divide">
				<legend class="sr-only">Who gets it</legend>
				{#each data.staff as s (s.user_id)}
					<label class="flex items-center gap-3 p-3 pl-4 text-[14px]">
						<input type="checkbox" class="q-check" name="digest" value={s.user_id} checked={s.daily_digest} />
						<span>{s.display_name ?? s.email}{#if s.display_name}<span class="block text-[13px] text-q-secondary">{s.email}</span>{/if}</span>
					</label>
				{/each}
			</fieldset>
		</Section>
		<div><button type="submit" class="q-btn q-btn-primary">Save</button></div>
	</form>
	<form method="POST" action="?/test" use:enhance={submitter(toaster)}>
		<button type="submit" class="q-btn q-btn-secondary"><Send /> Send today’s digest now</button>
	</form>
</div>
