<script lang="ts">
	import SectionHead from '$lib/components/admin/SectionHead.svelte';
	import StatePill from '$lib/components/admin/StatePill.svelte';
	import TableShell from '$lib/components/admin/TableShell.svelte';
	import Notice from '$lib/components/admin/Notice.svelte';
	import { dropTone, humanise, shortDateTime } from '$lib/components/admin/tone';

	let { data } = $props();

	/**
	 * The site map, split by who owns each surface (§12). This is the honest
	 * boundary: layout owns how a page looks and what sits on it; the catalogue
	 * and everything downstream of money stays with the owner.
	 */
	const SURFACES = [
		{
			href: '/',
			title: 'Home',
			owner: 'layout' as const,
			blurb: 'Hero, wordmark treatment, campaign slot, the impact band and the roots section.'
		},
		{
			href: '/know-your-roots',
			title: 'Know your roots',
			owner: 'layout' as const,
			blurb: 'Hemp, why Rootwear, the making. One page, story and craft together.'
		},
		{
			href: '/drops',
			title: 'Drop archive',
			owner: 'layout' as const,
			blurb: 'Layout and cover art. The drops themselves, and their stock, are owner-owned.'
		},
		{
			href: '/policies',
			title: 'Information pages',
			owner: 'layout' as const,
			blurb: 'Shipping, returns, privacy, terms, FAQ, size guide, care, track order — one template, unlimited pages.'
		},
		{
			href: '/contact',
			title: 'Contact page',
			owner: 'layout' as const,
			blurb: 'The page itself. Submissions sent through it are customer records and are owner-only.'
		},
		{
			href: '/drops',
			title: 'Products and stock',
			owner: 'owner' as const,
			blurb: 'Product listings, per-size stock, reservation caps, launch instants, drop state.'
		},
		{
			href: '/admin/orders',
			title: 'Orders and payouts',
			owner: 'owner' as const,
			blurb: 'Orders, reservations, payments, refunds and every customer record.'
		}
	];

	let layoutSurfaces = $derived(SURFACES.filter((s) => s.owner === 'layout'));
	let ownerSurfaces = $derived(SURFACES.filter((s) => s.owner === 'owner'));
</script>

<svelte:head>
	<title>Layout — Rootwear operations</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<SectionHead
	level={1}
	eyebrow="Site"
	title="Layout"
	note="Page layouts, hero and banner design, campaign slots, site copy outside product listings, new pages and navigation."
/>

{#if data.role === 'layout'}
	<div class="mt-8">
		<Notice kind="info">
			This account has layout access. Orders, customer records and payouts are owner-only — those
			screens are not linked here and will refuse the request if reached directly.
		</Notice>
	</div>
{/if}

<!-- CAMPAIGN SLOTS -------------------------------------------------------- -->
<section class="mt-16 flex flex-col gap-6">
	<SectionHead
		eyebrow="Campaign"
		title="Slots"
		note="Which drop occupies which surface. A drop that is not published is invisible to the public whatever the layout says, so check this column before designing around one."
	/>

	<TableShell caption="Campaign slots" captionVisible={false}>
		<thead>
			<tr class="text-[11px] tracking-[0.2em] text-stone-400 uppercase font-medium">
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-left">Drop</th>
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-left">State</th>
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-left">Visible publicly</th>
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-left">Launch (IST)</th>
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-right">Page</th>
			</tr>
		</thead>
		<tbody>
			{#each data.slots as slot (slot.id)}
				<tr class="text-stone-200">
					<th scope="row" class="border-b border-white/5 px-4 py-3 text-left font-normal text-cream">
						Drop {String(slot.number).padStart(2, '0')} — {slot.name}
					</th>
					<td class="border-b border-white/5 px-4 py-3">
						<StatePill label={humanise(slot.state)} tone={dropTone(slot.state)} />
					</td>
					<td class="border-b border-white/5 px-4 py-3">
						<StatePill
							label={slot.published ? 'Published' : 'Hidden'}
							tone={slot.published ? 'outline' : 'quiet'}
						/>
					</td>
					<td class="border-b border-white/5 px-4 py-3 text-[13px] whitespace-nowrap tabular-nums">
						{shortDateTime(slot.launchInstant)}
					</td>
					<td class="border-b border-white/5 px-4 py-3 text-right">
						<a
							class="text-[13px] tracking-[0.16em] text-stone-300 uppercase underline underline-offset-4 hover:text-cream font-medium"
							href="/drops/{slot.slug}"
						>
							Open
						</a>
					</td>
				</tr>
			{:else}
				<tr>
					<td colspan="5" class="px-4 py-10 text-[15px] text-stone-400">No drops to place yet.</td>
				</tr>
			{/each}
		</tbody>
	</TableShell>
</section>

<!-- SURFACES --------------------------------------------------------------- -->
<section class="mt-16 flex flex-col gap-8 border-t border-white/10 pt-10">
	<SectionHead eyebrow="Ownership" title="What layout owns" />

	<ul class="grid gap-px bg-white/10 sm:grid-cols-2">
		{#each layoutSurfaces as surface (surface.title)}
			<li class="flex flex-col gap-3 bg-forest/40 px-5 py-6">
				<a
					class="text-[15px] text-cream underline decoration-white/25 underline-offset-4 hover:decoration-cream"
					href={surface.href}
				>
					{surface.title}
				</a>
				<p class="text-[13px] leading-relaxed text-stone-400">{surface.blurb}</p>
			</li>
		{/each}
	</ul>

	<SectionHead eyebrow="Ownership" title="What stays with the owner" />

	<ul class="grid gap-px bg-white/10 sm:grid-cols-2">
		{#each ownerSurfaces as surface (surface.title)}
			<li class="flex flex-col gap-3 bg-forest/20 px-5 py-6">
				<p class="text-[15px] text-stone-300">{surface.title}</p>
				<p class="text-[13px] leading-relaxed text-stone-400">{surface.blurb}</p>
			</li>
		{/each}
	</ul>

	<p class="max-w-[52rem] text-[13px] leading-relaxed text-stone-400">
		The split is enforced in three places, not one: the row-level policies in the database, the
		guard on this area, and again on every screen inside it. Hiding a link has never been access
		control.
	</p>
</section>
