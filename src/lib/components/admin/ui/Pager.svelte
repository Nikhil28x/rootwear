<script lang="ts">
	import { page as appPage } from '$app/state';
	import { ChevronLeft, ChevronRight } from '@lucide/svelte';

	/** Previous / next over a server-paged list. Keeps every other query param. */
	let {
		page,
		pageSize,
		total,
		param = 'page'
	}: { page: number; pageSize: number; total: number; param?: string } = $props();

	let pages = $derived(Math.max(1, Math.ceil(total / pageSize)));
	let first = $derived(total === 0 ? 0 : (page - 1) * pageSize + 1);
	let last = $derived(Math.min(total, page * pageSize));

	function href(target: number): string {
		const url = new URL(appPage.url);
		if (target <= 1) url.searchParams.delete(param);
		else url.searchParams.set(param, String(target));
		return url.pathname + url.search;
	}
</script>

{#if total > pageSize}
	<nav class="flex items-center justify-between gap-4" aria-label="Pages">
		<p class="text-[13px] text-q-secondary tabular-nums">{first}–{last} of {total}</p>
		<div class="flex items-center gap-2">
			{#if page > 1}
				<a class="q-btn q-btn-secondary q-btn-sm" href={href(page - 1)}>
					<ChevronLeft size={16} strokeWidth={1.5} /> Previous
				</a>
			{/if}
			{#if page < pages}
				<a class="q-btn q-btn-secondary q-btn-sm" href={href(page + 1)}>
					Next <ChevronRight size={16} strokeWidth={1.5} />
				</a>
			{/if}
		</div>
	</nav>
{/if}
