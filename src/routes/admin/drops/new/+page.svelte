<script lang="ts">
	import { enhance } from '$app/forms';
	import Field from '$lib/components/admin/ui/Field.svelte';
	import PageHeader from '$lib/components/admin/ui/PageHeader.svelte';
	import Notice from '$lib/components/admin/Notice.svelte';
	import { submitter } from '$lib/components/admin/enhance';
	import { getToaster } from '$lib/components/admin/toast.svelte';

	let { data, form } = $props();
	const toaster = getToaster();

	let values = $derived(form?.values);
	let errors = $derived((form?.errors ?? {}) as Record<string, string>);
	let name = $state('');
	let number = $state('');
	$effect.pre(() => {
		name = values?.name ?? '';
		number = values?.number ?? String(data.nextNumber);
	});

	let slugPreview = $derived(
		`${String(number || data.nextNumber).padStart(2, '0')}-${name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')}`
	);
</script>

<svelte:head><title>New drop · Rootwear admin</title></svelte:head>

<div class="flex max-w-[520px] flex-col gap-8">
	<PageHeader
		title="New drop"
		description="It starts hidden, in Tease. Add its pieces and photos, preview it, then publish."
		back={{ href: '/admin/drops', label: 'Drops' }}
	/>

	{#if form?.error}<Notice kind="error">{form.error}</Notice>{/if}

	<form method="POST" class="flex flex-col gap-5" use:enhance={submitter(toaster)}>
		<div class="grid grid-cols-[120px_1fr] gap-4">
			<Field label="Number" id="drop-number" error={errors.number}>
				{#snippet children({ describedBy, invalid })}
					<input id="drop-number" name="number" type="number" min="1" max="99" class="q-input" bind:value={number} aria-describedby={describedBy} aria-invalid={invalid} required />
				{/snippet}
			</Field>
			<Field label="Name" id="drop-name" error={errors.name}>
				{#snippet children({ describedBy, invalid })}
					<input id="drop-name" name="name" class="q-input" bind:value={name} placeholder="Pineapple Haze" aria-describedby={describedBy} aria-invalid={invalid} required />
				{/snippet}
			</Field>
		</div>
		<p class="q-help -mt-2">Its address will be <span class="q-mono">/drops/{slugPreview}</span>. It cannot change once published.</p>

		<Field label="Story" id="drop-story" optional help="The paragraph under the name on the drop page. You can edit it later.">
			{#snippet children({ describedBy })}
				<textarea id="drop-story" name="story" class="q-textarea" aria-describedby={describedBy}>{values?.story ?? ''}</textarea>
			{/snippet}
		</Field>

		<div class="grid gap-4 sm:grid-cols-2">
			<Field label="Launch (IST)" id="drop-launch" error={errors.launch} help="The countdown runs to this.">
				{#snippet children({ describedBy, invalid })}
					<input id="drop-launch" name="launch" type="datetime-local" class="q-input" value={values?.launch ?? ''} aria-describedby={describedBy} aria-invalid={invalid} required />
				{/snippet}
			</Field>
			<Field label="Edition size" id="drop-edition" error={errors.editionSize} help="Pieces in total, across all sizes.">
				{#snippet children({ describedBy, invalid })}
					<input id="drop-edition" name="editionSize" type="number" min="1" class="q-input" value={values?.editionSize ?? '25'} aria-describedby={describedBy} aria-invalid={invalid} required />
				{/snippet}
			</Field>
		</div>

		<label class="flex items-start gap-3 rounded-[10px] border border-q-border p-3">
			<input type="checkbox" class="q-check mt-0.5" name="preorderMode" checked={values?.preorderMode ?? false} />
			<span class="flex flex-col gap-0.5">
				<span class="text-[14px] font-medium text-q-text">Take pre-order signups</span>
				<span class="text-[13px] leading-[18px] text-q-secondary">The product page shows Pre-order and collects names instead of selling. You can switch this later.</span>
			</span>
		</label>

		<div><button type="submit" class="q-btn q-btn-primary">Create drop</button></div>
	</form>
</div>
