<script lang="ts">
	/**
	 * §03 template 03 — the shop, in the homepage's magazine style: every drop
	 * is an issue, newest first, and nothing is ever taken down (§12 lets a
	 * finished one be asked back).
	 *
	 * Two views of the same list. List: ruled rows that open into a drifting
	 * slider of the drop's photographs on hover. Grid: cards whose cover turns
	 * to the back of the piece on hover. The choice is remembered per browser.
	 *
	 * No prices here, as on the homepage; the piece's own page carries them.
	 */
	import { onMount } from 'svelte';
	import RequestDropForm from '$lib/components/drop/RequestDropForm.svelte';
	import { INSTAGRAM_HANDLE, INSTAGRAM_URL } from '$lib/content/business';
	import { isOnSale } from '$lib/domain/drop-state';
	import { srcsetOf } from '$lib/media/responsive';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const day = new Intl.DateTimeFormat('en-IN', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		timeZone: 'Asia/Kolkata'
	});

	type Card = PageData['cards'][number];
	type View = 'list' | 'grid';

	const VIEW_KEY = 'rootwear:shop-view';
	let view = $state<View>('list');

	/**
	 * Each drop's own colour, read from its photographs: the average of the
	 * piece's cutout (or the middle of its cover). Mixed into the paper on
	 * hover, so every issue tints the page in its own cloth.
	 */
	let tints = $state<Record<string, string>>({});

	function sampleTint(card: Card): Promise<string | null> {
		const cut = card.images.find((image) => image.url.endsWith('.png'));
		const source = cut ?? card.cover;
		if (!source) return Promise.resolve(null);
		return new Promise((resolve) => {
			const image = new Image();
			image.decoding = 'async';
			image.onload = () => {
				try {
					const size = 48;
					const canvas = document.createElement('canvas');
					canvas.width = size;
					canvas.height = size;
					const context = canvas.getContext('2d', { willReadFrequently: true });
					if (!context) return resolve(null);
					if (cut) context.drawImage(image, 0, 0, size, size);
					else {
						// A photograph: only its middle, where the piece is.
						const w = image.naturalWidth;
						const h = image.naturalHeight;
						context.drawImage(image, w * 0.3, h * 0.35, w * 0.4, h * 0.3, 0, 0, size, size);
					}
					const { data: px } = context.getImageData(0, 0, size, size);
					let r = 0;
					let g = 0;
					let b = 0;
					let n = 0;
					for (let i = 0; i < px.length; i += 4) {
						if (px[i + 3] < 200) continue;
						r += px[i];
						g += px[i + 1];
						b += px[i + 2];
						n++;
					}
					resolve(n ? `rgb(${Math.round(r / n)} ${Math.round(g / n)} ${Math.round(b / n)})` : null);
				} catch {
					resolve(null);
				}
			};
			image.onerror = () => resolve(null);
			image.src = source.url;
		});
	}

	onMount(() => {
		for (const card of data.cards) {
			void sampleTint(card).then((tint) => {
				if (tint) tints = { ...tints, [card.slug]: tint };
			});
		}
		try {
			const saved = localStorage.getItem(VIEW_KEY);
			if (saved === 'list' || saved === 'grid') view = saved;
		} catch {
			// Storage blocked: the default view is fine.
		}
	});

	function setView(next: View) {
		view = next;
		try {
			localStorage.setItem(VIEW_KEY, next);
		} catch {
			// Not remembered; still switched.
		}
	}

	/** The strip shows photographs only; the cutout stays out of it. */
	const photosOf = (card: Card) => card.images.filter((image) => !image.url.endsWith('.png'));

	const issueNo = (card: Card) => String(card.number).padStart(2, '0');

	/** The next issue, teased: its number, and a hint of the last piece's shape. */
	let nextNo = $derived(
		String(Math.max(0, ...data.cards.map((card) => card.number)) + 1).padStart(2, '0')
	);
	let hint = $derived(
		data.cards[0]?.images.find((image) => image.url.endsWith('.png')) ?? data.cards[0]?.cover ?? null
	);

	/** Where a drop sits in time, in a few words. */
	function status(card: Card, now: number) {
		const when = day.format(card.releasedAt);
		if (isOnSale(card.state)) {
			return card.releasedAt > now ? `Pre-order · ships after ${when}` : 'Available now';
		}
		if (card.state === 'TEASE' || card.state === 'REVEALED') return `Opens ${when}`;
		return `Sold out · was live ${when}`;
	}
