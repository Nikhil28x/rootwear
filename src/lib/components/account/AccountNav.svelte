<script lang="ts">
	import { page } from '$app/state';

	/**
	 * The account's own navigation. §03 template 08 fixes what belongs in this
	 * area; §05 fixes /account and /account/pre-orders as the two URLs that
	 * must not move, so they are written here literally rather than built.
	 *
	 * `aria-current="page"` marks the open section, and the rule beside it
	 * marks it again visually — the state is never carried by colour alone.
	 */
	let { email, outstanding = 0 }: { email: string; outstanding?: number } = $props();

	const links = [
		{ href: '/account', label: 'Overview', exact: true },
		{ href: '/account/orders', label: 'Orders', exact: false },
		{ href: '/account/pre-orders', label: 'Pre-orders', exact: false },
		{ href: '/account/addresses', label: 'Addresses', exact: false },
		{ href: '/account/notifications', label: 'Notifications', exact: false }
	];

	let path = $derived(page.url.pathname);

	function isCurrent(href: string, exact: boolean): boolean {
		return exact ? path === href : path === href || path.startsWith(`${href}/`);
	}
</script>

<nav aria-label="Account" class="lg:sticky lg:top-28 lg:self-start">
	<p class="text-[10px] tracking-[0.28em] text-forest/45 uppercase">Signed in</p>
	<p class="mt-2 text-sm break-words text-forest/80">{email}</p>

	<ul class="mt-8 flex list-none flex-col gap-px border-t border-forest/15 p-0">
		{#each links as link (link.href)}
			{@const current = isCurrent(link.href, link.exact)}
			<li class="border-b border-forest/15">
				<a
					href={link.href}
					aria-current={current ? 'page' : undefined}
					class="flex items-center justify-between gap-3 py-4 text-[10px] tracking-[0.2em] uppercase transition-colors {current
						? 'text-forest'
						: 'text-forest/55 hover:text-forest'}"
				>
					<span class="flex items-center gap-3">
						<span
							aria-hidden="true"
							class="inline-block h-px w-4 {current ? 'bg-forest' : 'bg-transparent'}"
						></span>
						{link.label}
					</span>
					{#if link.href === '/account/pre-orders' && outstanding > 0}
						<span class="border border-gold px-1.5 py-0.5 text-[9px] leading-none text-forest">
							{outstanding}
							<span class="sr-only">balance payments outstanding</span>
						</span>
					{/if}
				</a>
			</li>
		{/each}
	</ul>

	<!-- A POST, because signing out changes state. Works with JavaScript off. -->
	<form method="POST" action="/account/logout" class="mt-8">
		<button
			type="submit"
			class="text-[10px] tracking-[0.2em] text-forest/55 uppercase underline-offset-4 transition-colors hover:text-forest hover:underline"
		>
			Sign out
		</button>
	</form>
</nav>
