<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { Archive, ExternalLink, Rocket, Undo2 } from '@lucide/svelte';
	import Chip from '$lib/components/admin/ui/Chip.svelte';
	import PageHeader from '$lib/components/admin/ui/PageHeader.svelte';
	import Tabs from '$lib/components/admin/ui/Tabs.svelte';
	import { submitter } from '$lib/components/admin/enhance';
	import { getToaster } from '$lib/components/admin/toast.svelte';
	import { PRODUCT_STATUS, dropNumber } from '$lib/components/admin/drop-labels';

	let { data, children } = $props();
	const toaster = getToaster();

	let product = $derived(data.product);
	let base = $derived(`/admin/drops/${data.drop.slug}/products/${product.id}`);
	let status = $derived(PRODUCT_STATUS[product.status]);
</script>

<div class="flex flex-col gap-6">
	<PageHeader
		title={product.name}
		back={{ href: `/admin/drops/${data.drop.slug}`, label: `Drop ${dropNumber(data.drop.number)} — ${data.drop.name}` }}
	>
		{#snippet meta()}<Chip label={status.label} tone={status.tone} />{/snippet}
		{#snippet actions()}
			{#if data.drop.published && product.status === 'active'}
				<a class="q-btn q-btn-secondary" href="/drops/{data.drop.slug}/{product.slug}" target="_blank" rel="noopener"><ExternalLink /> View on site</a>
			{/if}
			{#if data.canEdit}
				<form method="POST" action="{base}?/status" use:enhance={submitter(toaster)} class="flex gap-2">
					{#if product.status === 'draft'}
						<button type="submit" name="status" value="active" class="q-btn q-btn-primary"><Rocket /> Make live</button>
					{:else if product.status === 'active'}
						<button type="submit" name="status" value="draft" class="q-btn q-btn-secondary"><Undo2 /> Back to draft</button>
						<button type="submit" name="status" value="archived" class="q-btn q-btn-ghost"><Archive /> Archive</button>
					{:else}
						<button type="submit" name="status" value="active" class="q-btn q-btn-secondary"><Rocket /> Make live again</button>
					{/if}
				</form>
			{/if}
		{/snippet}
	</PageHeader>

	<Tabs
		label="Product"
		tabs={[
			{ href: base, label: 'Details', exact: true },
			{ href: `${base}/stock`, label: 'Stock', count: product.totals.stock },
			{ href: `${base}/photos`, label: 'Photos', count: product.images.length }
		]}
	/>

	{#if page.url.pathname === base && page.url.searchParams.has('created')}
		<div class="rounded-[10px] bg-q-success-tint px-4 py-3 text-[14px] text-q-success-text">
			Draft saved with {product.variants.length} size{product.variants.length === 1 ? '' : 's'}. Next: set stock, then add photos.
		</div>
	{/if}

	{@render children()}
</div>
