<script lang="ts">
	/**
	 * Impact — the material record, set in the homepage's magazine style.
	 *
	 *   Opening   the headline, a spec sheet of the four figures, and the piece
	 *   Figures   each figure in full: the number large, then what it means
	 *   Lineage   where the fibre came from, with a plate
	 *   Close     the edition line and the way in
	 *
	 * Every word comes from $lib/content/impact through the load; §14 governs it,
	 * so the figures are stated as properties of the cloth and nothing more.
	 */
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
	const figure = (value: string, unit: string) => (unit ? `${value} ${unit}` : value);

	/** "In short: …" → the lead and the line, so the lead can be set softer. */
	function inShort(text: string) {
		const match = /^(In short):\s*(.*)$/.exec(text);
		return match ? { lead: match[1], line: sentence(match[2]) } : { lead: '', line: text };
	}
</script>

<svelte:head>
	<title>Impact — the material record | Rootwear</title>
	<meta
		name="description"
		content="What our cloth is made of: composition, fabric weight, how many pieces exist and how they fit."
	/>
</svelte:head>

<main class="mag">
	<header class="mast">
		<p class="kicker">Impact</p>
		<p class="kicker">The material record</p>
	</header>

	<!-- ───────── Opening: the headline, the spec sheet, the piece. ───────── -->
	<section class="open" data-header-theme="light" aria-labelledby="impact-title">
		<div class="open__text">
			<h1 id="impact-title" class="open__title">What the cloth is made of.</h1>
			<p class="open__deck">
				Four numbers that describe the garment: what it’s made from, how heavy it is, how many
				exist and how it’s cut.
			</p>

			<dl class="spec">
				{#each data.details as detail (detail.key)}
					<div class="spec__row">
						<dt><a href="#{detail.key}">{sentence(detail.label)}</a></dt>
						<span class="spec__dots" aria-hidden="true"></span>
						<dd>{figure(detail.value, detail.unit)}</dd>
					</div>
				{/each}
			</dl>
		</div>

		<figure class="open__fig">
			<div class="open__frame">
				<img
					src="/images/pineapple-haze-shirt-cutout.png"
					alt="The Rootwear tee, laid flat"
					fetchpriority="high"
					decoding="async"
				/>
			</div>
			<figcaption class="cap"><span>Fig. 1</span> The piece, laid flat</figcaption>
		</figure>
	</section>

	<!-- ───────── The four figures, in full. ───────── -->
	<section class="figures" aria-labelledby="figures-title">
		<div class="head">
			<h2 id="figures-title" class="head__title">The four, in full</h2>
			<p class="kicker">What each number means for the garment</p>
		</div>

		{#each data.details as detail, index (detail.key)}
			{@const short = inShort(detail.notClaimed)}
			<article id={detail.key} class="entry" aria-labelledby="{detail.key}-label">
				<div class="entry__figure">
					<p class="kicker">{String(index + 1).padStart(2, '0')}</p>
					<p class="entry__value">
						{detail.value}{#if detail.unit}<span class="entry__unit">{detail.unit}</span>{/if}
					</p>
					<h3 id="{detail.key}-label" class="entry__label">{sentence(detail.label)}</h3>
				</div>

				<div class="entry__body">
					{#each detail.body as paragraph (paragraph)}
						<p>{paragraph}</p>
					{/each}
					<!-- §14: say plainly what the number is NOT, so nobody reads a
					     sustainability claim into a fact about cloth. -->
					<p class="entry__short">
						{#if short.lead}<span>{short.lead}</span>{/if}
						{short.line}
					</p>
				</div>
			</article>
		{/each}
	</section>

	<!-- ───────── Lineage: before it was a garment. ───────── -->
	<section class="lineage" aria-labelledby="lineage-title">
		<p class="kicker">Before it was a garment</p>
		<h2 id="lineage-title" class="lineage__title">An ancient fibre. A new chapter.</h2>

		<figure class="lineage__plate">
			<div class="lineage__frame">
				<img
					src="/images/rootwear-tree-seedling.jpg"
					alt="A seedling in a misty forest clearing"
					loading="lazy"
					decoding="async"
				/>
			</div>
			<figcaption class="cap"><span>Fig. 2</span> Where every piece begins</figcaption>
		</figure>

		<ol class="lineage__notes">
			{#each data.lineage as entry (entry.era)}
				<li>
					<p class="kicker">{entry.era}</p>
					<h3>{entry.title}</h3>
					<p class="lineage__body">{entry.body}</p>
					{#if entry.source}
						<a class="link" href={entry.source.href} target="_blank" rel="noreferrer noopener">
							{entry.source.label} ↗<span class="sr-only"> (opens in a new tab)</span>
						</a>
					{/if}
				</li>
			{/each}
		</ol>
	</section>

	<!-- ───────── Close: the edition, and the way in. ───────── -->
	<section class="close" aria-labelledby="close-title">
		<div>
			<p class="kicker">See it in the cloth</p>
			<h2 id="close-title" class="close__title">Twenty-five pieces, numbered by hand.</h2>
		</div>
		<div class="close__actions">
			<a class="cta" href="/drops">View the drop</a>
			<a class="link" href="/know-your-roots">Read our roots</a>
		</div>
	</section>
</main>

<style>
	/* Layout: the homepage's magazine — white page, black ink, Didot, hairlines, one gutter. */
	.mag {
		--ink: var(--color-forest-black);
		--soft: rgb(11 15 11 / 0.62);
		--rule: rgb(11 15 11 / 0.14);
		--stone: #efeeeb;
		--gutter: clamp(20px, 4vw, 56px);
		padding: 0 var(--gutter);
		background: #ffffff;
		color: var(--ink);
		overflow-x: clip;
	}

	/* ── Shared ───────────────────────────────────────────────── */
	.kicker {
		margin: 0;
		font-size: 13px;
		font-weight: 400;
		color: var(--soft);
	}
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
	.cap {
		margin-top: 12px;
		font-size: 13px;
		color: var(--soft);
	}
	.cap span {
		margin-right: 8px;
		color: var(--ink);
	}

	/* ── Masthead: as on the shop ─────────────────────────────── */
	.mast {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 16px;
		margin-top: clamp(32px, 4vw, 56px);
		padding-bottom: 12px;
		border-bottom: 1px solid var(--ink);
	}

	/* ── Opening ──────────────────────────────────────────────── */
	.open {
		display: grid;
		grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
		gap: clamp(32px, 6vw, 96px);
		align-items: start;
		padding: clamp(40px, 5vw, 72px) 0 clamp(72px, 9vw, 128px);
	}
	.open__text {
		display: flex;
		flex-direction: column;
		gap: 28px;
	}
	.open__title {
		margin: 0;
		max-width: 11ch;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: clamp(3rem, 7.2vw, 7.6rem);
		line-height: 0.9;
		letter-spacing: -0.05em;
		text-wrap: balance;
		animation: rise 0.9s cubic-bezier(0.2, 0.7, 0.2, 1) both;
	}
	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(14px);
		}
	}
	.open__deck {
		max-width: 44ch;
		font-size: 16px;
		line-height: 1.65;
		color: rgb(11 15 11 / 0.75);
	}

	/* A spec sheet: label, dotted leader, value. */
	.spec {
		margin: 12px 0 0;
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
	.spec__row dt a:hover {
		color: var(--ink);
		text-decoration: underline;
		text-underline-offset: 4px;
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
		white-space: nowrap;
	}

	.open__fig {
		margin: 0;
	}
	.open__frame {
		aspect-ratio: 4 / 5;
		overflow: hidden;
		background: var(--stone);
	}
	.open__frame img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		padding: 10%;
		transition: transform 1.4s cubic-bezier(0.2, 0.7, 0.2, 1);
	}
	.open__frame:hover img {
		transform: scale(1.03);
	}

	/* ── The four, in full ────────────────────────────────────── */
	.figures {
		padding-bottom: clamp(72px, 9vw, 128px);
		scroll-margin-top: 60px;
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 24px;
		padding-bottom: 14px;
		border-bottom: 1px solid var(--ink);
	}
	.head__title {
		margin: 0;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: clamp(2rem, 3.4vw, 3.2rem);
		line-height: 1;
		letter-spacing: -0.03em;
	}
	.entry {
		display: grid;
		grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
		gap: clamp(28px, 6vw, 96px);
		padding: clamp(36px, 4.4vw, 64px) 0;
		border-bottom: 1px solid var(--rule);
		scroll-margin-top: 80px;
	}
	.entry__figure {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.entry__value {
		margin: 6px 0 0;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: clamp(4.4rem, 10vw, 10rem);
		line-height: 0.86;
		letter-spacing: -0.06em;
		font-variant-numeric: lining-nums;
	}
	.entry__unit {
		margin-left: 0.18em;
		font-size: 0.22em;
		letter-spacing: 0;
		color: var(--soft);
	}
	.entry__label {
		margin: 8px 0 0;
		font-family: inherit;
		font-size: 15px;
		font-weight: 400;
	}
	.entry__body {
		display: flex;
		flex-direction: column;
		gap: 18px;
		padding-top: 4px;
	}
	.entry__body p {
		max-width: 62ch;
		font-size: 16px;
		line-height: 1.7;
		color: rgb(11 15 11 / 0.75);
	}
	.entry__body .entry__short {
		margin-top: 8px;
		padding-top: 16px;
		border-top: 1px solid var(--rule);
		font-family: var(--font-display);
		font-size: clamp(1.3rem, 1.8vw, 1.7rem);
		line-height: 1.2;
		letter-spacing: -0.015em;
		color: var(--ink);
	}
	.entry__short span {
		display: block;
		margin-bottom: 6px;
		font-family: var(--font-sans, inherit);
		font-size: 13px;
		letter-spacing: 0;
		color: var(--soft);
	}

	/* ── Lineage ──────────────────────────────────────────────── */
	.lineage {
		margin-inline: calc(-1 * var(--gutter));
		padding: clamp(80px, 10vw, 144px) var(--gutter);
		border-top: 1px solid var(--rule);
	}
	.lineage__title {
		margin: 22px 0 0;
		max-width: 16ch;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: clamp(2.4rem, 5.2vw, 5.6rem);
		line-height: 1;
		letter-spacing: -0.04em;
		text-wrap: balance;
	}
	.lineage__plate {
		margin: clamp(40px, 5vw, 72px) 0 0;
	}
	.lineage__frame {
		aspect-ratio: 2.4 / 1;
		overflow: hidden;
		background: var(--stone);
	}
	.lineage__frame img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		filter: saturate(0.88) contrast(1.04);
	}
	.lineage__notes {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: clamp(24px, 4vw, 64px);
		margin: clamp(48px, 6vw, 88px) 0 0;
		padding: 0;
		list-style: none;
	}
	.lineage__notes li {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 12px;
		padding-top: 18px;
		border-top: 1px solid var(--ink);
	}
	.lineage__notes h3 {
		margin: 0;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: clamp(1.4rem, 1.9vw, 1.8rem);
		line-height: 1.1;
		letter-spacing: -0.015em;
	}
	.lineage__body {
		max-width: 38ch;
		font-size: 15px;
		line-height: 1.65;
		color: rgb(11 15 11 / 0.75);
	}
	.lineage__notes .link {
		margin-top: 4px;
		font-size: 13px;
	}

	/* ── Close ────────────────────────────────────────────────── */
	.close {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		gap: 32px;
		margin-inline: calc(-1 * var(--gutter));
		padding: clamp(64px, 8vw, 112px) var(--gutter) clamp(72px, 9vw, 128px);
		border-top: 1px solid var(--rule);
	}
	.close__title {
		margin: 18px 0 0;
		max-width: 19ch;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: clamp(2.6rem, 6vw, 6.4rem);
		line-height: 0.92;
		letter-spacing: -0.045em;
		text-wrap: balance;
	}
	.close__actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 24px;
		padding-bottom: 6px;
	}

	/* ── Phone ────────────────────────────────────────────────── */
	@media (max-width: 860px) {
		.mast {
			margin-top: 24px;
		}
		.open {
			grid-template-columns: minmax(0, 1fr);
			gap: 40px;
		}
		.open__title {
			font-size: clamp(2.8rem, 13vw, 4.4rem);
		}
		.head {
			flex-direction: column;
			gap: 8px;
		}
		.entry {
			grid-template-columns: minmax(0, 1fr);
			gap: 24px;
		}
		.entry__value {
			font-size: clamp(4.4rem, 24vw, 6.4rem);
		}
		.entry__body p {
			font-size: 15px;
		}
		.lineage__frame {
			aspect-ratio: 4 / 3;
		}
		.lineage__notes {
			grid-template-columns: minmax(0, 1fr);
		}
		.close {
			flex-direction: column;
			align-items: stretch;
		}
		.close__actions .cta {
			flex: 1 1 100%;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.open__title {
			animation: none;
		}
		.open__frame img {
			transition: none;
		}
	}
</style>
