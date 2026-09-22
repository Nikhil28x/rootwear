<script lang="ts">
	/**
	 * §03 template 05 — the product page. §09 spells out what has to be on it:
	 * gallery, size selector with per-size sold-out state, size chart with the
	 * oversized note, fabric and care as fields, model height and worn size
	 * next to the imagery, dispatch date, pre-order state, the returns line by
	 * the size selector, and cross-sell within the drop.
	 *
	 * Add-to-cart posts to the cart route's own form action. The price is NOT
	 * in the post — §04: "never accept a price from the client"; the cart
	 * re-resolves it from the catalogue on every read.
	 */
	import SizeSelector from '$lib/components/drop/SizeSelector.svelte';
	import SizeChart from '$lib/components/drop/SizeChart.svelte';
	import NotifyMeForm from '$lib/components/drop/NotifyMeForm.svelte';
	import RequestDropForm from '$lib/components/drop/RequestDropForm.svelte';
	import DropStateMark from '$lib/components/drop/DropStateMark.svelte';
	import Eyebrow from '$lib/components/ui/Eyebrow.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Accordion from '$lib/components/ui/Accordion.svelte';
	import HempMotif from '$lib/components/art/HempMotif.svelte';
	import { formatInr } from '$lib/money';
	import { RETURNS_WORDING } from '$lib/content/returns';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let price = $derived(formatInr(data.displayPrice));
	let dropNumber = $derived(String(data.drop.number).padStart(2, '0'));

	const launchDate = new Intl.DateTimeFormat('en-IN', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		timeZone: 'Asia/Kolkata'
	});

	let lead = $derived(
		data.product.images.find((image) => image.role === 'lead') ?? data.product.images[0] ?? null
	);
	let rest = $derived(data.product.images.filter((image) => image !== lead));

	let everythingGone = $derived(data.offers.every((offer) => offer.soldOut));

	/**
	 * §06 — "Notify-me sits on every sold-out piece and size." While the drop is
	 * on sale only the gone sizes take one; while it is not on sale — revealed,
	 * sold out, archived — every size does, because none can be bought today.
	 */
	let notifyOffers = $derived(
		data.notifyOpen && !data.onSale ? data.offers : data.offers.filter((offer) => offer.soldOut)
	);

	/** §09 — fields, never prose. The invoice reads the same columns. */
	let specifications = $derived([
		['Fibre', data.product.fabric],
		['Weight', `${data.product.gsm} GSM`],
		['Fit', data.product.fit],
		['Edition', `${data.drop.editionSize} numbered pieces`],
		['SKU', data.offers[0]?.sku.replace(/-[A-Z]{1,2}$/, '') ?? '']
	]);
</script>

<svelte:head>
	<title>{data.product.name} — Drop {dropNumber} | Rootwear</title>
	<meta name="description" content={data.product.summary} />
</svelte:head>

