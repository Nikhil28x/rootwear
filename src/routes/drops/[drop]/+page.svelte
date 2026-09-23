<script lang="ts">
	/**
	 * §03 templates 03 AND 04 — the drop page, and the same page once the drop
	 * is finished. §05: "The same URL survives the drop's whole life — live,
	 * sold out, archived. Never redirect it."
	 *
	 * So there is one page here and the STATE decides what it offers:
	 *   TEASE / REVEALED  countdown, story, deposit language, notify-me
	 *   LIVE / PARTIAL    pieces on sale, sold-out sizes greyed and still there
	 *   SOLD_OUT/ARCHIVED lookbook and story intact, notify-me on every size,
	 *                     and the §12 "ask for this drop again" form
	 *
	 * The imagery is read from the product record rather than listed here. The
	 * page previously hardcoded four /images/pineapple-haze-*.jpg paths, which
	 * is exactly what stops one template serving a second drop.
	 */
	import DropCountdown from '$lib/DropCountdown.svelte';
	import PreOrderForm from '$lib/components/drop/PreOrderForm.svelte';
	import PosterShowcase from '$lib/components/drop/PosterShowcase.svelte';
	import DropStateMark from '$lib/components/drop/DropStateMark.svelte';
	import SizeSelector from '$lib/components/drop/SizeSelector.svelte';
	import SizeChart from '$lib/components/drop/SizeChart.svelte';
	import NotifyMeForm from '$lib/components/drop/NotifyMeForm.svelte';
	import RequestDropForm from '$lib/components/drop/RequestDropForm.svelte';
	import Eyebrow from '$lib/components/ui/Eyebrow.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Accordion from '$lib/components/ui/Accordion.svelte';
	import PineappleField from '$lib/components/art/PineappleField.svelte';
	import HempMotif from '$lib/components/art/HempMotif.svelte';
	import { formatInr } from '$lib/money';
	import { SIZE_RANGE_LABEL } from '$lib/drop/sizes';
	import { RETURNS_WORDING } from '$lib/content/returns';
	import { DROP_STATE_DESCRIPTION } from '$lib/domain/drop-state';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	/** RW-032 — every price is read from the record and formatted at the render
	    edge. No page holds its own price string. */
	let price = $derived(formatInr(data.displayPrice));

	/**
	 * A PREVIEW toggle, not a customer setting.
	 *
	 * The drop can be presented two ways — priced, with the normal cart and
	 * checkout behind it, or open for pre-order, where nothing is charged and
	 * we take a name, email, phone and size instead. Both are real behaviours;
	 * this switches which one the page is showing so the difference can be
	 * seen side by side rather than described.
	 *
	 * Client-side only: it changes nothing on the server, and the pre-order
	 * form posts to a real action either way.
	 */
	type DropView = 'price' | 'preorder';
	let view = $state<DropView>('price');

	let dropNumber = $derived(String(data.drop.number).padStart(2, '0'));

	const released = new Intl.DateTimeFormat('en-IN', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		timeZone: 'Asia/Kolkata'
	});
	let releasedAt = $derived(data.drop.archivedAt ?? data.drop.launchInstant);

	const ROLE_LABEL: Record<string, string> = {
		lead: 'Lead',
		detail: 'Detail',
		fabric: 'Fabric',
		worn: 'Worn'
	};

	/** Every image across every piece, so the lookbook survives the drop (§03/04). */
	let lookbook = $derived(
		data.pieces.flatMap((piece) =>
			piece.images.map((image) => ({
				...image,
				piece: piece.name,
				key: `${piece.slug}-${image.url}`
			}))
		)
	);

	let everyOffer = $derived(
		data.pieces.flatMap((piece) =>
			piece.offers.map((offer) => ({ ...offer, pieceName: piece.name }))
		)
	);

	/**
	 * §06 — "Notify-me sits on every sold-out piece and size."
	 *
	 * Two readings of that, and both are true. While the drop is on sale, only
	 * the sizes that have GONE take a notify-me; the rest take a cart. While it
	 * is not on sale — revealed, sold out, archived — the drop's own state opens
	 * notify-me on every size, because none of them can be bought today.
	 */
	let notifyOffers = $derived(
		data.notifyOpen && !data.onSale ? everyOffer : everyOffer.filter((offer) => offer.soldOut)
	);

	/** §09 — fields on the record, so spec table, size guide and invoice agree. */
	let specifications = $derived([
		['Fibre', data.product.fabric],
		['Weight', `${data.product.gsm} GSM`],
		['Fit', data.product.fit],
		['Edition', `${data.editionSize} numbered pieces`],
		['Sizes', SIZE_RANGE_LABEL]
	]);

	/** §12 — what the board already says, shown only where it is non-zero. */
	let requestedTotal = $derived(data.demandRows.reduce((sum, row) => sum + row.requests, 0));