</script>

<svelte:head>
	<title>Shop — Rootwear</title>
	<meta
		name="description"
		content="Every Rootwear issue, newest first. Small runs of hemp clothing, numbered by hand."
	/>
</svelte:head>

<main class="shop">
	<header class="mast">
		<h1 class="kicker">Shop</h1>
		<div class="views" role="group" aria-label="View">
			<button type="button" aria-pressed={view === 'list'} onclick={() => setView('list')}>
				<svg viewBox="0 0 16 16" aria-hidden="true"
					><path d="M1 3h14M1 8h14M1 13h14" /></svg
				>
				List
			</button>
			<button type="button" aria-pressed={view === 'grid'} onclick={() => setView('grid')}>
				<svg viewBox="0 0 16 16" aria-hidden="true"
					><path d="M1.5 1.5h5v5h-5zM9.5 1.5h5v5h-5zM1.5 9.5h5v5h-5zM9.5 9.5h5v5h-5z" /></svg
				>
				Grid
			</button>
		</div>
	</header>

	{#snippet action(card: Card)}
		{#if isOnSale(card.state)}
			<a class="link" href="/drops/{card.slug}">Shop</a>
		{:else if card.canRequest}
			<details class="ask">
				<summary class="link">Bring it back</summary>
				<div class="ask__form">
					<RequestDropForm
						dropSlug={card.slug}
						dropName={card.name}
						sizeOptions={card.sizeOptions}
						surface="light"
						{form}
					/>
				</div>
			</details>
		{:else}
			<a class="link" href="/drops/{card.slug}">See it</a>
		{/if}
	{/snippet}

	{#if data.cards.length === 0}
		<p class="empty">The first issue is on its way.</p>
	{:else if view === 'list'}
		<!-- ───────── List: rows that open into a slider on hover ───────── -->
		<ol class="rows">
			{#each data.cards as card (card.slug)}
				<li class="row" class:row--open={data.cards.length === 1} style:--tint={tints[card.slug]}>
					<div class="row__line">
						<a class="row__main" href="/drops/{card.slug}">
							<span class="row__no">{issueNo(card)}</span>
							<span class="row__thumb">
								{#if card.cover}<img
										src={card.cover.url}
										srcset={srcsetOf(card.cover.url)}
										sizes="160px"
										alt=""
										loading="lazy"
										decoding="async"
									/>{/if}
							</span>
							<span class="row__name">{card.name}</span>
							<span class="row__facts">
								<span class="row__status">
									<span class="dot" class:dot--live={isOnSale(card.state)} aria-hidden="true"></span>
									{status(card, data.now)}
								</span>
								<span class="row__edition">{card.editionSize} pieces</span>
							</span>
						</a>
						<div class="row__action">{@render action(card)}</div>
					</div>

					{#if card.images.length > 0}
						<!-- Opens on hover; a phone always shows it, as a swipeable strip. -->
						<div class="row__reveal" aria-hidden="true">
							<div class="row__slider">
								<div class="strip" style="--count: {photosOf(card).length}">
									{#each [0, 1] as copy (copy)}
										{#each photosOf(card) as image (`${copy}-${image.url}`)}
											<a
												class="strip__frame"
												class:strip__frame--cut={image.url.endsWith('.png')}
												class:strip__frame--dup={copy > 0}
												href="/drops/{card.slug}"
												tabindex="-1"
												style={image.width && image.height && !image.url.endsWith('.png')
													? `--ar: ${image.width} / ${image.height}`
													: undefined}
											>
												<img
													src={image.url}
													srcset={srcsetOf(image.url)}
													sizes="(max-width: 860px) 60vw, 24vw"
													alt=""
													loading="lazy"
													decoding="async"
												/>
											</a>
										{/each}
									{/each}
								</div>
							</div>
						</div>
					{/if}
				</li>
			{/each}
			<li class="row row--next">
				<div class="row__line">
					<div class="row__main">
						<span class="row__no">{nextNo}</span>
						<span class="row__thumb tease">
							{#if hint}<img src={hint.url} alt="" loading="lazy" decoding="async" />{/if}
						</span>
						<span class="row__name">Next issue</span>
						<span class="row__facts">
							<span class="row__status">
								<span class="dot dot--next" aria-hidden="true"></span>
								Coming soon
							</span>
							<span class="row__edition">Growing</span>
						</span>
					</div>
					<div class="row__action">
						<a class="link" href={INSTAGRAM_URL} rel="noreferrer noopener">Follow {INSTAGRAM_HANDLE}</a>
					</div>
				</div>
			</li>
		</ol>
	{:else}
		<!-- ───────── Grid: cover turns to the back on hover ───────── -->
		<ul class="grid">
			{#each data.cards as card, index (card.slug)}
				<li class="card" style:--tint={tints[card.slug]}>
					<a class="card__frame" href="/drops/{card.slug}">
						{#if card.cover}
							<img
								class="card__img"
								src={card.cover.url}
								srcset={srcsetOf(card.cover.url)}
								sizes="(max-width: 860px) 100vw, 33vw"
								alt={card.cover.alt}
								loading={index < 3 ? 'eager' : 'lazy'}
								decoding="async"
							/>
						{/if}
						{#if card.back}
							<img
								class="card__img card__img--back"
								src={card.back.url}
								srcset={srcsetOf(card.back.url)}
								sizes="(max-width: 860px) 100vw, 33vw"
								alt=""
								loading="lazy"
								decoding="async"
							/>
						{/if}
					</a>
					<div class="card__text">
						<p class="card__meta">
							<span>Issue {issueNo(card)}</span>
							<span>{card.editionSize} pieces</span>
						</p>
						<a class="card__name" href="/drops/{card.slug}">{card.name}</a>
						<p class="card__status">
							<span class="dot" class:dot--live={isOnSale(card.state)} aria-hidden="true"></span>
							{status(card, data.now)}
						</p>
						<div class="card__action">{@render action(card)}</div>
					</div>
				</li>
			{/each}
			<li class="card card--next">
				<div class="card__frame tease">
					{#if hint}<img class="card__img" src={hint.url} alt="" loading="lazy" decoding="async" />{/if}
					<span class="tease__mark" aria-hidden="true">{nextNo}</span>
				</div>
				<div class="card__text">
					<p class="card__meta">
						<span>Issue {nextNo}</span>
						<span>Growing</span>
					</p>
					<p class="card__name">Next issue</p>
					<p class="card__status">
						<span class="dot dot--next" aria-hidden="true"></span>
						Coming soon
					</p>
					<div class="card__action">
						<a class="link" href={INSTAGRAM_URL} rel="noreferrer noopener">Follow {INSTAGRAM_HANDLE}</a>
					</div>
				</div>
			</li>
		</ul>
	{/if}

</main>

<style>
	/* Layout: the homepage's magazine — white page, black ink, Didot, hairlines, one gutter. */
	.shop {
		--ink: var(--color-forest-black);
		--soft: rgb(11 15 11 / 0.62);
		--rule: rgb(11 15 11 / 0.14);
		--stone: #efeeeb;
		--gutter: clamp(20px, 4vw, 56px);
		padding: 0 var(--gutter) clamp(80px, 10vw, 144px);
		background: #ffffff;
		color: var(--ink);
		overflow-x: clip;
	}
	.kicker {
		margin: 0;
		font-size: 13px;
		font-weight: 400;
		color: var(--soft);
	}
	.link {
		font-size: 14px;
		text-decoration: underline;
		text-underline-offset: 4px;
		text-decoration-thickness: 1px;
		cursor: pointer;
	}
	.link:hover {
		text-decoration-thickness: 2px;
	}
	.dot {
		display: inline-block;
		flex: none;
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--rule);
		border: 1px solid var(--soft);
	}
	.dot--live {
		background: var(--ink);
		border-color: var(--ink);
	}

	/* ── Masthead ─────────────────────────────────────────────── */
	/* One row: the page's name, and the view switch. */
	.mast {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 16px;
		margin-top: clamp(32px, 4vw, 56px);
		padding-bottom: 12px;
		border-bottom: 1px solid var(--ink);
	}
	.views {
		display: flex;
		border: 1px solid var(--rule);
	}
	.views button {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 7px 14px;
		font-size: 13px;
		color: var(--soft);
		transition:
			background-color 0.2s,
			color 0.2s;
	}
	.views button + button {
		border-left: 1px solid var(--rule);
	}
	.views button[aria-pressed='true'] {
		background: var(--ink);
		color: #f6f4ef;
	}
	.views svg {
		width: 14px;
		height: 14px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.4;
	}

	.empty {
		padding-top: 28px;
		max-width: 52ch;
		font-size: 14px;
		line-height: 1.6;
		color: var(--soft);
	}

	/* ── List ─────────────────────────────────────────────────── */
	.rows {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	/* Rows run to the page's edges, so the hover tint fills the width. */
	.row {
		--tint: #c29b6a;
		margin-inline: calc(-1 * var(--gutter));
		padding-inline: var(--gutter);
		border-bottom: 1px solid var(--rule);
		transition: background-color 0.5s ease;
	}
	.row:hover,
	.row:focus-within {
		background: color-mix(in oklab, var(--tint) 16%, #ffffff);
	}
	.row__line {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: 24px;
	}
	.row__main {
		display: grid;
		grid-template-columns: 3ch var(--thumb) minmax(0, 1fr) auto;
		align-items: center;
		gap: clamp(16px, 2.4vw, 40px);
		padding: clamp(20px, 2.6vw, 36px) 0;
		--thumb: clamp(88px, 9vw, 132px);
	}
	.row__no {
		font-size: 14px;
		color: var(--soft);
		font-variant-numeric: tabular-nums;
	}
	.row__thumb {
		display: block;
		width: var(--thumb);
		aspect-ratio: 4 / 5;
		overflow: hidden;
		background: var(--stone);
	}
	.row__thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		transform: scale(1.06);
	}
	.row__name {
		font-family: var(--font-display);
		font-size: clamp(2.2rem, 4.6vw, 4.6rem);
		letter-spacing: -0.03em;
		line-height: 0.95;
		transition: transform 0.5s cubic-bezier(0.2, 0.7, 0.2, 1);
	}
	.row__facts {
		display: grid;
		grid-template-columns: auto auto;
		align-items: center;
		gap: clamp(20px, 6vw, 120px);
	}
	.row__status {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 15px;
		color: var(--soft);
		white-space: nowrap;
	}
	.row__edition {
		font-size: 15px;
		color: var(--soft);
		white-space: nowrap;
	}
	.row__action {
		justify-self: end;
		min-width: 6rem;
		text-align: right;
		font-size: 15px;
	}

	/* The reveal: a 0 → 1fr row, so it opens to the slider's natural height. */
	.row__reveal {
		display: grid;
		grid-template-rows: 0fr;
		transition: grid-template-rows 0.6s cubic-bezier(0.2, 0.7, 0.2, 1);
	}
	.row__slider {
		overflow: hidden;
		min-height: 0;
	}
	.strip {
		display: flex;
		gap: 12px;
		width: max-content;
		padding-bottom: 24px;
		/* The same pace whatever the number of photographs: ~9.5s each. */
		animation: drift calc(var(--count, 4) * 9.5s) linear infinite;
		animation-play-state: paused;
	}
	@keyframes drift {
		to {
			transform: translateX(-50%);
		}
	}
	.strip__frame {
		display: block;
		height: clamp(300px, 42vh, 500px);
		/* Each photograph in its own shape; the cutout in the 4:5 default. */
		aspect-ratio: var(--ar, 4 / 5);
		overflow: hidden;
		background: var(--stone);
	}
	.strip__frame img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: 50% 24%;
	}
	.strip__frame--cut img {
		object-fit: contain;
		padding: 9%;
	}
	@media (hover: hover) and (min-width: 861px) {
		.row:hover .row__reveal,
		.row:focus-within .row__reveal,
		.row--open .row__reveal {
			grid-template-rows: 1fr;
		}
		.row:hover .strip,
		.row:focus-within .strip,
		.row--open .strip {
			animation-play-state: running;
		}
		/* The name leans in as the row opens. */
		.row:hover .row__name {
			transform: translateX(10px);
		}
		/* Pause the drift while the pointer rests on a photograph. */
		.strip:hover {
			animation-play-state: paused !important;
		}
	}

	/* ── Grid ─────────────────────────────────────────────────── */
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
		gap: clamp(28px, 3vw, 44px) clamp(16px, 2vw, 28px);
		margin: 0;
		padding: clamp(24px, 3vw, 40px) 0 0;
		list-style: none;
	}
	.card {
		--tint: #c29b6a;
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding-bottom: 16px;
		transition: background-color 0.5s ease;
	}
	.card:hover,
	.card:focus-within {
		background: color-mix(in oklab, var(--tint) 16%, #ffffff);
	}
	.card__text {
		padding-inline: 0;
		transition: padding 0.5s ease;
	}
	.card:hover .card__text,
	.card:focus-within .card__text {
		padding-inline: 14px;
	}
	.card__frame {
		position: relative;
		display: block;
		aspect-ratio: 4 / 5;
		overflow: hidden;
		background: var(--stone);
	}
	.card__img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: 50% 24%;
		transform: scale(1.06);
		transition:
			opacity 0.6s ease,
			transform 1.2s cubic-bezier(0.2, 0.7, 0.2, 1);
	}
	.card__img--back {
		opacity: 0;
	}
	.card__frame:hover .card__img {
		transform: scale(1.1);
	}
	.card__frame:hover .card__img--back {
		opacity: 1;
	}
	.card__text {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.card__meta {
		display: flex;
		justify-content: space-between;
		padding-bottom: 8px;
		border-bottom: 1px solid var(--rule);
		font-size: 13px;
		color: var(--soft);
	}
	.card__name {
		font-family: var(--font-display);
		font-size: clamp(1.8rem, 2.6vw, 2.4rem);
		letter-spacing: -0.025em;
		line-height: 1.05;
	}
	.card__name:hover {
		text-decoration: underline;
		text-decoration-thickness: 1px;
		text-underline-offset: 6px;
	}
	.card__status {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 14px;
		color: var(--soft);
	}
	.card__action {
		margin-top: 4px;
	}

	/* ── The next issue, teased in indigo on the paper ─────────── */
	.row--next,
	.card--next {
		--indigo: #4b3f9e;
		--tint: var(--indigo);
		background: color-mix(in oklab, var(--indigo) 3%, #ffffff);
	}
	.row--next:hover,
	.card--next:hover {
		background: color-mix(in oklab, var(--indigo) 6%, #ffffff);
	}
	.row--next .row__name,
	.card--next .card__name {
		color: color-mix(in oklab, var(--indigo) 45%, var(--ink));
		font-style: italic;
	}
	.row--next .row__status,
	.card--next .card__status {
		color: color-mix(in oklab, var(--indigo) 35%, var(--soft));
	}
	.dot--next {
		background: var(--indigo);
		border-color: var(--indigo);
		animation: pulse 2.4s ease-in-out infinite;
	}
	@keyframes pulse {
		50% {
			opacity: 0.25;
		}
	}
	/* The last piece's shape, out of focus and in indigo: a hint, not a reveal. */
	.tease {
		position: relative;
		background: color-mix(in oklab, var(--indigo) 8%, #ffffff);
	}
	.tease img {
		object-fit: contain;
		padding: 12%;
		filter: grayscale(1) blur(8px) contrast(0.8);
		mix-blend-mode: multiply;
		opacity: 0.22;
		transform: scale(1.05);
	}
	.tease::after {
		content: '';
		position: absolute;
		inset: 0;
		background: color-mix(in oklab, var(--indigo) 12%, transparent);
		mix-blend-mode: color;
	}
	.card__frame.tease .card__img {
		position: absolute;
		inset: 0;
	}
	.tease__mark {
		position: absolute;
		left: 50%;
		top: 50%;
		z-index: 1;
		transform: translate(-50%, -50%);
		font-family: var(--font-display);
		font-style: italic;
		font-size: clamp(5rem, 12vw, 9rem);
		line-height: 1;
		color: color-mix(in oklab, var(--indigo) 22%, #ffffff);
		mix-blend-mode: multiply;
	}

	/* ── Bring it back ────────────────────────────────────────── */
	.ask summary {
		list-style: none;
	}
	.ask summary::-webkit-details-marker {
		display: none;
	}
	.ask__form {
		margin-top: 16px;
		padding: 20px 0 8px;
		text-align: left;
		border-top: 1px solid var(--rule);
	}

	/* ── Tablet: the facts stack beside the name ─────────────── */
	@media (max-width: 1100px) {
		.row__facts {
			grid-template-columns: auto;
			gap: 6px;
		}
	}

	/* ── Phone: a stacked row; the strip shows always, as a swipe ── */
	@media (max-width: 860px) {
		.mast {
			margin-top: 24px;
		}
		.row__line {
			grid-template-columns: minmax(0, 1fr) auto;
			align-items: end;
			gap: 12px;
			padding: 22px 0 14px;
		}
		.row__main {
			grid-template-columns: var(--thumb) minmax(0, 1fr);
			--thumb: 76px;
			gap: 16px;
			padding: 0;
		}
		.row__no {
			display: none;
		}
		.row__name {
			font-size: clamp(1.9rem, 8vw, 2.6rem);
		}
		.row__main > .row__name {
			align-self: end;
		}
		/* Name over facts, beside the thumbnail. */
		.row__main {
			grid-template-areas:
				'thumb name'
				'thumb facts';
		}
		.row__thumb {
			grid-area: thumb;
		}
		.row__name {
			grid-area: name;
		}
		.row__facts {
			grid-area: facts;
			align-self: start;
			gap: 4px;
		}
		.row__status,
		.row__edition {
			font-size: 14px;
			white-space: normal;
		}
		.row__action {
			min-width: 0;
		}
		/* The teaser's longer link goes under it, in line with the name. */
		.row--next .row__line {
			grid-template-columns: minmax(0, 1fr);
		}
		.row--next .row__action {
			justify-self: start;
			padding-left: calc(var(--thumb, 76px) + 16px);
			text-align: left;
		}
		.row__reveal {
			grid-template-rows: 1fr;
		}
		.row__slider {
			overflow-x: auto;
			scroll-snap-type: x mandatory;
			scrollbar-width: none;
			/* A swipe ends at the strip's edge: no bounce, no back gesture. */
			overscroll-behavior-x: contain;
		}
		.row__slider::-webkit-scrollbar {
			display: none;
		}
		.strip {
			animation: none;
			gap: 10px;
			padding-bottom: 20px;
		}
		/* No loop on a phone: the duplicate set is hidden. */
		.strip__frame {
			height: 58vw;
			scroll-snap-align: start;
		}
		.strip__frame--dup {
			display: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.strip {
			animation: none;
		}
		.row__reveal {
			transition: none;
		}
	}
</style>
