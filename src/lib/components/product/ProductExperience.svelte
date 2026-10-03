<script lang="ts">
	/**
	 * The product experience — a drop and its piece as one scroll.
	 *
	 * The page is pictures; the buying lives in the bar fixed to the bottom.
	 * Everything the old drop page and piece page carried is here: story,
	 * countdown, gallery, poster, fabric and edition facts, size guide, care,
	 * returns, notify-me, the restock request and cross-sell (§03, §06, §09).
	 *
	 * Palette and type are the brand's own. The one addition is the cloth
	 * ground — the khaki sampled from the garment itself — behind the label.
	 */
	import { dev } from '$app/environment';
	import BuyBar from './BuyBar.svelte';
	import ClothHero from './ClothHero.svelte';
	import DropCountdown from '$lib/DropCountdown.svelte';
	import DropStateMark from '$lib/components/drop/DropStateMark.svelte';
	import PosterShowcase from '$lib/components/drop/PosterShowcase.svelte';
	import RequestDropForm from '$lib/components/drop/RequestDropForm.svelte';
	import PreOrderForm from '$lib/components/drop/PreOrderForm.svelte';
	import { formatInr } from '$lib/money';
	import { FIT_DISCLAIMER, SIZES, SIZE_CHART, isSize, type Size } from '$lib/drop/sizes';
	import { onMount } from 'svelte';
	import { RETURNS_WORDING } from '$lib/content/returns';
	import type { Experience } from '$lib/server/drops/experience';

	let { data, form = null }: { data: Experience; form?: unknown } = $props();

	let product = $derived(data.product);
	let price = $derived(formatInr(data.displayPrice));
	let dropNumber = $derived(String(data.drop.number).padStart(2, '0'));

	/** Images by the role they play on the record (§09). */
	let byRole = $derived.by(() => {
		const find = (role: string) => product.images.find((image) => image.role === role) ?? null;
		return {
			lead: find('lead') ?? product.images[0] ?? null,
			detail: find('detail'),
			piece: find('fabric'),
			worn: find('worn')
		};
	});

	/** Running letter index across words, for the staggered entrance. */
	function nameIndex(word: number, letter: number) {
		const words = data.drop.name.split(' ');
		return words.slice(0, word).reduce((sum, item) => sum + item.length, 0) + letter;
	}

	/** "Pineapple Haze Tee" → the drop name set large, "Tee" kept for the h1. */
	let pieceWord = $derived(product.name.replace(data.drop.name, '').trim());

	const released = new Intl.DateTimeFormat('en-IN', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		timeZone: 'Asia/Kolkata'
	});
	const shortDate = new Intl.DateTimeFormat('en-IN', {
		day: 'numeric',
		month: 'long',
		timeZone: 'Asia/Kolkata'
	});

	let priceNote = $derived(
		data.isPreOrder
			? `Ships after ${shortDate.format(data.drop.launchInstant)}`
			: data.showPrelaunchPrice
				? 'Pre-launch price'
				: 'Incl. taxes'
	);

	/** "30% hemp / 70% cotton" → segments for the ratio bar; empty if it does not add up. */
	let fibres = $derived.by(() => {
		const parts = [...product.fabric.matchAll(/(\d{1,3})%\s*([a-z][a-z-]*)/gi)].map((match) => ({
			pct: Number(match[1]),
			name: match[2]
		}));
		return parts.reduce((sum, part) => sum + part.pct, 0) === 100 ? parts : [];
	});

	/* ---- Find your size: starts on the model's size; the buy bar can set it. */
	let guideSize = $state<Size>('M');
	$effect.pre(() => {
		if (isSize(product.modelWornSize)) guideSize = product.modelWornSize;
	});
	let guide = $derived(SIZE_CHART[guideSize]);
	/** The tee drawing grows with the chest, relative to the middle size. */
	let teeScale = $derived(guide.chestCm / SIZE_CHART.M.chestCm);

	onMount(() => {
		const pick = (event: Event) => {
			const size = (event as CustomEvent<string>).detail;
			if (isSize(size)) guideSize = size;
		};
		window.addEventListener('rootwear:size-guide', pick);
		return () => window.removeEventListener('rootwear:size-guide', pick);
	});

	const shortDay = new Intl.DateTimeFormat('en-IN', {
		day: 'numeric',
		month: 'long',
		timeZone: 'Asia/Kolkata'
	});
