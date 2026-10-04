<script lang="ts">
	/**
	 * The homepage, set as an issue of a magazine: each drop is an issue.
	 *
	 *   Cover     the piece, front and back, then its name — nothing on the images
	 *   Piece     straight on from the cover: the cutout and a spec sheet
	 *   Details   a slow, drifting slider of every photograph and close crop
	 *   Roots     who makes it, as a short essay with a plate
	 *
	 * The cover, piece and details run as one unbroken page — no rules or
	 * headings between them — and no price is shown anywhere here; the
	 * product page carries it.
	 *   Back      the sign-off and the way in
	 *
	 * White pages, black ink, one display face (Didot, the brand's own), hairline
	 * rules. Every product fact comes from the live drop record through the same
	 * loader as the product page, so the two can never disagree.
	 */
	import SiteHeader from '$lib/components/SiteHeader.svelte';
	import SizeSelector from '$lib/components/drop/SizeSelector.svelte';
	import { SIZE_RANGE_LABEL } from '$lib/drop/sizes';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let feature = $derived(data.feature);
	let product = $derived(feature?.product ?? null);
	let dropHref = $derived(feature ? `/drops/${feature.drop.slug}` : '/drops');
	let issue = $derived(feature ? String(feature.drop.number).padStart(2, '0') : '');

	const month = new Intl.DateTimeFormat('en-IN', {
		month: 'long',
		year: 'numeric',
		timeZone: 'Asia/Kolkata'
	});

	let byRole = $derived.by(() => {
		const images = product?.images ?? [];
		const find = (role: string) => images.find((image) => image.role === role) ?? null;
		return {
			lead: find('lead') ?? images[0] ?? null,
			detail: find('detail'),
			piece: find('fabric'),
			worn: find('worn')
		};
	});

	/**
	 * The details: the worn shot, then close crops cut from the cover's own
	 * photographs — the chest embroidery from the front, the tree from the
	 * back — so the page shows something new rather than the same frames again.
	 * `focus` is the crop's centre and `zoom` how far in it goes.
	 */
	type Detail = { url: string; alt: string; caption: string; focus: string; zoom: number; shape: string };
	let details = $derived.by(() => {
		const list: Detail[] = [];
		if (byRole.lead)
			list.push({ ...byRole.lead, caption: 'Front', focus: '50% 24%', zoom: 1.06, shape: 'tall' });
		if (byRole.worn)
			list.push({ ...byRole.worn, caption: 'Worn', focus: '50% 30%', zoom: 1.05, shape: 'tall' });
		if (byRole.lead)
			list.push({
				url: byRole.lead.url,
				alt: 'The chest embroidery, close',
				caption: 'The script, embroidered',
				focus: '50% 57%',
				zoom: 2.6,
				shape: 'square'
			});
		if (byRole.detail)
			list.push({
				url: byRole.detail.url,
				alt: 'The tree print on the back, close',
				caption: 'The tree, across the back',
				focus: '57% 52%',
				zoom: 1.9,
				shape: 'wide'
			});
		if (byRole.detail)
			list.push({ ...byRole.detail, caption: 'Back', focus: '50% 24%', zoom: 1.06, shape: 'tall' });
		if (byRole.piece)
			list.push({ ...byRole.piece, caption: 'The piece', focus: '50% 50%', zoom: 1, shape: 'cut' });
		return list;
	});

	/** The spec sheet: fields on the record, set with dotted leaders. */
	let specs = $derived(
		product && feature
			? [
					['Composition', product.fabric],
					['Weight', `${product.gsm} GSM`],
					['Fit', product.fit],
					['Sizes', SIZE_RANGE_LABEL],
					['Edition', `${feature.drop.editionSize} pieces, numbered by hand`]
				]
			: []
	);

	/** The piece itself, on its own: the cutout if there is one. */
	let featurePhoto = $derived(byRole.piece ?? byRole.worn ?? byRole.detail);

	/** The cover spread: front and back, each with its caption. */
	let spread = $derived(
		[
			byRole.lead ? { ...byRole.lead, label: 'Front' } : null,
			byRole.detail ? { ...byRole.detail, label: 'Back, the tree' } : null
		].filter((half) => half !== null)
	);
	/** Which half a phone is showing; desktop shows both. */
	let spreadIndex = $state(0);
	let spreadTrack: HTMLElement | undefined = $state();

	function showHalf(index: number) {
		spreadIndex = index;
		const track = spreadTrack;
		if (track) track.scrollTo({ left: track.clientWidth * index, behavior: 'smooth' });
	}
	function onSpreadScroll() {
		const track = spreadTrack;
		if (track) spreadIndex = Math.round(track.scrollLeft / Math.max(track.clientWidth, 1));
	}

