<script lang="ts">
	import { page } from '$app/state';

	/** Link tabs: each tab is a URL, so the view survives a refresh and a share. */
	let {
		tabs,
		label
	}: {
		tabs: readonly { href: string; label: string; count?: number | null; exact?: boolean }[];
		label: string;
	} = $props();

	/**
	 * A tab with a query string is a filter of a list: it matches the URL
	 * whole. A tab marked `exact` matches its path only (not sub-pages), and
	 * gives way to a filter tab of the same path that matches — so "All" is
	 * not lit while "Queued" is. Any other tab also matches its sub-pages.
	 */
	function current(tab: { href: string; exact?: boolean }): boolean {
		const path = page.url.pathname;
		if (tab.href.includes('?')) return matchesFilter(tab.href);
		const filterActive = tabs.some(
			(t) => t.href.startsWith(tab.href + '?') && matchesFilter(t.href)
		);
		if (tab.exact) return path === tab.href && !filterActive;
		return (path === tab.href || path.startsWith(tab.href + '/')) && !filterActive;
	}

	/** Same path, and every parameter the tab sets has that value now (others, like a search, may be added). */
	function matchesFilter(href: string): boolean {
		const target = new URL(href, page.url.origin);
		if (target.pathname !== page.url.pathname) return false;
		return [...target.searchParams].every(
			([key, value]) => page.url.searchParams.get(key) === value
		);
	}
</script>

<nav aria-label={label} class="-mx-1 overflow-x-auto">
	<ul class="flex min-w-max gap-1 border-b border-q-border px-1">
		{#each tabs as tab (tab.href)}
			{@const active = current(tab)}
			<li>
				<a
					href={tab.href}
					aria-current={active ? 'page' : undefined}
					class="relative flex h-10 items-center gap-2 px-3 text-[14px] leading-[20px] font-medium transition-colors {active
						? 'text-q-text after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full after:bg-q-text'
						: 'text-q-secondary hover:text-q-text'}"
				>
					{tab.label}
					{#if tab.count !== undefined && tab.count !== null}
						<span
							class="rounded-full bg-q-muted px-1.5 text-[12px] leading-[16px] text-q-secondary tabular-nums"
							>{tab.count}</span
						>
					{/if}
				</a>
			</li>
		{/each}
	</ul>
</nav>