</script>

<svelte:head>
	<title>Drop {dropNumber} — {data.drop.name} | Rootwear</title>
	<meta name="description" content={data.drop.story} />
</svelte:head>

<main class="relative isolate overflow-x-clip">
	<PineappleField />
	{#if data.showCountdown}
		<!-- The countdown carries this page's h1. Everything below is an h2. -->
		<DropCountdown stage={data.stage} />
	{/if}

	<div class="mx-auto max-w-[1600px] px-5 py-24 sm:px-10 sm:py-32 lg:px-14">
		<header class="relative mb-20 overflow-hidden">
			<!--
				A root system squashed into a short, wide box collapsed into a thin
				branching line that read as a stray glyph behind the title. This is
				aspect-locked to the motif's own viewBox so it stays a pineapple.
			-->

			<div class="relative flex flex-wrap items-center gap-4">
				<Eyebrow>Drop {dropNumber}</Eyebrow>
				<DropStateMark state={data.drop.state} surface="light"/>
				<span class="text-[11px] tracking-[0.2em] text-forest/75 uppercase font-medium">
					<time datetime={new Date(releasedAt).toISOString()}>{released.format(releasedAt)}</time>
				</span>
			</div>

			<div class="relative mt-8 grid gap-10 lg:grid-cols-[1.4fr_0.6fr] lg:gap-20">
				{#if data.showCountdown}
					<h2
						id="collection-title"
						class="display text-[clamp(3rem,8vw,8rem)] leading-[0.82] tracking-[-0.055em]"
					>
						{data.drop.name}
					</h2>
				{:else}
					<h1
						id="collection-title"
						class="display text-[clamp(3rem,8vw,8rem)] leading-[0.82] tracking-[-0.055em]"
					>
						{data.drop.name}
					</h1>
				{/if}

				<div class="flex flex-col justify-end gap-6">
					<p class="max-w-prose text-[15px] leading-relaxed text-forest/80">{data.drop.story}</p>
					<p class="text-[13px] leading-relaxed text-forest/75">
						{DROP_STATE_DESCRIPTION[data.drop.state]}
					</p>

					<!-- Preview toggle: priced, or open for pre-order. -->
					<div class="flex flex-col gap-3 border-t border-forest/18 pt-4">
						<div
							class="flex items-center gap-2 text-[11px] font-medium tracking-[0.2em] uppercase"
							role="group"
							aria-label="Preview this drop as"
						>
							<span class="mr-1 text-forest/60">Preview</span>
							{#each [{ id: 'price', label: 'Price' }, { id: 'preorder', label: 'Pre-order' }] as option (option.id)}
								<button
									type="button"
									class="border px-3 py-2 transition {view === option.id
										? 'border-forest bg-forest text-paper'
										: 'border-forest/25 text-forest/75 hover:border-forest/60 hover:text-forest'}"
									aria-pressed={view === option.id}
									onclick={() => (view = option.id as DropView)}
								>
									{option.label}
								</button>
							{/each}
						</div>

						<div
							class="flex items-baseline justify-between gap-4 pt-1 text-[11px] font-medium tracking-[0.2em] uppercase"
						>
							<span class="text-forest/75">{data.product.name}</span>
							{#if view === 'price'}
								<strong class="font-normal text-forest">{price}</strong>
							{:else}
								<strong class="font-normal text-strain-ink">Open for pre-order</strong>
							{/if}
						</div>
					</div>

					{#if view === 'price' && data.showPrelaunchPrice}
						<p class="text-[11px] tracking-[0.2em] text-forest/75 uppercase font-medium">
							Pre-launch price, locked for anyone who reserves now.
						</p>
					{/if}

					{#if view === 'price' && data.acceptsDeposits}
						<!-- §08: a deposit. The percentage is an unanswered open item and
						     is deliberately not printed here. -->
						<p class="border-l-2 border-strain-ink pl-4 text-[13px] leading-relaxed text-forest/75">
							Reserve now with a deposit. The balance is settled before your piece is dispatched,
							and your hand number is allocated when payment confirms — never before.
						</p>
						<p class="text-[11px] tracking-[0.2em] text-forest/75 uppercase font-medium">
							<span class="text-strain-ink tabular-nums">{data.claimed}</span>
							of {data.editionSize} claimed
						</p>
					{/if}
					{#if view === 'preorder'}
						<PreOrderForm
							dropSlug={data.drop.slug}
							sizeOptions={data.sizeOptions}
							surface="light"
							{form}
						/>
					{/if}
				</div>
			</div>
		</header>

		<!--
			FIRST, deliberately. This is the only section anyone can buy from, and
			it used to sit below the poster and the lookbook — so the size selector
			and the add-to-cart were two screens down on a page whose job is to sell
			twenty-five pieces. The story now follows the purchase rather than
			guarding it.
		-->

		<!-- The pieces. §06: sold-out sizes are greyed and still visible here too. -->
		<section
			class="relative mb-24 overflow-hidden"
			aria-labelledby="pieces-title"
		>

			<h2 id="pieces-title" class="mb-10 text-[11px] tracking-[0.28em] text-forest/75 uppercase font-medium">
				{data.pieces.length === 1 ? 'The piece' : 'The pieces'}
			</h2>

			<ul class="flex flex-col gap-16">
				{#each data.pieces as piece (piece.slug)}
					<li class="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
						<a
							class="group block overflow-hidden bg-forest/[0.04]"
							href="/drops/{data.drop.slug}/{piece.slug}"
						>
							{#if piece.lead}
								<img
									class="aspect-[4/5] w-full object-cover object-center transition duration-700 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
									src={piece.lead.url}
									alt={piece.lead.alt}
									loading="lazy"
									decoding="async"
								/>
							{/if}
						</a>

						<div class="flex flex-col gap-6">
							<div class="flex flex-wrap items-baseline justify-between gap-4">
								<h3 class="display text-3xl leading-none tracking-[-0.03em]">{piece.name}</h3>
								<!-- Follows the preview toggle, or the page would offer a piece
								     for pre-order and quote its price in the same breath. -->
								<strong
									class="text-[11px] font-normal tracking-[0.2em] uppercase {view === 'price'
										? 'text-forest'
										: 'text-strain-ink'}"
								>
									{view === 'price' ? formatInr(piece.price) : 'Open for pre-order'}
								</strong>
							</div>

							<p class="max-w-prose text-[15px] leading-relaxed text-forest/75">{piece.summary}</p>

							{#if piece.allSoldOut}
								<p
									class="border-l-2 border-forest/25 pl-4 text-[11px] tracking-[0.28em] text-forest/75 uppercase font-medium"
								>
									Every size gone
								</p>
							{/if}

							<!-- Availability, not a control: the choice is made on the piece
							     page where the fit note and the size guide sit beside it. -->
							<SizeSelector
								offers={piece.offers}
								selectable={false}
								idPrefix="drop-{piece.slug}"
								name="preview-{piece.slug}"
							surface="light"/>

							<div class="flex flex-wrap gap-4">
								<Button href="/drops/{data.drop.slug}/{piece.slug}" variant="solid" surface="light">
									{data.onSale ? 'Choose a size' : 'View the piece'}
								</Button>
							</div>
						</div>
					</li>
				{/each}
			</ul>
		</section>

		<!--
			The drop poster with the piece turning in front of it. Marked as a dark
			section so the header re-inks over it — the rest of this page is white.
		-->
		<!--
			Full-bleed: the negative margins cancel the container's padding so the
			poster's green runs to the edges instead of the panel sitting as an
			isolated card on white. Dark ground, so the header re-inks over it.
		-->
		<section
			class="-mx-5 mb-24 bg-poster px-5 text-paper sm:-mx-10 sm:px-10 lg:-mx-14 lg:px-14"
			data-header-theme="dark"
			aria-labelledby="showcase-title"
		>
			<div class="grid items-stretch gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
			<div class="order-2 flex flex-col justify-center gap-6 py-16 sm:py-20 lg:order-1">
				<Eyebrow surface="dark">The piece</Eyebrow>
				<h2
					id="showcase-title"
					class="display text-[clamp(2.2rem,4.5vw,3.6rem)] leading-[0.92] tracking-[-0.04em]"
				>
					Grown, not<br />manufactured.
				</h2>
				<p class="max-w-[46ch] text-[15px] leading-relaxed text-paper/75">
					{data.product.fabric} at {data.product.gsm} GSM, cut {data.product.fit.toLowerCase()}.
					Turn it over and the tree sits across the back.
				</p>
				<dl class="grid max-w-md grid-cols-2 gap-x-8 gap-y-4 border-t border-white/20 pt-6">
					{#each [['Fibre', data.product.fabric], ['Weight', `${data.product.gsm} GSM`], ['Fit', data.product.fit], ['Edition', `${data.editionSize} numbered`]] as [term, value] (term)}
						<div class="flex flex-col gap-1">
							<dt class="text-[11px] font-medium tracking-[0.2em] text-paper/60 uppercase">
								{term}
							</dt>
							<dd class="text-[15px] text-paper/85">{value}</dd>
						</div>
					{/each}
				</dl>
			</div>

				<div class="order-1 mx-auto w-full max-w-[34rem] lg:order-2 lg:mx-0 lg:max-w-none">
					<PosterShowcase />
				</div>
			</div>
		</section>

		<!-- §03 template 04: the lookbook stays intact once the drop is finished. -->
		<section class="relative mb-24 overflow-hidden" aria-labelledby="lookbook-title">

			<h2 id="lookbook-title" class="mb-8 text-[11px] tracking-[0.28em] text-forest/75 uppercase font-medium">
				The lookbook
			</h2>

			<ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{#each lookbook as shot (shot.key)}
					<li class="group flex flex-col gap-3">
						<div class="aspect-[4/5] w-full overflow-hidden bg-forest/[0.04]">
							<img
								class="size-full object-cover object-center transition duration-700 ease-out group-hover:scale-[1.035] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
								src={shot.url}
								alt={shot.alt}
								loading="lazy"
								decoding="async"
							/>
						</div>
						<p class="text-[11px] tracking-[0.2em] text-forest/75 uppercase font-medium">
							{ROLE_LABEL[shot.role] ?? shot.role} · {shot.piece}
						</p>
					</li>
				{/each}
			</ul>
		</section>

		{#if notifyOffers.length > 0}
			<section class="relative mb-24 border-t border-forest/15 pt-12" aria-labelledby="notify-title">
				<div
					class="pointer-events-none absolute inset-x-0 top-0 h-80 text-forest"
					aria-hidden="true"
				>
					<HempMotif opacity={0.04} seed={7} />
				</div>

				<div class="relative flex flex-col gap-3">
					<h2 id="notify-title" class="text-[11px] tracking-[0.28em] text-forest/75 uppercase font-medium">
						Notify me
					</h2>
					<p class="max-w-lg text-[15px] leading-relaxed text-forest/75">
						Every size keeps its own list. One message, for the size you pick, when it is available
						— and nothing else.
					</p>
				</div>

				<div class="relative mt-8 max-w-2xl">
					{#each notifyOffers as offer (offer.variantId)}
						<NotifyMeForm
							dropSlug={data.drop.slug}
							variantId={offer.variantId}
							size={offer.size}
							productName={data.pieces.length > 1 ? offer.pieceName : ''}
							{form}
							source="drop_page"
							surface="light"
						/>
					{/each}
				</div>
			</section>
		{/if}

		{#if data.canRequest}
			<section
				class="relative mb-24 overflow-hidden border-t border-forest/15 pt-12"
				aria-labelledby="request-title"
			>

				<h2 id="request-title" class="mb-8 text-[11px] tracking-[0.28em] text-forest/75 uppercase font-medium">
					Bring it back
				</h2>

				{#if requestedTotal > 0}
					<p class="mb-6 text-[11px] tracking-[0.28em] text-forest/75 uppercase font-medium">
						<span class="text-gold-ink tabular-nums">{requestedTotal}</span>
						{requestedTotal === 1 ? 'request' : 'requests'} on the board for this drop
					</p>
				{/if}

				<div class="max-w-3xl">
					<RequestDropForm
						dropSlug={data.drop.slug}
						dropName={data.drop.name}
						sizeOptions={data.sizeOptions}
						{form}
						source="drop_page"
						heading="Tell us the size you missed"
					surface="light"/>
				</div>

				{#if data.demandRows.length > 0 && requestedTotal > 0}
					<div class="mt-10 max-w-xl overflow-x-auto">
						<table class="w-full min-w-[22rem] border-collapse text-left">
							<caption class="sr-only">Requests on the board, by size</caption>
							<thead>
								<tr
									class="border-b border-forest/15 text-[11px] tracking-[0.28em] text-forest/75 uppercase font-medium"
								>
									<th scope="col" class="py-3 pr-4 font-normal">Size</th>
									<th scope="col" class="py-3 pr-4 font-normal">Requests</th>
									<th scope="col" class="py-3 font-normal">Notify-me</th>
								</tr>
							</thead>
							<tbody>
								{#each data.demandRows as row (row.variantId)}
									<tr class="border-b border-forest/10">
										<th
											scope="row"
											class="py-3 pr-4 text-[13px] font-normal tracking-[0.18em] uppercase"
										>
											{row.size}
										</th>
										<td class="py-3 pr-4 text-[15px] text-forest/75 tabular-nums">{row.requests}</td>
										<td class="py-3 text-[15px] text-forest/75 tabular-nums">{row.notifyMe}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</section>
		{/if}

		<section
			class="relative overflow-hidden border-t border-forest/15 pt-12"
			aria-labelledby="spec-title"
		>

			<h2 id="spec-title" class="mb-8 text-[11px] tracking-[0.28em] text-forest/75 uppercase font-medium">
				The specification
			</h2>

			<div class="grid gap-12 lg:grid-cols-2 lg:gap-20">
				<dl class="m-0">
					{#each specifications as specification (specification[0])}
						<div
							class="flex justify-between gap-4 border-t border-forest/15 py-4 text-[11px] tracking-[0.18em] uppercase font-medium"
						>
							<dt class="text-forest/80">{specification[0]}</dt>
							<dd class="m-0 text-forest/75">{specification[1]}</dd>
						</div>
					{/each}
				</dl>

				<div class="flex flex-col">
					<Accordion title="Size guide" surface="light" open>
						<SizeChart
							modelHeightCm={data.product.modelHeightCm}
							modelWornSize={data.product.modelWornSize}
							surface="light"
						/>
					</Accordion>
					<Accordion title="Care" surface="light">
						<ul class="flex flex-col gap-2">
							{#each data.product.care as instruction (instruction)}
								<li>{instruction}</li>
							{/each}
						</ul>
					</Accordion>
					<Accordion title="Returns" surface="light">
						<!-- §11: identical wording on the product page, at checkout, in the
						     confirmation email and on the policy page. Imported, never retyped. -->
						<p>{RETURNS_WORDING}</p>
					</Accordion>
				</div>
			</div>
		</section>
	</div>
</main>
