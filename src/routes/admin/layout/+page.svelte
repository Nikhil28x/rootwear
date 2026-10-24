<script lang="ts">
	import { ExternalLink, FileText, Plus } from '@lucide/svelte';
	import Chip from '$lib/components/admin/ui/Chip.svelte';
	import PageHeader from '$lib/components/admin/ui/PageHeader.svelte';
	import Section from '$lib/components/admin/ui/Section.svelte';
	import { dropNumber, dropState } from '$lib/components/admin/drop-labels';
	import { shortDate, shortDateTime } from '$lib/components/admin/tone';

	let { data } = $props();
</script>

<svelte:head><title>Layout · Rootwear admin</title></svelte:head>

<div class="flex flex-col gap-10">
	<PageHeader
		title="Layout"
		description="Site copy outside the product pages, and which drop sits where."
	>
		{#snippet actions()}<a class="q-btn q-btn-primary" href="/admin/layout/pages/new"
				><Plus /> New page</a
			>{/snippet}
	</PageHeader>

	<Section
		title="Pages"
		description="Shipping, returns, privacy and the rest. Edits go live when published; the original can always be restored."
	>
		<ul class="q-card q-divide">
			{#each data.pages as page (page.slug)}
				<li class="flex items-center justify-between gap-3 p-3 pl-4">
					<div class="flex min-w-0 items-center gap-3">
						<FileText size={20} strokeWidth={1.5} class="flex-none text-q-tertiary" />
						<div class="min-w-0">
							<a
								href="/admin/layout/pages/{page.slug}"
								class="text-[14px] font-medium text-q-text hover:underline">{page.title}</a
							>
							<p class="text-[13px] text-q-secondary">
								/policies/{page.slug}{page.showInFooter ? ' · in the footer' : ''}
							</p>
						</div>
					</div>
					<div class="flex flex-none items-center gap-2">
						{#if !page.published}<Chip label="Draft" tone="warning" />{:else if page.edited}<Chip
								label="Edited {shortDate(page.updatedAt)}"
								tone="accent"
							/>{:else}<Chip label="Original" dot={false} />{/if}
						{#if page.published}<a
								class="q-btn q-btn-ghost q-btn-sm q-btn-icon"
								href="/policies/{page.slug}"
								target="_blank"
								rel="noopener"
								aria-label="View {page.title}"><ExternalLink /></a
							>{/if}
					</div>
				</li>
			{/each}
		</ul>
	</Section>

	<Section
		title="Campaign slots"
		description="A drop that is not published is invisible to the public whatever the layout says, so check before designing around one."
	>
		<div class="q-table-wrap">
			<table class="q-table">
				<thead
					><tr
						><th scope="col">Drop</th><th scope="col">State</th><th scope="col">On the site</th><th
							scope="col">Launch (IST)</th
						><th scope="col"><span class="sr-only">View</span></th></tr
					></thead
				>
				<tbody>
					{#each data.slots as slot (slot.id)}
						{@const st = dropState(slot.state)}
						<tr>
							<td class="font-medium text-q-text">Drop {dropNumber(slot.number)} — {slot.name}</td>
							<td><Chip label={st.label} tone={st.tone} /></td>
							<td
								>{#if slot.published}<Chip label="Published" tone="success" />{:else}<Chip
										label="Hidden"
									/>{/if}</td
							>
							<td class="text-q-secondary">{shortDateTime(slot.launchInstant)}</td>
							<td class="text-right"
								><a class="q-link text-[13px]" href="/drops/{slot.slug}">Open</a></td
							>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</Section>
</div>