</script>

<svelte:head>
	<title>{product.name} — Drop {dropNumber} | Rootwear</title>
	<meta name="description" content={product.summary} />
	<link rel="canonical" href={data.canonicalPath} />
	{#if byRole.lead}<meta property="og:image" content={byRole.lead.url} />{/if}
</svelte:head>

<main class="exp">
	<!-- ───────── Hero: the name, set large, with the piece floating over it. -->
	<section class="hero" data-header-theme="dark" aria-labelledby="exp-title">
		<div class="hero__meta">
			<span>Drop {dropNumber}</span>
			<DropStateMark state={data.drop.state} surface="dark" />
			<time datetime={new Date(data.drop.releasedAt).toISOString()}
				>{released.format(data.drop.releasedAt)}</time
			>
		</div>

		<h1 id="exp-title" class="hero__title">
			<!-- Letters are split for the entrance; the real words are read once. -->
			<span class="sr-only">{data.drop.name}{pieceWord ? ` ${pieceWord}` : ''}</span>
			<span class="hero__name" aria-hidden="true">
				{#each data.drop.name.split(' ') as word, w (w)}
					<span class="hero__word"
						>{#each word.split('') as letter, l (l)}<span
								class="hero__ch"
								style="--i: {nameIndex(w, l)}">{letter}</span
							>{/each}</span
					>{' '}
				{/each}
			</span>
		</h1>

		{#if byRole.piece}
			<div class="hero__piece">
				<ClothHero src={byRole.piece.url} alt={byRole.piece.alt} />
			</div>
		{/if}

		<div class="hero__foot">
			<p class="hero__summary">{product.summary}</p>
			<p class="hero__price">
				<span>{pieceWord || product.name}</span>
				<strong>{price}</strong>
			</p>
		</div>

		{#if data.acceptsDeposits}
			<p class="hero__claimed">
				<span class="tabular-nums">{data.claimed}</span> of {data.drop.editionSize} reserved
			</p>
		{/if}
	</section>

	{#if data.showCountdown}
		<DropCountdown
			stage={data.stage}
			name={data.drop.name}
			number={data.drop.number}
			editionSize={data.drop.editionSize}
			launchInstant={data.drop.launchInstant}
			headingLevel={2}
			href="#exp-story"
			linkLabel="See the piece"
		/>
	{/if}

	<!-- ───────── The story, in the display face. -->
	<section id="exp-story" class="story" aria-label="The story">
		<p class="story__text">{data.drop.story}</p>
	</section>

	<!-- ───────── Front and back, offset. -->
	<section class="pair" aria-label="Front and back">
		{#if byRole.lead}
			<figure class="pair__front">
				<img src={byRole.lead.url} alt={byRole.lead.alt} loading="lazy" decoding="async" />
				<figcaption>Model is {product.modelHeightCm} cm, wearing size {product.modelWornSize}.</figcaption>
			</figure>
		{/if}
		{#if byRole.detail}
			<figure class="pair__back">
				<img src={byRole.detail.url} alt={byRole.detail.alt} loading="lazy" decoding="async" />
				<figcaption>Turn it over: the tree sits across the back.</figcaption>
			</figure>
		{/if}
	</section>

	<!-- ───────── Worn, edge to edge. -->
	{#if byRole.worn}
		<section class="worn" data-header-theme="dark" aria-label="Worn">
			<img src={byRole.worn.url} alt={byRole.worn.alt} loading="lazy" decoding="async" />
			<p class="worn__line">Cut {product.fit.toLowerCase()}, for every day.</p>
		</section>
	{/if}

	<!-- ───────── The cloth: what it is made of, drawn to scale, on its own colour. -->
	<section class="cloth" aria-labelledby="cloth-title">
		<div class="cloth__head">
			<h2 id="cloth-title" class="cloth__title">The cloth</h2>
			<p class="cloth__no" aria-label="Each piece is numbered out of {data.drop.editionSize}">
				Nº <span class="cloth__blank"></span> / {data.drop.editionSize}
			</p>
		</div>

		{#if fibres.length > 0}
			<div class="ratio" role="img" aria-label={product.fabric}>
				{#each fibres as fibre, index (fibre.name)}
					<div class="ratio__seg ratio__seg--{index % 2}" style="--w: {fibre.pct}">
						<span class="ratio__pct">{fibre.pct}%</span>
						<span class="ratio__name">{fibre.name}</span>
					</div>
				{/each}
			</div>
		{:else}
			<p class="cloth__fabric">{product.fabric}</p>
		{/if}

		<dl class="facts">
			<div>
				<dt>Weight</dt>
				<dd><span class="facts__big">{product.gsm}</span> GSM</dd>
			</div>
			<div>
				<dt>Fit</dt>
				<dd><span class="facts__big facts__big--word">{product.fit}</span></dd>
			</div>
			<div>
				<dt>Edition</dt>
				<dd>
					<span class="facts__big">{data.drop.editionSize}</span> pieces, each numbered by hand
				</dd>
			</div>
		</dl>
	</section>

	<!-- ───────── The poster. -->
	<section class="poster" data-header-theme="dark" aria-labelledby="poster-title">
		<!-- The poster prints "Grown, Not Manufactured" itself; the heading only
		     names the section, so the line is not set twice. -->
		<h2 id="poster-title" class="sr-only">The Drop {dropNumber} poster</h2>
		<div class="poster__art">
			<PosterShowcase />
		</div>
	</section>

	<!-- ───────── Find your size: pick one, see it measured. -->
	<section id="size-guide" class="fit" aria-labelledby="fit-title" tabindex="-1">
		<div class="fit__head">
			<h2 id="fit-title" class="fit__title">Find your size</h2>
			<p>{FIT_DISCLAIMER}</p>
			<p>Model is {product.modelHeightCm} cm, wearing size {product.modelWornSize}.</p>
		</div>

		<div class="fit__tool">
			<div class="fit__sizes" role="radiogroup" aria-label="Size to measure">
				{#each SIZES as size (size)}
					<button
						type="button"
						role="radio"
						aria-checked={guideSize === size}
						class:fit__size--on={guideSize === size}
						onclick={() => (guideSize = size)}>{size}</button
					>
				{/each}
			</div>

			<div class="fit__stage">
				<svg class="fit__tee" viewBox="0 0 240 220" aria-hidden="true" style="--s: {teeScale}">
					<path
						class="fit__outline"
						d="M74 18 L100 10 Q120 26 140 10 L166 18 L222 50 L204 92 L178 80 L178 206 L62 206 L62 80 L36 92 L18 50 Z"
					/>
					<line class="fit__measure" x1="62" y1="104" x2="178" y2="104" />
					<line class="fit__measure" x1="150" y1="16" x2="150" y2="206" />
				</svg>
				<dl class="fit__nums" aria-live="polite">
					<div>
						<dt>Chest</dt>
						<dd><span class="fit__num">{guide.chestCm}</span> cm</dd>
					</div>
					<div>
						<dt>Length</dt>
						<dd><span class="fit__num">{guide.lengthCm}</span> cm</dd>
					</div>
				</dl>
			</div>
		</div>
	</section>

	<!-- ───────── Care, returns, shipping: one line each. -->
	<section class="info" aria-label="Care, returns and shipping">
		<div class="info__row">
			<h3>Care</h3>
			<p>{product.care.join('. ')}.</p>
		</div>
		<div class="info__row">
			<h3>Returns</h3>
			<!-- §11: the same wording everywhere. Imported, never retyped. -->
			<p>{RETURNS_WORDING} <a href="/policies/returns">Returns policy</a></p>
		</div>
		<div class="info__row">
			<h3>Shipping</h3>
			<p>
				{#if data.isPreOrder}
					Pre-orders ship after the drop opens on {shortDay.format(data.drop.launchInstant)}.
				{:else}
					Ships within India in two to four working days.
				{/if}
				<a href="/policies/shipping">Shipping policy</a>
			</p>
		</div>
	</section>

	{#if data.canRequest}
		<section class="request" aria-labelledby="request-title">
			<h2 id="request-title" class="sr-only">Bring it back</h2>
			<RequestDropForm
				dropSlug={data.drop.slug}
				dropName={data.drop.name}
				sizeOptions={data.sizeOptions}
				{form}
				source="product_page"
				heading="Tell us the size you missed"
				surface="light"
			/>
		</section>
	{/if}

	{#if data.alsoInDrop.length > 0}
		<section class="also" aria-labelledby="also-title">
			<h2 id="also-title" class="details__title">Also in Drop {dropNumber}</h2>
			<ul>
				{#each data.alsoInDrop as item (item.slug)}
					<li>
						<a href="/drops/{data.drop.slug}/{item.slug}">
							{#if item.image}<img src={item.image.url} alt={item.image.alt} loading="lazy" />{/if}
							<span>{item.name}</span>
							<span class="tabular-nums">{formatInr(item.price)}</span>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if dev}
		<!-- Dev only: the pre-order signup, to compare with the priced flow. -->
		<section class="devpreview" aria-label="Pre-order preview (dev only)">
			<p class="details__small">Dev preview — pre-order signup</p>
			<PreOrderForm dropSlug={data.drop.slug} sizeOptions={data.sizeOptions} surface="light" {form} />
		</section>
	{/if}

	<!-- Room for the bar, so the last line is never under it. -->
	<div class="exp__tail" aria-hidden="true"></div>
</main>

<BuyBar
	offers={data.offers}
	productName={product.name}
	{price}
	{priceNote}
	thumb={byRole.lead}
	dropSlug={data.drop.slug}
	onSale={data.onSale}
	notifyOpen={data.notifyOpen}
	finished={data.finished}
	isPreOrder={data.isPreOrder}
	{form}
/>

<style>
	/*
	 * Layout: a single scroll of full-bleed bands — dark hero, white story,
	 * offset pair, edge-to-edge worn shot, khaki cloth, poster green, white
	 * details — with the buy bar pinned over all of it.
	 */
	.exp {
		--cloth: #c29b6a;
		--ink: var(--color-forest);
		--night: var(--color-forest-black);
		--paper: var(--color-paper);
		--gutter: clamp(20px, 4vw, 56px);
		background: var(--paper);
		color: var(--ink);
		overflow-x: clip;
	}

	/* ── Hero ─────────────────────────────────────────────── */
	.hero {
		position: relative;
		isolation: isolate;
		min-height: max(640px, 100svh);
		display: grid;
		grid-template-rows: 1fr auto auto;
		padding: calc(120px + env(safe-area-inset-top, 0px)) var(--gutter) 28px;
		background:
			radial-gradient(80% 60% at 50% 55%, rgb(194 155 106 / 0.16), transparent 70%),
			var(--night);
		color: #f3efe6;
		overflow: hidden;
	}
	.hero__meta {
		position: absolute;
		top: calc(112px + env(safe-area-inset-top, 0px));
		left: var(--gutter);
		display: flex;
		align-items: center;
		gap: 14px;
		font-size: 13px;
		color: rgb(243 239 230 / 0.7);
		z-index: 2;
	}
	.hero__title {
		align-self: center;
		margin: 0;
		text-align: center;
		z-index: 0;
	}
	.hero__name {
		display: block;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: clamp(4.2rem, 15.5vw, 17rem);
		line-height: 0.82;
		letter-spacing: -0.045em;
		color: #f3efe6;
		text-wrap: balance;
	}
	/* The entrance: letters rise out of a blur, one after another. */
	.hero__word {
		display: inline-block;
		white-space: nowrap;
	}
	.hero__ch {
		display: inline-block;
		animation: letter-in 0.9s cubic-bezier(0.16, 1, 0.3, 1) both;
		animation-delay: calc(80ms + var(--i) * 45ms);
	}
	@keyframes letter-in {
		from {
			opacity: 0;
			transform: translateY(0.45em) rotate(8deg) scale(0.9);
			filter: blur(14px);
		}
	}
	.hero__meta,
	.hero__foot,
	.hero__claimed {
		animation: rise-in 0.8s cubic-bezier(0.2, 0.7, 0.2, 1) 1.15s both;
	}
	.hero__foot {
		animation-delay: 1.35s;
	}
	@keyframes rise-in {
		from {
			opacity: 0;
			transform: translateY(14px);
		}
	}

	.hero__piece {
		position: absolute;
		left: 50%;
		top: 52%;
		width: min(58vw, 560px);
		height: auto;
		transform: translate(-50%, -50%);
		z-index: 1;
		filter: drop-shadow(0 40px 50px rgb(0 0 0 / 0.55));
	}
	/* The piece drifts up as the hero scrolls away — where the browser can. */
	@supports (animation-timeline: view()) {
		.hero__piece {
			animation: piece-drift linear both;
			animation-timeline: view();
			animation-range: exit 0% exit 100%;
		}
		@keyframes piece-drift {
			to {
				transform: translate(-50%, -78%) rotate(-4deg) scale(1.04);
			}
		}
	}
	.hero__foot {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		gap: 24px;
		z-index: 2;
		margin-bottom: 120px;
	}
	.hero__summary {
		max-width: 30ch;
		font-size: 15px;
		line-height: 1.55;
		color: rgb(243 239 230 / 0.75);
	}
	.hero__price {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 2px;
		font-size: 13px;
		color: rgb(243 239 230 / 0.7);
	}
	.hero__price strong {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 30px;
		color: #f3efe6;
		font-variant-numeric: tabular-nums;
	}
	.hero__claimed {
		position: absolute;
		right: var(--gutter);
		top: calc(112px + env(safe-area-inset-top, 0px));
		font-size: 13px;
		color: var(--color-gold);
		z-index: 2;
	}

	/* ── Story ────────────────────────────────────────────── */
	.story {
		padding: clamp(96px, 16vw, 200px) var(--gutter);
	}
	.story__text {
		max-width: 22ch;
		font-family: var(--font-display);
		font-size: clamp(2rem, 4.6vw, 4.4rem);
		line-height: 1.05;
		letter-spacing: -0.03em;
		text-wrap: balance;
	}

	/* ── Front and back ───────────────────────────────────── */
	.pair {
		display: grid;
		grid-template-columns: repeat(12, minmax(0, 1fr));
		gap: clamp(16px, 2.4vw, 32px);
		padding: 0 var(--gutter) clamp(96px, 12vw, 160px);
	}
	.pair figure {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.pair img {
		width: 100%;
		aspect-ratio: 4 / 5;
		object-fit: cover;
		background: rgb(31 56 42 / 0.05);
	}
	.pair figcaption {
		font-size: 13px;
		color: rgb(31 56 42 / 0.7);
	}
	.pair__front {
		grid-column: 1 / span 7;
	}
	.pair__back {
		grid-column: 9 / span 4;
		margin-top: 38% !important;
	}

	/* ── Worn ─────────────────────────────────────────────── */
	.worn {
		position: relative;
		height: min(100svh, 1000px);
		background: var(--night);
		overflow: hidden;
	}
	.worn img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: 50% 22%;
		/* The editorial frame has a pale strip down its right edge; crop it. */
		transform: scale(1.07);
		transform-origin: 20% 30%;
	}
	.worn__line {
		position: absolute;
		left: var(--gutter);
		bottom: clamp(32px, 6vw, 72px);
		max-width: 14ch;
		font-family: var(--font-display);
		font-size: clamp(2rem, 5vw, 4.6rem);
		line-height: 0.95;
		letter-spacing: -0.03em;
		color: #f3efe6;
		text-shadow: 0 2px 30px rgb(0 0 0 / 0.35);
	}

	/* ── Cloth ────────────────────────────────────────────── */
	.cloth {
		display: flex;
		flex-direction: column;
		gap: clamp(32px, 5vw, 64px);
		padding: clamp(96px, 12vw, 168px) var(--gutter);
		color: var(--color-forest-black);
		/* A fine waffle knit, drawn rather than photographed, over the garment's khaki. */
		background:
			repeating-linear-gradient(0deg, rgb(70 45 15 / 0.07) 0 1px, transparent 1px 7px),
			repeating-linear-gradient(90deg, rgb(70 45 15 / 0.07) 0 1px, transparent 1px 7px),
			radial-gradient(120% 90% at 20% 0%, rgb(255 250 240 / 0.18), transparent 60%),
			var(--cloth);
	}
	.cloth__head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 24px;
	}
	.cloth__title {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: clamp(2.2rem, 4.4vw, 4rem);
		line-height: 1;
		letter-spacing: -0.03em;
		margin: 0;
	}
	.cloth__no {
		font-family: var(--font-display);
		font-size: clamp(1.2rem, 2vw, 1.8rem);
		color: rgb(11 15 11 / 0.75);
	}
	.cloth__blank {
		display: inline-block;
		width: 1.8em;
		border-bottom: 1px solid currentColor;
		vertical-align: -2px;
	}
	.cloth__fabric {
		font-family: var(--font-display);
		font-size: clamp(2.4rem, 6vw, 5.6rem);
		line-height: 1;
		letter-spacing: -0.03em;
	}

	/* The composition, to scale: each fibre gets the width it has in the cloth. */
	.ratio {
		display: flex;
		gap: 6px;
		height: clamp(200px, 38vh, 380px);
	}
	.ratio__seg {
		flex: var(--w) 1 0;
		min-width: 0;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		padding: clamp(14px, 2vw, 28px);
		transform-origin: left center;
	}
	.ratio__seg--0 {
		background: var(--color-forest);
		color: #f3efe6;
	}
	.ratio__seg--1 {
		background: #f6f1e7;
		color: var(--color-forest);
	}
	.ratio__pct {
		font-family: var(--font-display);
		font-size: clamp(3rem, 9vw, 9rem);
		line-height: 0.85;
		letter-spacing: -0.04em;
		font-variant-numeric: tabular-nums;
	}
	.ratio__name {
		margin-top: 10px;
		font-size: 15px;
		text-transform: capitalize;
	}
	@supports (animation-timeline: view()) {
		.ratio__seg {
			animation: grow linear both;
			animation-timeline: view();
			animation-range: entry 0% entry 100%;
		}
		.ratio__seg--1 {
			animation-range: entry 20% entry 100%;
		}
		@keyframes grow {
			from {
				transform: scaleX(0.04);
				opacity: 0.3;
			}
		}
	}

	.facts {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: clamp(20px, 3vw, 40px);
		margin: 0;
	}
	.facts > div {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding-top: 18px;
		border-top: 1px solid rgb(11 15 11 / 0.25);
	}
	.facts dt {
		font-size: 13px;
		color: rgb(11 15 11 / 0.7);
	}
	.facts dd {
		margin: 0;
		font-size: 15px;
	}
	.facts__big {
		display: block;
		font-family: var(--font-display);
		font-size: clamp(2.6rem, 5vw, 4.4rem);
		line-height: 0.95;
		letter-spacing: -0.03em;
		font-variant-numeric: tabular-nums;
	}
	.facts__big--word {
		font-size: clamp(1.8rem, 3vw, 2.8rem);
		line-height: 1.05;
	}

	/* ── Find your size ───────────────────────────────────── */
	.fit {
		display: grid;
		grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
		gap: clamp(32px, 6vw, 96px);
		align-items: center;
		padding: clamp(96px, 12vw, 160px) var(--gutter) clamp(64px, 8vw, 112px);
		scroll-margin-top: 80px;
	}
	.fit:focus {
		outline: none;
	}
	.fit__head {
		display: flex;
		flex-direction: column;
		gap: 10px;
		max-width: 36ch;
		font-size: 15px;
		line-height: 1.6;
		color: rgb(31 56 42 / 0.8);
	}
	.fit__title,
	.details__title {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: clamp(2.2rem, 4.4vw, 4rem);
		line-height: 1;
		letter-spacing: -0.03em;
		margin: 0 0 14px;
		color: var(--ink);
	}
	.fit__tool {
		display: flex;
		flex-direction: column;
		gap: 28px;
	}
	.fit__sizes {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		border: 1px solid rgb(31 56 42 / 0.2);
	}
	.fit__sizes button {
		height: 52px;
		font-size: 13px;
		font-weight: 500;
		letter-spacing: 0.12em;
		color: var(--ink);
		transition:
			background-color 0.25s,
			color 0.25s;
	}
	.fit__sizes button + button {
		border-left: 1px solid rgb(31 56 42 / 0.2);
	}
	.fit__sizes button:hover {
		background: rgb(31 56 42 / 0.06);
	}
	.fit__sizes .fit__size--on,
	.fit__sizes .fit__size--on:hover {
		background: var(--ink);
		color: #f3efe6;
	}
	.fit__stage {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: clamp(20px, 4vw, 56px);
		padding: clamp(20px, 3vw, 40px);
		background: rgb(31 56 42 / 0.04);
	}
	.fit__tee {
		width: 100%;
		max-width: 340px;
		height: auto;
		justify-self: center;
		overflow: visible;
		transform: scale(var(--s));
		transition: transform 0.5s cubic-bezier(0.2, 0.7, 0.2, 1);
	}
	.fit__outline {
		fill: var(--cloth);
		stroke: rgb(31 56 42 / 0.55);
		stroke-width: 1.2;
		stroke-linejoin: round;
		vector-effect: non-scaling-stroke;
	}
	.fit__measure {
		stroke: var(--color-forest);
		stroke-width: 1.5;
		stroke-dasharray: 4 4;
		vector-effect: non-scaling-stroke;
	}
	.fit__nums {
		display: flex;
		flex-direction: column;
		gap: 22px;
		margin: 0;
	}
	.fit__nums dt {
		font-size: 13px;
		color: rgb(31 56 42 / 0.7);
	}
	.fit__nums dd {
		margin: 0;
		font-size: 15px;
		color: var(--ink);
	}
	.fit__num {
		font-family: var(--font-display);
		font-size: clamp(2.8rem, 5vw, 4.6rem);
		line-height: 0.95;
		letter-spacing: -0.03em;
		font-variant-numeric: tabular-nums;
	}

	/* ── Care, returns, shipping ──────────────────────────── */
	.info {
		padding: 0 var(--gutter) clamp(72px, 9vw, 120px);
	}
	.info__row {
		display: grid;
		grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
		gap: clamp(32px, 6vw, 96px);
		padding: 26px 0;
		border-top: 1px solid rgb(31 56 42 / 0.15);
	}
	.info__row:last-child {
		border-bottom: 1px solid rgb(31 56 42 / 0.15);
	}
	.info__row h3 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 26px;
		letter-spacing: -0.01em;
		margin: 0;
	}
	.info__row p {
		max-width: 60ch;
		font-size: 15px;
		line-height: 1.65;
		color: rgb(31 56 42 / 0.8);
	}
	.info__row a {
		color: var(--ink);
		text-decoration: underline;
		text-underline-offset: 3px;
		white-space: nowrap;
	}
	.details__small {
		font-size: 13px;
		color: rgb(31 56 42 / 0.65);
	}

	.request,
	.also,
	.devpreview {
		padding: 0 var(--gutter) clamp(64px, 8vw, 96px);
		max-width: 60rem;
	}
	.also ul {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 24px;
		list-style: none;
		padding: 0;
	}
	.also a {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.also img {
		aspect-ratio: 4 / 5;
		object-fit: cover;
	}
	.exp__tail {
		height: 120px;
	}

	/* ── Phone ────────────────────────────────────────────── */
	@media (max-width: 760px) {
		.hero {
			grid-template-rows: auto 1fr auto;
			padding-top: calc(150px + env(safe-area-inset-top, 0px));
		}
		.hero__title {
			align-self: start;
			text-align: left;
		}
		.hero__meta,
		.hero__claimed {
			top: calc(96px + env(safe-area-inset-top, 0px));
		}
		.hero__claimed {
			top: calc(124px + env(safe-area-inset-top, 0px));
			left: var(--gutter);
			right: auto;
		}
		.hero__name {
			font-size: clamp(3.6rem, 21vw, 8rem);
			line-height: 0.86;
		}
		.hero__piece {
			width: min(74vw, 46svh);
			top: auto;
			bottom: 104px;
			transform: translate(-50%, 0);
		}
		@keyframes piece-drift {
			to {
				transform: translate(-50%, -22%) rotate(-4deg) scale(1.04);
			}
		}
		/* The bar carries the price on a phone; the hero is name and piece. */
		.hero__foot {
			display: none;
		}
		.hero__price {
			align-items: flex-start;
		}
		.pair__front,
		.pair__back {
			grid-column: 1 / -1;
			margin-top: 0 !important;
		}
		.pair__back {
			width: 72%;
			justify-self: end;
		}
		.worn {
			height: 80svh;
		}
		.fit,
		.info__row,
		.fit__stage {
			grid-template-columns: minmax(0, 1fr);
		}
		.info__row {
			gap: 8px;
		}
		.fit__nums {
			flex-direction: row;
			gap: 32px;
		}
		.facts {
			grid-template-columns: minmax(0, 1fr);
		}
		.ratio {
			height: 220px;
		}
		.fit__tee {
			max-width: 240px;
		}
		.ratio__pct {
			font-size: clamp(2.2rem, 11vw, 4rem);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.hero__piece,
		.hero__ch,
		.hero__meta,
		.hero__foot,
		.hero__claimed {
			animation: none !important;
		}
	}
</style>
