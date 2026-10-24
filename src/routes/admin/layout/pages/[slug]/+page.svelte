<script lang="ts">
	import { enhance } from '$app/forms';
	import { RotateCcw, Upload } from '@lucide/svelte';
	import Chip from '$lib/components/admin/ui/Chip.svelte';
	import Field from '$lib/components/admin/ui/Field.svelte';
	import PageHeader from '$lib/components/admin/ui/PageHeader.svelte';
	import Section from '$lib/components/admin/ui/Section.svelte';
	import Notice from '$lib/components/admin/Notice.svelte';
	import PolicyBody from '$lib/components/PolicyBody.svelte';
	import { submitter } from '$lib/components/admin/enhance';
	import { getToaster } from '$lib/components/admin/toast.svelte';
	import { markupToBlocks } from '$lib/admin/policy-markup';

	let { data, form } = $props();
	const toaster = getToaster();
	let markup = $state('');
	let title = $state('');
	$effect.pre(() => {
		markup = data.page.markup;
		title = data.page.title;
	});
	let blocks = $derived(markupToBlocks(markup));
	let wordingMissing = $derived(data.page.carriesReturnsWording && !markup.replace(/\s+/g, ' ').includes(data.returnsWording));
</script>

<svelte:head><title>{data.isNew ? 'New page' : data.page.title} · Layout · Rootwear admin</title></svelte:head>

<form method="POST" action="?/save" class="flex flex-col gap-6" use:enhance={submitter(toaster)}>
	<PageHeader title={data.isNew ? 'New page' : data.page.title} back={{ href: '/admin/layout', label: 'Layout' }} description={data.isNew ? 'Lives at /policies/<address>.' : `/policies/${data.page.slug}`}>
		{#snippet meta()}
			{#if !data.isNew}{#if !data.page.published}<Chip label="Draft" tone="warning" />{:else if data.page.edited}<Chip label="Edited" tone="accent" />{:else}<Chip label="Original" dot={false} />{/if}{/if}
		{/snippet}
		{#snippet actions()}
			<button type="submit" name="intent" value="draft" class="q-btn q-btn-secondary">Save draft</button>
			<button type="submit" name="intent" value="publish" class="q-btn q-btn-primary" disabled={wordingMissing}><Upload /> Publish</button>
		{/snippet}
	</PageHeader>

	{#if form && 'error' in form && form.error}<Notice kind="error">{form.error}</Notice>{/if}
	{#if wordingMissing}
		<Notice kind="warning">This page must keep the returns wording word for word: “{data.returnsWording}”</Notice>
	{/if}

	<div class="grid gap-8 xl:grid-cols-2">
		<div class="flex flex-col gap-4">
			<div class="grid gap-4 sm:grid-cols-[1fr_200px]">
				<Field label="Title" id="pg-title">{#snippet children({ describedBy })}<input id="pg-title" name="title" class="q-input" bind:value={title} required aria-describedby={describedBy} />{/snippet}</Field>
				{#if data.isNew}
					<Field label="Address" id="pg-slug" help="e.g. care-guide">{#snippet children({ describedBy })}<input id="pg-slug" name="slug" class="q-input q-mono" pattern="[a-z0-9]+(-[a-z0-9]+)*" required aria-describedby={describedBy} />{/snippet}</Field>
				{:else}
					<Field label="Order in lists" id="pg-order">{#snippet children({ describedBy })}<input id="pg-order" name="navOrder" type="number" class="q-input" value={data.page.navOrder} aria-describedby={describedBy} />{/snippet}</Field>
				{/if}
			</div>
			<Field label="Summary" id="pg-summary" help="One line, shown on /policies and in search results.">
				{#snippet children({ describedBy })}<input id="pg-summary" name="summary" class="q-input" value={data.page.summary} aria-describedby={describedBy} />{/snippet}
			</Field>
			<Field label="Page" id="pg-body" help="## heading · - list item · > note · | table | row | · ! contact line. A blank line starts a new block.">
				{#snippet children({ describedBy })}<textarea id="pg-body" name="markup" class="q-textarea q-mono min-h-[480px] text-[13px] leading-[20px]" bind:value={markup} aria-describedby={describedBy}></textarea>{/snippet}
			</Field>
			<label class="flex items-center gap-2 text-[14px]"><input type="checkbox" class="q-check" name="showInFooter" checked={data.page.showInFooter} /> Show in the site footer</label>
			{#if data.isNew}<input type="hidden" name="navOrder" value="100" />{/if}
		</div>

		<Section title="Preview">
			<div class="max-h-[760px] overflow-y-auto rounded-[14px] border border-q-border bg-[#fff] p-6 text-[#1f382a]">
				<h1 class="mb-4 text-[24px] font-semibold">{title}</h1>
				<PolicyBody {blocks} />
			</div>
		</Section>
	</div>
</form>

{#if data.page.edited && data.page.hasOriginal}
	<form method="POST" action="?/revert" class="mt-8" use:enhance={submitter(toaster)}>
		<button type="submit" class="q-btn q-btn-ghost"><RotateCcw /> Use the original instead</button>
	</form>
{/if}
