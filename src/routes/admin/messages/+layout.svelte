<script lang="ts">
	import { page } from '$app/state';
	import PageHeader from '$lib/components/admin/ui/PageHeader.svelte';
	import Tabs from '$lib/components/admin/ui/Tabs.svelte';

	let { data, children } = $props();

	// A single template is its own screen with its own heading.
	let isDetail = $derived(page.route.id === '/admin/messages/templates/[key]');
</script>

{#if isDetail}
	{@render children()}
{:else}
	<div class="flex flex-col gap-6">
		<PageHeader
			title="Messages"
			description="Every email and WhatsApp sent to customers and staff, and the templates they are built from."
		/>
		<Tabs
			label="Messages"
			tabs={[
				{ href: '/admin/messages', label: 'All', exact: true },
				{ href: '/admin/messages?status=queued', label: 'Queued', count: data.counts.queued },
				{ href: '/admin/messages?status=problem', label: 'Not sent', count: data.counts.problem },
				{ href: '/admin/messages/templates', label: 'Templates' }
			]}
		/>
		{@render children()}
	</div>
{/if}
