<script lang="ts">
	import '$lib/components/admin/admin.css';
	import { page } from '$app/state';
	import { afterNavigate } from '$app/navigation';
	import { LogOut, Menu, Monitor, Moon, Sun, UserRound, X } from '@lucide/svelte';
	import NavIcon from '$lib/components/admin/NavIcon.svelte';
	import Toaster from '$lib/components/admin/ui/Toaster.svelte';
	import { setToaster } from '$lib/components/admin/toast.svelte';

	/**
	 * The admin shell. A tool, not an editorial page: neutral surfaces, one
	 * accent for action and selection, dense but not cramped.
	 *
	 *   >= 1024px  sidebar with labels (256px)
	 *   640-1023   icon rail (60px), labels as tooltips
	 *   < 640      top bar (56px) with the nav in a slide-out panel
	 *
	 * The nav is FILTERED by permission, and that filtering is a convenience
	 * only: +layout.server.ts and each page's own load refuse the request
	 * outright. Hiding a link has never been access control.
	 */
	let { children, data } = $props();

	const toaster = setToaster();

	let actor = $derived(data.actor);
	let nav = $derived(data.nav);
	let theme = $state<'system' | 'light' | 'dark'>('system');
	let drawerOpen = $state(false);
	let menuOpen = $state(false);

	$effect.pre(() => {
		theme = data.theme;
	});

	afterNavigate(() => {
		drawerOpen = false;
		menuOpen = false;
	});

	function isCurrent(href: string): boolean {
		const path = page.url.pathname;
		if (href === '/admin') return path === '/admin';
		if (href === '/admin/orders') {
			return path.startsWith('/admin/orders') && !path.startsWith('/admin/orders/packing-list');
		}
		return path === href || path.startsWith(href + '/');
	}

	async function chooseTheme(choice: 'system' | 'light' | 'dark') {
		theme = choice;
		const body = new FormData();
		body.set('theme', choice);
		await fetch('/admin/theme', { method: 'POST', body, headers: { accept: 'application/json' } });
	}

	let displayName = $derived(actor?.name || actor?.email || '');
	let initials = $derived(
		displayName
			.split(/[\s@.]+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((part: string) => part[0]?.toUpperCase())
			.join('')
	);
</script>

<div class="admin-theme" data-theme={theme === 'system' ? undefined : theme}>
	{#if !actor}
		{@render children()}
	{:else}
		{#snippet navList(compact: boolean)}
			<nav aria-label="Admin" class="flex flex-col gap-6">
				{#each nav.groups as group, index (index)}
					<div class="flex flex-col gap-1">
						{#if group.label && !compact}
							<p class="px-3 pb-1 text-[12px] leading-[16px] font-medium text-q-tertiary">
								{group.label}
							</p>
						{/if}
						<ul class="flex flex-col gap-0.5">
							{#each group.items as item (item.href)}
								{@const current = isCurrent(item.href)}
								<li>
									<a
										href={item.href}
										title={compact ? item.label : undefined}
										aria-current={current ? 'page' : undefined}
										class="nav-item {compact ? 'justify-center px-0' : 'px-3'} {current
											? 'is-current'
											: ''}"
									>
										<NavIcon name={item.icon} />
										{#if !compact}<span>{item.label}</span>{:else}<span class="sr-only"
												>{item.label}</span
											>{/if}
									</a>
								</li>
							{/each}
						</ul>
					</div>
				{/each}
			</nav>
		{/snippet}

		{#snippet footerList(compact: boolean)}
			<ul class="flex flex-col gap-0.5">
				{#each nav.footer as item (item.href)}
					{@const current = isCurrent(item.href)}
					<li>
						<a
							href={item.href}
							title={compact ? item.label : undefined}
							aria-current={current ? 'page' : undefined}
							class="nav-item {compact ? 'justify-center px-0' : 'px-3'} {current ? 'is-current' : ''}"
						>
							<NavIcon name={item.icon} />
							{#if !compact}<span>{item.label}</span>{:else}<span class="sr-only">{item.label}</span
								>{/if}
						</a>
					</li>
				{/each}
			</ul>
		{/snippet}

		{#snippet brand(compact: boolean)}
			<a
				href="/admin"
				class="flex h-9 items-center gap-2.5 rounded-[10px] {compact ? 'justify-center' : 'px-2'}"
			>
				<span
					class="flex size-7 flex-none items-center justify-center rounded-[8px] bg-q-accent text-[13px] font-semibold text-q-on-accent"
					aria-hidden="true">R</span
				>
				{#if !compact}
					<span class="flex flex-col">
						<span class="text-[14px] leading-[18px] font-semibold text-q-text">Rootwear</span>
						<span class="text-[12px] leading-[14px] text-q-tertiary">Admin</span>
					</span>
				{:else}
					<span class="sr-only">Rootwear admin</span>
				{/if}
			</a>
		{/snippet}

		<div class="flex min-h-svh bg-q-canvas">
			<!-- Sidebar: icon rail from 640px, full from 1024px -->
			<aside
				class="admin-sidebar sticky top-0 hidden h-svh w-[60px] flex-none flex-col border-r border-q-border bg-q-frame sm:flex lg:w-64"
			>
				<div class="flex h-full flex-col gap-6 overflow-y-auto px-2.5 py-4 lg:px-3">
					<div class="hidden lg:block">{@render brand(false)}</div>
					<div class="lg:hidden">{@render brand(true)}</div>
					<div class="flex-1">
						<div class="hidden lg:block">{@render navList(false)}</div>
						<div class="lg:hidden">{@render navList(true)}</div>
					</div>
					<div class="flex flex-col gap-3">
						<div class="hidden lg:block">{@render footerList(false)}</div>
						<div class="lg:hidden">{@render footerList(true)}</div>
						<div class="relative">
							<button
								type="button"
								class="flex w-full items-center gap-2.5 rounded-[10px] p-1.5 text-left hover:bg-q-pressed lg:p-2"
								aria-haspopup="menu"
								aria-expanded={menuOpen}
								onclick={() => (menuOpen = !menuOpen)}
							>
								<span
									class="flex size-8 flex-none items-center justify-center rounded-full bg-q-pressed text-[12px] font-semibold text-q-text"
									aria-hidden="true">{initials}</span
								>
								<span class="hidden min-w-0 flex-col lg:flex">
									<span class="truncate text-[13px] leading-[18px] font-medium text-q-text"
										>{displayName}</span
									>
									<span class="truncate text-[12px] leading-[16px] text-q-tertiary">
										{actor.isOwner ? 'Owner' : 'Staff'}
									</span>
								</span>
								<span class="sr-only lg:hidden">Account menu</span>
							</button>
							{#if menuOpen}
								{@render accountMenu('bottom-full left-0 mb-2')}
							{/if}
						</div>
					</div>
				</div>
			</aside>

			<div class="flex min-w-0 flex-1 flex-col">
				<!-- Top bar, phones only -->
				<header
					class="sticky top-0 z-10 flex h-14 items-center justify-between gap-3 border-b border-q-border bg-q-frame px-4 sm:hidden"
				>
					<button
						type="button"
						class="q-btn q-btn-ghost q-btn-icon -ml-2"
						aria-label="Open navigation"
						onclick={() => (drawerOpen = true)}
					>
						<Menu size={20} strokeWidth={1.5} />
					</button>
					{@render brand(false)}
					<div class="relative">
						<button
							type="button"
							class="flex size-11 items-center justify-center rounded-full"
							aria-label="Account menu"
							aria-haspopup="menu"
							aria-expanded={menuOpen}
							onclick={() => (menuOpen = !menuOpen)}
						>
							<span
								class="flex size-8 items-center justify-center rounded-full bg-q-pressed text-[12px] font-semibold text-q-text"
								>{initials}</span
							>
						</button>
						{#if menuOpen}
							{@render accountMenu('top-full right-0 mt-2')}
						{/if}
					</div>
				</header>

				<main class="admin-main mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
					{#if data.source === 'mock'}
						<div
							class="admin-banner mb-6 rounded-[10px] bg-q-warning-tint px-4 py-3 text-[14px] leading-[20px] text-q-warning-text"
						>
							Temporary storage. No database is connected, so this inbox only holds forms received
							since this server started.
						</div>
					{/if}
					{@render children()}
				</main>
			</div>
		</div>

		<!-- Phone navigation panel -->
		{#if drawerOpen}
			<div class="fixed inset-0 z-40 sm:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
				<button
					type="button"
					class="absolute inset-0 bg-black/30"
					aria-label="Close navigation"
					onclick={() => (drawerOpen = false)}
				></button>
				<div
					class="nav-panel absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col gap-6 overflow-y-auto bg-q-frame px-3 py-4"
				>
					<div class="flex items-center justify-between">
						{@render brand(false)}
						<button
							type="button"
							class="q-btn q-btn-ghost q-btn-icon"
							aria-label="Close navigation"
							onclick={() => (drawerOpen = false)}
						>
							<X size={20} strokeWidth={1.5} />
						</button>
					</div>
					<div class="flex-1">{@render navList(false)}</div>
					{@render footerList(false)}
				</div>
			</div>
		{/if}

		<Toaster {toaster} />
	{/if}
</div>

{#snippet accountMenu(position: string)}
	<div
		class="menu absolute {position} z-50 w-64 rounded-[14px] bg-q-raised p-1.5"
		role="menu"
		tabindex="-1"
		onkeydown={(event) => {
			if (event.key === 'Escape') menuOpen = false;
		}}
	>
		<div class="px-2.5 py-2">
			<p class="truncate text-[14px] font-medium text-q-text">{displayName}</p>
			<p class="truncate text-[12px] text-q-tertiary">{actor?.email}</p>
		</div>
		<div class="my-1 h-px bg-q-border"></div>
		<p class="px-2.5 pt-1.5 pb-1 text-[12px] font-medium text-q-tertiary">Theme</p>
		<div class="grid grid-cols-3 gap-1 px-1 pb-1" role="group" aria-label="Theme">
			{#each [{ id: 'system', label: 'System', icon: Monitor }, { id: 'light', label: 'Light', icon: Sun }, { id: 'dark', label: 'Dark', icon: Moon }] as const as option (option.id)}
				<button
					type="button"
					role="menuitemradio"
					aria-checked={theme === option.id}
					class="flex h-14 flex-col items-center justify-center gap-1 rounded-[10px] text-[12px] {theme ===
					option.id
						? 'bg-q-accent-tint text-q-accent-link'
						: 'text-q-secondary hover:bg-q-muted'}"
					onclick={() => chooseTheme(option.id)}
				>
					<option.icon size={16} strokeWidth={1.5} />
					{option.label}
				</button>
			{/each}
		</div>
		<div class="my-1 h-px bg-q-border"></div>
		<a href="/admin/account" role="menuitem" class="menu-item">
			<UserRound size={16} strokeWidth={1.5} /> Your account
		</a>
		<form method="POST" action="/admin/logout">
			<button type="submit" role="menuitem" class="menu-item w-full">
				<LogOut size={16} strokeWidth={1.5} /> Sign out
			</button>
		</form>
	</div>
{/snippet}

<style>
	.nav-item {
		display: flex;
		align-items: center;
		gap: 10px;
		height: 36px;
		border-radius: 10px;
		font-size: 14px;
		line-height: 20px;
		color: var(--color-q-secondary);
		transition:
			background-color 150ms ease-out,
			color 150ms ease-out;
	}
	.nav-item :global(svg) {
		color: var(--color-q-tertiary);
		flex: none;
	}
	.nav-item:hover {
		background: var(--color-q-pressed);
		color: var(--color-q-text);
	}
	.nav-item.is-current {
		background: var(--color-q-surface);
		color: var(--color-q-text);
		font-weight: 500;
		box-shadow: var(--q-shadow-active);
	}
	.nav-item.is-current :global(svg) {
		color: var(--color-q-text);
	}

	.menu {
		box-shadow: var(--q-shadow-popover);
		animation: menu-in 200ms ease-out;
	}
	.menu-item {
		display: flex;
		align-items: center;
		gap: 10px;
		height: 36px;
		padding: 0 10px;
		border-radius: 10px;
		font-size: 14px;
		color: var(--color-q-body);
	}
	.menu-item:hover {
		background: var(--color-q-muted);
		color: var(--color-q-text);
	}
	.menu-item :global(svg) {
		color: var(--color-q-tertiary);
	}
	.nav-panel {
		animation: panel-in 300ms ease-out;
	}
	@keyframes menu-in {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
	}
	@keyframes panel-in {
		from {
			transform: translateX(-16px);
			opacity: 0;
		}
	}

	/*
	 * Printing. The packing list and invoices are meant to come out of a
	 * printer, so the chrome around them is suppressed, print-only.
	 */
	@media print {
		.admin-sidebar,
		.admin-banner,
		header {
			display: none !important;
		}
		.admin-main {
			padding: 0 !important;
			max-width: none !important;
		}
	}
</style>
