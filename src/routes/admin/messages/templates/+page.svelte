<script lang="ts">
	import { Mail, MessageCircle } from '@lucide/svelte';
	import Chip from '$lib/components/admin/ui/Chip.svelte';
	import { timeAgo } from '$lib/components/admin/tone';

	let { data } = $props();

	// Pair the email and WhatsApp versions of the same message on one row.
	let groups = $derived.by(() => {
		const map = new Map<string, typeof data.templates>();
		for (const template of data.templates) {
			const list = map.get(template.name) ?? [];
			map.set(template.name, [...list, template]);
		}
		return [...map.entries()].map(([name, templates]) => ({ name, templates }));
	});
</script>

<svelte:head><title>Templates · Messages · Rootwear admin</title></svelte:head>

<div class="q-card q-divide">
	{#each groups as group (group.name)}
		<div class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
			<div class="flex flex-col gap-0.5">
				<p class="text-[14px] font-medium text-q-text">{group.name}</p>
				<p class="text-[13px] text-q-secondary">{group.templates[0].description}</p>
			</div>
			<div class="flex flex-wrap gap-2">
				{#each group.templates as template (template.key)}
					<a
						href="/admin/messages/templates/{template.key}"
						class="q-btn q-btn-secondary q-btn-sm"
						title="Edited {timeAgo(template.updatedAt)}{template.updatedBy
							? ` by ${template.updatedBy}`
							: ''}"
					>
						{#if template.channel === 'email'}<Mail /> Email{:else}<MessageCircle /> WhatsApp{/if}
						{#if !template.active}<Chip label="Off" dot={false} />{/if}
						{#if template.channel === 'whatsapp' && !template.waTemplateName}<Chip
								label="No Meta name"
								tone="warning"
								dot={false}
							/>{/if}
					</a>
				{/each}
			</div>
		</div>
	{/each}
</div>