</script>

<svelte:head>
	<title>Rootwear — Clothing grown from hemp</title>
	<meta
		name="description"
		content={product
			? `Issue ${issue}: ${product.name}. ${product.summary}`
			: 'Rootwear makes considered clothing from hemp: rooted in the earth, built for everyday life.'}
	/>
	{#if byRole.lead}<meta property="og:image" content={byRole.lead.url} />{/if}
</svelte:head>

<SiteHeader home="#top" position="fixed" surface="light" />

<main id="top" class="mag">
	<!-- ───────── Cover: two images, then the name. ───────── -->
	<section class="cover" data-header-theme="light" aria-labelledby="cover-title">
		{#if feature && product}
			<div class="spread">
				<div class="spread__track" bind:this={spreadTrack} onscroll={onSpreadScroll}>
					{#each spread as half, index (half.url)}
						<figure class="spread__half" style="--i: {index}">
							<img
								src={half.url}
								alt={half.alt}
								fetchpriority={index === 0 ? 'high' : 'auto'}
								decoding="async"
							/>
						</figure>
					{/each}
				</div>

				{#if spread.length > 1}
					<div class="spread__tabs" role="group" aria-label="Show">
						{#each spread as half, index (half.url)}
							<button
								type="button"
								aria-pressed={spreadIndex === index}
								onclick={() => showHalf(index)}>{half.label.split(',')[0]}</button
							>
						{/each}
					</div>
				{/if}
			</div>

			<div class="nameplate">
				<h1 id="cover-title" class="nameplate__title">
					<span><span>{feature.drop.name}</span></span>
				</h1>
				<div class="nameplate__side">
					<p class="nameplate__meta">
						<span class="nameplate__dot" aria-hidden="true"></span>
						Issue {issue} · {month.format(feature.drop.launchInstant)} · {feature.status}
					</p>
					<a class="cta" href={dropHref}>Shop the issue</a>
				</div>
			</div>
		{:else}
			<div class="nameplate">
				<h1 id="cover-title" class="nameplate__title"><span><span>Rootwear</span></span></h1>
				<p class="nameplate__meta">The next issue is on its way.</p>
			</div>
		{/if}
	</section>

	{#if feature && product}
		<!-- ───────── The piece: straight on from the cover. ───────── -->
		<section id="piece" class="piece" aria-labelledby="piece-title">
			{#if featurePhoto}
				<figure class="piece__photo" class:piece__photo--cut={featurePhoto.url.endsWith('.png')}>
					<img src={featurePhoto.url} alt={featurePhoto.alt} loading="lazy" decoding="async" />
				</figure>
			{/if}

			<div class="piece__text">
				<h2 id="piece-title" class="sr-only">{product.name}</h2>
				<p class="piece__deck">{product.summary}</p>

				<dl class="spec">
					{#each specs as [label, value] (label)}
						<div class="spec__row">
							<dt>{label}</dt>
							<span class="spec__dots" aria-hidden="true"></span>
							<dd>{value}</dd>
						</div>
					{/each}
				</dl>

				<div class="piece__sizes">
					<div class="piece__sizes-head">
						<span>Available sizes</span>
						<span>
							{feature.remaining > 0
								? `${feature.remaining} of ${feature.drop.editionSize} left`
								: 'Sold out'}
						</span>
					</div>
					<SizeSelector offers={feature.offers} selectable={false} surface="light" />
				</div>

				<div class="piece__actions">
					<a class="cta" href={dropHref}>Shop now</a>
					<a class="link" href="{dropHref}#size-guide">Size guide</a>
				</div>
			</div>
		</section>

		<!-- ───────── The details: a slow slider, on without a break. ───────── -->
		{#if details.length > 0}
			<section id="details" class="details" aria-label="Details">
				<div class="slider">
					<ul class="slider__track">
						{#each [0, 1] as copy (copy)}
							{#each details as detail, index (`${copy}-${detail.caption}`)}
								<li
									class="fig fig--{detail.shape}"
									style="--focus: {detail.focus}; --zoom: {detail.zoom}"
									aria-hidden={copy > 0}
								>
									<a href={dropHref} class="fig__frame" tabindex={copy > 0 ? -1 : 0}>
										<img
											src={detail.url}
											alt={copy > 0 ? '' : detail.alt}
											loading="lazy"
											decoding="async"
										/>
									</a>
									<p class="fig__cap"><span>Fig. {index + 1}</span> {detail.caption}</p>
								</li>
							{/each}
						{/each}
					</ul>
				</div>
			</section>
		{/if}
	{/if}

	<!-- ───────── Our roots: the question, three short notes, the plate. ───────── -->
	<section id="roots" class="roots" aria-labelledby="roots-title">
		<p class="section-no">Our roots</p>
		<h2 id="roots-title" class="roots__title">
			What if the clothes closest to us could feel good without asking the earth for more than it can
			give?
		</h2>
		<p class="roots__byline">Founded by Aaron Mishra · Bengaluru · Est. 2026</p>

		<div class="roots__notes">
			<article>
				<h3>Before we build, we listen.</h3>
				<p>Rootwear began with that one question, and every piece still starts there.</p>
			</article>
			<article>
				<h3>A small team.</h3>
				<p>
					Designers, material obsessives and culture builders, making everyday uniforms from
					hemp-led fabrics.
				</p>
			</article>
			<article>
				<h3>Fewer, better pieces.</h3>
				<p>
					Every drop starts with the fibre and ends with a small, numbered run, made to gather
					character over time.
				</p>
			</article>
		</div>

		<figure class="roots__plate">
			<div class="roots__frame">
				<img
					src="/images/rootwear-brand-story.jpg"
					alt="Rootwear, established in process: the tree, with the lines before we build, we listen, and built from the ground up"
					loading="lazy"
				/>
				<!-- The artwork's own tagline is overprinted with the brand line, as in the footer. -->
				<span class="roots__tm" aria-hidden="true">TM</span>
				<span class="roots__tagline" aria-hidden="true">Established in Process</span>
			</div>
			<figcaption>
				<span><span class="roots__plate-no">Plate</span> Rootwear — Established in Process.</span>
				<a class="link" href="/know-your-roots">Read the full story</a>
			</figcaption>
		</figure>
	</section>

</main>

<style>
	/*
	 * Layout: a magazine issue on white. One gutter, a 12-column grid, hairline
	 * rules between sections, captions in small sans under every image. The
	 * display face carries all the drama; nothing else competes with it.
	 */
	.mag {
		--ink: var(--color-forest-black);
		--soft: rgb(11 15 11 / 0.62);
		--rule: rgb(11 15 11 / 0.14);
		--paper: #ffffff;
		--stone: #efeeeb;
		--gutter: clamp(20px, 4vw, 56px);
		background: var(--paper);
		color: var(--ink);
		overflow-x: clip;
	}

	/* ── Shared ───────────────────────────────────────────────── */
	.cta {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: 50px;
		padding-inline: 28px;
		background: var(--ink);
		color: #f6f4ef;
		font-size: 11px;
		font-weight: 500;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		transition: background-color 0.25s;
	}
	.cta:hover {
		background: var(--color-forest);
	}
	.link {
		font-size: 14px;
		text-decoration: underline;
		text-underline-offset: 4px;
		text-decoration-thickness: 1px;
	}
	.link:hover {
		text-decoration-thickness: 2px;
	}
	.section-no {
		font-size: 12px;
		letter-spacing: 0.04em;
		color: var(--soft);
	}

	/* ── Cover ────────────────────────────────────────────────── */
	/* The images take the screen under the header; the nameplate takes the rest of it. */
	.cover {
		--nameplate: clamp(130px, 20vh, 220px);
		padding-top: calc(68px + env(safe-area-inset-top, 0px));
	}
	.spread {
		position: relative;
		height: max(420px, calc(100svh - 68px - var(--nameplate) - env(safe-area-inset-top, 0px)));
		overflow: hidden;
		background: var(--stone);
	}
	.spread__track {
		display: flex;
		height: 100%;
		gap: 2px;
	}
	.spread__half {
		position: relative;
		flex: 1 1 0;
		min-width: 0;
		margin: 0;
		overflow: hidden;
		transition: flex-grow 0.9s cubic-bezier(0.2, 0.7, 0.2, 1);
		animation: wipe-up 1.3s cubic-bezier(0.7, 0, 0.2, 1) both;
		animation-delay: calc(0.1s + var(--i) * 0.16s);
	}
	@keyframes wipe-up {
		from {
			clip-path: inset(100% 0 0 0);
		}
		to {
			clip-path: inset(0 0 0 0);
		}
	}
	@media (hover: hover) and (min-width: 861px) {
		.spread__track:hover .spread__half:hover {
			flex-grow: 1.55;
		}
	}
	.spread__half img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: 50% 22%;
		/* The studio frames carry a pale strip at the edge. */
		transform: scale(1.09);
		transition: transform 1.4s cubic-bezier(0.2, 0.7, 0.2, 1);
	}
	.spread__half:hover img {
		transform: scale(1.12);
	}
	.spread__tabs {
		display: none;
	}

	/* The nameplate: the drop's name, set large, under the images. */
	.nameplate {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		gap: 32px;
		min-height: var(--nameplate);
		padding: clamp(16px, 2vw, 24px) var(--gutter) clamp(18px, 2.4vw, 30px);
	}
	.nameplate__title {
		margin: 0;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: clamp(3rem, 8.4vw, 9.4rem);
		line-height: 0.86;
		letter-spacing: -0.05em;
		white-space: nowrap;
	}
	.nameplate__title > span {
		display: block;
		overflow: hidden;
		padding-bottom: 0.06em;
	}
	.nameplate__title > span > span {
		display: block;
		animation: line-up 1.1s cubic-bezier(0.16, 1, 0.3, 1) 0.45s both;
	}
	@keyframes line-up {
		from {
			transform: translateY(105%);
		}
	}
	.nameplate__side {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 16px;
		padding-bottom: 6px;
		animation: rise 0.8s cubic-bezier(0.2, 0.7, 0.2, 1) 0.8s both;
	}
	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(12px);
		}
	}
	.nameplate__meta {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 13px;
		color: var(--soft);
		white-space: nowrap;
	}
	.nameplate__dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--ink);
		animation: pulse 2.4s ease-in-out infinite;
	}
	@keyframes pulse {
		50% {
			opacity: 0.25;
		}
	}
	/* ── The piece ────────────────────────────────────────────── */
	/* No rule, no heading: it reads as the cover's next paragraph. */
	.piece {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: clamp(32px, 6vw, 96px);
		align-items: start;
		padding: clamp(40px, 5vw, 72px) var(--gutter) clamp(56px, 7vw, 104px);
		scroll-margin-top: 60px;
	}
	.piece__photo {
		position: sticky;
		top: 90px;
		margin: 0;
		aspect-ratio: 4 / 5;
		overflow: hidden;
		background: var(--stone);
	}
	.piece__photo img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		transform: scale(1.04);
	}
	.piece__photo--cut img {
		object-fit: contain;
		padding: 10%;
		transform: none;
	}
	.piece__text {
		display: flex;
		flex-direction: column;
		gap: 28px;
	}
	.piece__deck {
		max-width: 26ch;
		font-family: var(--font-display);
		font-size: clamp(1.8rem, 3vw, 3rem);
		line-height: 1.08;
		letter-spacing: -0.025em;
		text-wrap: balance;
	}
	/* A spec sheet: label, dotted leader, value. */
	.spec {
		margin: 0;
		border-top: 1px solid var(--ink);
	}
	.spec__row {
		display: flex;
		align-items: baseline;
		gap: 10px;
		padding: 13px 0;
		border-bottom: 1px solid var(--rule);
		font-size: 14px;
	}
	.spec__row dt {
		color: var(--soft);
		white-space: nowrap;
	}
	.spec__dots {
		flex: 1;
		min-width: 16px;
		border-bottom: 1px dotted rgb(11 15 11 / 0.35);
		transform: translateY(-4px);
	}
	.spec__row dd {
		margin: 0;
		text-align: right;
	}
	.piece__sizes {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.piece__sizes-head {
		display: flex;
		justify-content: space-between;
		font-size: 13px;
		color: var(--soft);
	}
	.piece__actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 24px;
	}

	/* ── The details: the slider ───────────────────────────────── */
	.details {
		padding: 0 0 clamp(80px, 10vw, 144px);
	}
	.slider {
		overflow: hidden;
		-webkit-mask-image: linear-gradient(to right, transparent, #000 4%, #000 96%, transparent);
		mask-image: linear-gradient(to right, transparent, #000 4%, #000 96%, transparent);
	}
	.slider__track {
		display: flex;
		align-items: flex-end;
		gap: clamp(14px, 1.6vw, 24px);
		width: max-content;
		margin: 0;
		padding: 0 var(--gutter);
		list-style: none;
		animation: drift 70s linear infinite;
	}
	.slider:hover .slider__track,
	.slider:focus-within .slider__track {
		animation-play-state: paused;
	}
	@keyframes drift {
		to {
			transform: translateX(-50%);
		}
	}
	.fig {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.fig__frame {
		display: block;
		height: clamp(340px, 58vh, 620px);
		overflow: hidden;
		background: var(--stone);
	}
	.fig--tall .fig__frame,
	.fig--cut .fig__frame {
		aspect-ratio: 4 / 5;
	}
	.fig--square .fig__frame {
		aspect-ratio: 1;
	}
	.fig--wide .fig__frame {
		aspect-ratio: 16 / 10;
	}
	/* Each crop is a photograph zoomed in on its own focus. */
	.fig__frame img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: var(--focus);
		transform: scale(var(--zoom));
		transform-origin: var(--focus);
		transition: transform 1.4s cubic-bezier(0.2, 0.7, 0.2, 1);
	}
	.fig__frame:hover img {
		transform: scale(calc(var(--zoom) * 1.05));
	}
	.fig--cut .fig__frame img {
		object-fit: contain;
		padding: 10%;
	}
	.fig__cap {
		font-size: 13px;
		color: var(--soft);
	}
	.fig__cap span {
		margin-right: 8px;
		color: var(--ink);
	}

	/* ── Our roots ────────────────────────────────────────────── */
	.roots {
		padding: clamp(80px, 10vw, 144px) var(--gutter);
		border-top: 1px solid var(--rule);
		scroll-margin-top: 60px;
	}
	/* The founding question is the headline. */
	.roots__title {
		margin: 22px 0 0;
		max-width: 27ch;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: clamp(2.4rem, 5.2vw, 5.6rem);
		line-height: 1;
		letter-spacing: -0.04em;
		text-wrap: balance;
	}
	.roots__byline {
		margin-top: 26px;
		font-size: 13px;
		color: var(--soft);
	}
	.roots__notes {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: clamp(24px, 4vw, 64px);
		margin-top: clamp(48px, 6vw, 88px);
	}
	.roots__notes article {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding-top: 18px;
		border-top: 1px solid var(--ink);
	}
	.roots__notes h3 {
		margin: 0;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: clamp(1.4rem, 1.9vw, 1.8rem);
		line-height: 1.1;
		letter-spacing: -0.015em;
	}
	.roots__notes p {
		max-width: 36ch;
		font-size: 15px;
		line-height: 1.65;
		color: rgb(11 15 11 / 0.75);
	}
	.roots__plate {
		position: relative;
		margin: clamp(48px, 6vw, 88px) 0 0;
	}
	.roots__frame {
		position: relative;
		overflow: hidden;
		background: #1c3023;
	}
	.roots__frame img {
		display: block;
		width: 100%;
		height: auto;
		filter: saturate(0.88) contrast(1.04);
	}
	.roots__tm {
		position: absolute;
		top: 68.5%;
		right: 2.1%;
		font-size: clamp(0.45rem, 0.72vw, 0.95rem);
		font-weight: 500;
		letter-spacing: 0.08em;
		color: rgb(246 239 221 / 0.9);
	}
	.roots__tagline {
		position: absolute;
		top: 82%;
		left: 72%;
		width: 21%;
		padding: 0.25em 0;
		background: #1c3023;
		font-family: var(--font-display);
		font-size: clamp(0.75rem, 1.65vw, 2.3rem);
		font-style: italic;
		line-height: 1.3;
		text-align: center;
		color: #f6efdd;
	}
	.roots__plate figcaption {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 20px;
		margin-top: 12px;
		font-size: 13px;
		color: var(--soft);
	}
	.roots__plate-no {
		margin-right: 8px;
		color: var(--ink);
	}

	/* ── Phone ────────────────────────────────────────────────── */
	@media (max-width: 860px) {
		.piece {
			grid-template-columns: minmax(0, 1fr);
		}
		/* A phone swipes between the halves; the tabs name them. */
		.cover {
			--nameplate: 204px;
			padding-top: calc(60px + env(safe-area-inset-top, 0px));
		}
		.spread {
			height: max(380px, calc(100svh - 60px - var(--nameplate) - env(safe-area-inset-top, 0px)));
		}
		.spread__track {
			overflow-x: auto;
			scroll-snap-type: x mandatory;
			scrollbar-width: none;
			gap: 0;
		}
		.spread__track::-webkit-scrollbar {
			display: none;
		}
		.spread__half {
			flex: 0 0 100%;
			scroll-snap-align: start;
		}
		.spread__tabs {
			position: absolute;
			bottom: 14px;
			left: 50%;
			transform: translateX(-50%);
			z-index: 2;
			display: flex;
			background: rgb(255 255 255 / 0.8);
			backdrop-filter: blur(8px);
			-webkit-backdrop-filter: blur(8px);
		}
		.spread__tabs button {
			padding: 7px 14px;
			font-size: 12px;
			color: var(--soft);
		}
		.spread__tabs button[aria-pressed='true'] {
			background: var(--ink);
			color: #f6f4ef;
		}
		.nameplate {
			flex-direction: column;
			align-items: stretch;
			gap: 14px;
		}
		.nameplate__title {
			font-size: clamp(2.8rem, 13.5vw, 4.4rem);
		}
		.nameplate__side {
			flex-direction: column-reverse;
			align-items: stretch;
			gap: 10px;
		}
		.nameplate__meta {
			white-space: normal;
		}
		.piece__photo {
			position: relative;
			top: auto;
		}
		.fig__frame {
			height: 52svh;
		}
		.roots__notes {
			grid-template-columns: minmax(0, 1fr);
		}
		.roots__plate figcaption {
			flex-direction: column;
			gap: 8px;
		}
		/* A phone shows the left of the artwork: the mark, the tree and the first line. */
		.roots__frame {
			aspect-ratio: 4 / 3;
		}
		.roots__frame img {
			height: 100%;
			object-fit: cover;
			object-position: 0% 50%;
		}
		.roots__tm,
		.roots__tagline {
			display: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.spread__half,
		.nameplate__title > span > span,
		.nameplate__side,
		.nameplate__dot,
		.slider__track {
			animation: none;
		}
		.slider {
			overflow-x: auto;
		}
	}
</style>
