<script lang="ts">
	import PageHeader from '$lib/components/admin/ui/PageHeader.svelte';
	import Tabs from '$lib/components/admin/ui/Tabs.svelte';

	let { data, children } = $props();
</script>

<div class="flex flex-col gap-6">
	<PageHeader title="Settings" />
	<Tabs label="Settings" tabs={data.settingsTabs} />
	{@render children()}
</div>
