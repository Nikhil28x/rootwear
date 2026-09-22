<script lang="ts">
	import { page } from '$app/state';

	/**
	 * The admin chrome. Denser than the storefront — it is a tool, not an
	 * editorial page — but on the same tokens, the same type scale and the same
	 * square edges.
	 *
	 * The nav is FILTERED by role, and that filtering is a convenience only:
	 * +layout.server.ts and each page's own load refuse the request outright
	 * (§12). Hiding a link has never been access control.
	 */
	let { children, data } = $props();

	let actor = $derived(data.actor);
	let nav = $derived(data.nav ?? []);

	function isCurrent(href: string): boolean {
		const path = page.url.pathname;
		return href === '/admin' ? path === '/admin' : path.startsWith(href);
	}
</script>

{#if !actor}
	{@render children()}
{:else}
	<div class="admin-shell min-h-svh bg-forest-black text-stone-200">
		<div class="mx-auto max-w-[1600px] px-5 py-10 sm:px-10 lg:px-14">
			<div class="flex flex-col gap-10 lg:flex-row lg:gap-14">
				<!-- Sidebar -->
				<aside class="admin-sidebar lg:w-56 lg:shrink-0">
					<div class="flex flex-col gap-8 lg:sticky lg:top-24">
						<div class="flex flex-col gap-2 border-b border-white/10 pb-6">
							<p class="wordmark text-[15px] tracking-[0.22em] text-cream uppercase font-medium">Rootwear</p>
							<p class="text-[11px] tracking-[0.28em] text-stone-400 uppercase font-medium">Operations</p>
						</div>

						<nav aria-label="Admin sections">
							<ul class="flex flex-col">
								{#each nav as item (item.href)}
									<li>
										<a
											href={item.href}
											aria-current={isCurrent(item.href) ? 'page' : undefined}
											class="flex flex-col gap-1 border-l-2 py-3 pl-4 transition-colors {isCurrent(
												item.href
											)
												? 'border-l-cream text-cream'
												: 'border-l-white/10 text-stone-400 hover:border-l-gold hover:text-stone-100'}"
										>
											<span class="text-[12px] tracking-[0.2em] uppercase font-medium">{item.label}</span>
											<span class="text-[12px] leading-snug text-stone-400">{item.blurb}</span>
										</a>
									</li>
								{/each}
							</ul>
						</nav>

						<div class="flex flex-col gap-3 border-t border-white/10 pt-6">
							<p class="text-[11px] tracking-[0.24em] text-stone-400 uppercase font-medium">Signed in</p>
							<p class="text-[13px] break-words text-stone-300">{actor.email}</p>
							<p class="text-[11px] tracking-[0.2em] text-gold uppercase font-medium">{actor.role}</p>
							{#if actor.role === 'layout'}
								<p class="text-[12px] leading-snug text-stone-400">
									Layout access only. Orders, customer records and payouts are owner-only.
								</p>
							{/if}
							<form method="POST" action="/admin/logout">
								<button
									type="submit"
									class="mt-1 w-full border border-white/25 px-4 py-3 text-[11px] tracking-[0.2em] text-stone-300 uppercase transition hover:bg-white hover:text-black font-medium"
								>
									Sign out
								</button>
							</form>
						</div>
					</div>
				</aside>

				<!-- Content -->
				<main class="min-w-0 flex-1">
					{#if actor.preview}
						<p
							class="admin-banner mb-8 border-l-2 border-gold px-4 py-3 text-[13px] leading-relaxed text-gold"
						>
							Fixture preview. No database is connected, every figure below is generated
							from the drop fixtures, and edits last only until the dev server restarts.
						</p>
					{:else if data.source === 'mock'}
						<p class="admin-banner mb-8 border-l-2 border-gold px-4 py-3 text-[13px] leading-relaxed text-gold">
							Reading the fixture catalogue. Set CATALOGUE_SOURCE=supabase to read live data.
						</p>
					{/if}

					{@render children()}
				</main>
			</div>
		</div>
	</div>
{/if}

<style>
	/**
	 * Visible focus for the admin's own form controls.
	 *
	 * layout.css gives :focus-visible an outline to `button` and `a` only, and
	 * the dense table inputs on these screens set `outline-none` so the resting
	 * state stays a quiet underline. That left a keyboard user with nothing but
	 * a 1px border tint to locate the caret by. The outline is restored here,
	 * for the admin shell only, so it cannot affect the storefront.
	 *
	 * Unlayered, so it beats the Tailwind `outline-none` utility in @layer
	 * utilities without needing !important.
	 */
	/**
	 * Printing. The packing list (§11) is meant to come out of a printer and go
	 * in a parcel, and its own component styles cannot reach the chrome around
	 * it: `.no-print` there is Svelte-scoped, so it could not hide this
	 * sidebar, nor the storefront header and footer the root layout renders on
	 * every non-home route. Those are suppressed here, print-only, so a packing
	 * sheet is the packing sheet and nothing else.
	 */
	@media print {
		:global(header),
		:global(footer) {
			display: none;
		}

		.admin-sidebar,
		.admin-banner {
			display: none;
		}

		.admin-shell {
			background: white;
			min-height: 0;
		}
	}

	.admin-shell :global(input:focus-visible),
	.admin-shell :global(select:focus-visible),
	.admin-shell :global(textarea:focus-visible) {
		outline: 1px solid var(--color-gold);
		outline-offset: 2px;
	}
</style>