<main class="mx-auto max-w-[1600px] px-5 py-24 sm:px-10 sm:py-32 lg:px-14">
	<nav
		class="mb-12 flex flex-wrap items-center gap-3 text-[10px] tracking-[0.2em] uppercase"
		aria-label="Breadcrumb"
	>
		<a class="text-stone-500 transition hover:text-stone-100" href="/drops">Drops</a>
		<span class="text-stone-600" aria-hidden="true">/</span>
		<a class="text-stone-500 transition hover:text-stone-100" href="/drops/{data.drop.slug}">
			Drop {dropNumber} — {data.drop.name}
		</a>
	</nav>

	<div class="grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-20">
		<!-- §09 gallery: a lead shot, detail shots including a fabric close-up,
		     and a worn shot. Every one of them is a role on the record. -->
		<div class="flex flex-col gap-4">
			{#if lead}
				<figure class="m-0 flex flex-col gap-3">
					<div class="aspect-[4/5] w-full overflow-hidden bg-white/5">
						<img
							class="size-full object-cover object-center"
							src={lead.url}
							alt={lead.alt}
							loading="eager"
							decoding="async"
						/>
					</div>
					<figcaption class="text-[10px] tracking-[0.2em] text-stone-500 uppercase">
						The model is {data.product.modelHeightCm} cm and wears a {data.product.modelWornSize}.
					</figcaption>
				</figure>
			{/if}

			{#if rest.length > 0}
				<ul class="grid grid-cols-3 gap-4">
					{#each rest as image (image.url)}
						<li class="aspect-[4/5] overflow-hidden bg-white/5">
							<img
								class="size-full object-cover object-center"
								src={image.url}
								alt={image.alt}
								loading="lazy"
								decoding="async"
							/>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<div class="flex flex-col gap-8">
			<div class="flex flex-wrap items-center gap-4">
				<Eyebrow>Drop {dropNumber}</Eyebrow>
				<DropStateMark state={data.drop.state} />
			</div>

			<h1 class="display text-[clamp(2.5rem,5vw,4.5rem)] leading-[0.88] tracking-[-0.045em]">
				{data.product.name}
			</h1>

			<p class="max-w-prose text-sm leading-relaxed text-stone-400">{data.product.summary}</p>

			<div class="flex items-baseline justify-between gap-4 border-y border-white/15 py-4">
				<span class="text-[10px] tracking-[0.2em] text-stone-500 uppercase">
					{data.showPrelaunchPrice ? 'Pre-launch price' : 'Price'}
				</span>
				<strong class="text-lg font-normal tracking-[0.04em] text-stone-100">{price}</strong>
			</div>
			<!-- §10: displayed prices are inclusive of GST. -->
			<p class="-mt-4 text-[10px] tracking-[0.2em] text-stone-500 uppercase">
				Inclusive of all taxes · India only
			</p>

			{#if data.isPreOrder}
				<!-- §08: the hand number is allocated ON PAYMENT CONFIRMATION, never
				     before. The dispatch note states the drop instant and nothing it
				     cannot stand behind. -->
				<div class="border-l-2 border-strain pl-4">
					<p class="text-[10px] tracking-[0.28em] text-strain uppercase">Pre-order</p>
					<p class="mt-2 text-sm leading-relaxed text-stone-400">
						This piece is made for the drop. Dispatch follows the drop opening on
						{launchDate.format(data.launchInstant)}, and your hand number is allocated when your
						payment confirms.
					</p>
				</div>
			{/if}

			{#if everythingGone}
				<p
					class="border-l-2 border-white/25 pl-4 text-[10px] tracking-[0.28em] text-stone-400 uppercase"
				>
					Every size gone — notify-me is open below
				</p>
			{/if}

			{#if data.onSale}
				<!-- The cart route owns this action; the page only names the variant. -->
				<form method="POST" action="/cart?/add" class="flex flex-col gap-6">
					<input type="hidden" name="dropSlug" value={data.drop.slug} />
					<input type="hidden" name="productSlug" value={data.product.slug} />
					<input type="hidden" name="quantity" value="1" />

					<SizeSelector offers={data.offers} idPrefix="pdp" />

					<Button type="submit" variant="solid" full disabled={everythingGone}>
						{data.isPreOrder ? 'Reserve this piece' : 'Add to cart'}
					</Button>
				</form>
			{:else}
				<!-- Not on sale: the sizes still show, greyed, because §06 says the
				     scarcity is the point and nothing is ever hidden. -->
				<SizeSelector offers={data.offers} selectable={false} idPrefix="pdp" />
			{/if}

			<div class="flex flex-col">
				<Accordion title="Size guide" surface="dark">
					<SizeChart
						modelHeightCm={data.product.modelHeightCm}
						modelWornSize={data.product.modelWornSize}
						surface="dark"
					/>
				</Accordion>

				<Accordion title="Fabric and specification" surface="dark">
					<dl class="m-0">
						{#each specifications as specification (specification[0])}
							<div
								class="flex justify-between gap-4 border-b border-white/10 py-3 text-[10px] tracking-[0.18em] uppercase"
							>
								<dt class="text-stone-300">{specification[0]}</dt>
								<dd class="m-0 text-stone-500">{specification[1]}</dd>
							</div>
						{/each}
					</dl>
				</Accordion>

				<Accordion title="Care" surface="dark">
					<ul class="flex flex-col gap-2">
						{#each data.product.care as instruction (instruction)}
							<li>{instruction}</li>
						{/each}
					</ul>
				</Accordion>

				<Accordion title="Returns" surface="dark">
					<!-- §11: the same wording as checkout, the confirmation email and the
					     policy page. Imported from one module, never retyped. -->
					<p>{RETURNS_WORDING}</p>
				</Accordion>
			</div>
		</div>
	</div>

	{#if notifyOffers.length > 0}
		<section class="relative mt-28 border-t border-white/12 pt-12" aria-labelledby="notify-title">
			<div class="pointer-events-none absolute inset-x-0 top-0 h-80 text-cream" aria-hidden="true">
				<HempMotif opacity={0.04} seed={5} />
			</div>

			<div class="relative flex flex-col gap-3">
				<h2 id="notify-title" class="text-[10px] tracking-[0.28em] text-stone-400 uppercase">
					Notify me
				</h2>
				<p class="max-w-lg text-sm leading-relaxed text-stone-400">
					Every size keeps its own list. One message, for the size you pick, when it is available —
					and nothing else.
				</p>
			</div>

			<div class="relative mt-8 max-w-2xl">
				{#each notifyOffers as offer (offer.variantId)}
					<NotifyMeForm
						dropSlug={data.drop.slug}
						variantId={offer.variantId}
						size={offer.size}
						{form}
						source="product_page"
					/>
				{/each}
			</div>
		</section>
	{/if}

	{#if data.canRequest}
		<section class="mt-28 border-t border-white/12 pt-12" aria-labelledby="request-title">
			<h2 id="request-title" class="mb-8 text-[10px] tracking-[0.28em] text-stone-400 uppercase">
				Bring it back
			</h2>
			<div class="max-w-3xl">
				<RequestDropForm
					dropSlug={data.drop.slug}
					dropName={data.drop.name}
					sizeOptions={data.sizeOptions}
					{form}
					source="product_page"
					heading="Tell us the size you missed"
				/>
			</div>
		</section>
	{/if}

	{#if data.alsoInDrop.length > 0}
		<section class="mt-28 border-t border-white/12 pt-12" aria-labelledby="also-title">
			<h2 id="also-title" class="mb-8 text-[10px] tracking-[0.28em] text-stone-400 uppercase">
				Also in Drop {dropNumber}
			</h2>

			<ul class="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
				{#each data.alsoInDrop as item (item.slug)}
					<li class="group flex flex-col gap-4">
						<a class="flex flex-col gap-4" href="/drops/{data.drop.slug}/{item.slug}">
							<div class="aspect-[4/5] w-full overflow-hidden bg-white/5">
								{#if item.image}
									<img
										class="size-full object-cover object-center transition duration-700 ease-out group-hover:scale-[1.035] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
										src={item.image.url}
										alt={item.image.alt}
										loading="lazy"
										decoding="async"
									/>
								{/if}
							</div>
							<div class="flex items-baseline justify-between gap-4">
								<span class="text-sm text-stone-100">{item.name}</span>
								<span class="text-[10px] tracking-[0.2em] text-stone-500 uppercase">
									{formatInr(item.price)}
								</span>
							</div>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</main>
