<script lang="ts">
	/**
	 * §03 template 09 — "Know your roots", set in the homepage's magazine:
	 * one long read on white, in four numbered sections.
	 *
	 *   Opening   the title, a short lede, the contents and a plate
	 *   01        the lineage: a ruled table of dated, sourced entries
	 *   02        the fibre: a close crop of the cloth, the notes, the figures
	 *   03        the label: the principles, then the pull line
	 *   04        the making: five stages, side by side
	 *   Close     where this goes next, and the way in
	 *
	 * White page, black ink, Didot for display, hairline rules between sections
	 * and a black rule under each section head. No prices anywhere.
	 *
	 * Every string comes from $lib/content/know-your-roots via the server load;
	 * §14 is enforced there, at the source, rather than in this markup.
	 */
	import { srcsetOf } from '$lib/media/responsive';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let content = $derived(data.content);
	let hero = $derived(content.hero);
	let close = $derived(content.close);
	let plates = $derived(content.plates);

	// The four sections have bespoke interiors, so they are addressed by position.
	let lineage = $derived(content.movements[0]);
	let fibre = $derived(content.movements[1]);
	let label = $derived(content.movements[2]);
	let making = $derived(content.movements[3]);

	const isExternal = (href: string) => href.startsWith('http');
</script>

<svelte:head>
	<title>{content.seo.title}</title>
	<meta name="description" content={content.seo.description} />
</svelte:head>

{#snippet head(movement: (typeof content.movements)[number])}
	<header class="head">
		<p class="kicker"><span class="kicker__no">{movement.index}</span>{movement.kicker}</p>
		<h2 id="movement-{movement.id}" class="head__title">
			{#each movement.title as line, i (i)}<span>{line}</span>{/each}
		</h2>
		<p class="head__lede">{movement.lede}</p>
	</header>
{/snippet}

<main class="roots" data-header-theme="light">
	<!-- ───────── Opening: the title, the contents, the plate. ───────── -->
	<section class="opening" aria-labelledby="roots-title">
		<div class="opening__head">
			<p class="kicker">{hero.kicker}</p>
			<h1 id="roots-title" class="opening__title">
				{#each hero.title as line, i (i)}<span><span style="--i: {i}">{line}</span></span>{/each}
			</h1>
			<p class="opening__lede">{hero.lede}</p>
		</div>

		<nav class="toc" aria-label={hero.contentsLabel}>
			<ol>
				{#each content.movements as movement (movement.id)}
					<li>
						<a href="#{movement.id}">
							<span class="toc__no">{movement.index}</span>
							<span class="toc__name">{movement.kicker}</span>
						</a>
					</li>
				{/each}
			</ol>
		</nav>

		<figure class="plate">
			<div class="plate__frame">
				<img src={plates.opening.src} alt={plates.opening.alt} fetchpriority="high" decoding="async" />
			</div>
			<figcaption class="cap"><span>Fig. 1</span>{plates.opening.caption}</figcaption>
		</figure>
	</section>

	<!-- ───────── 01 · The lineage ───────── -->
	<section id={lineage.id} class="sec" aria-labelledby="movement-{lineage.id}">
		{@render head(lineage)}

		<ol class="ledger">
			{#each content.lineage.entries as entry (entry.era)}
				<li class="ledger__row">
					<p class="ledger__era">{entry.era}</p>
					<h3 class="ledger__title">{entry.title}</h3>
					<div class="ledger__body">
						<p>{entry.body}</p>
						<a
							class="link"
							href={entry.source.href}
							target={isExternal(entry.source.href) ? '_blank' : undefined}
							rel={isExternal(entry.source.href) ? 'noreferrer noopener' : undefined}
						>
							{entry.source.label}{#if isExternal(entry.source.href)}<span class="sr-only">
									(opens in a new tab)</span
								>{/if}
						</a>
					</div>
				</li>
			{/each}
		</ol>

		<div class="coda">
			<p class="coda__line">{content.lineage.close.line}</p>
			<div class="coda__side">
				<p>{content.lineage.close.defiant}</p>
				<p class="coda__tag">Rootwear — {content.lineage.close.tag}</p>
				<a class="link" href={content.lineage.close.action.href}>{content.lineage.close.action.label}</a>
			</div>
		</div>
	</section>

	<!-- ───────── 02 · The fibre ───────── -->
	<section id={fibre.id} class="sec" aria-labelledby="movement-{fibre.id}">
		{@render head(fibre)}

		<div class="fibre">
			<figure class="fibre__fig">
				<div class="fibre__frame">
					<img
						src={plates.cloth.src}
						srcset={srcsetOf(plates.cloth.src)}
						sizes="(max-width: 860px) 100vw, 40vw"
						alt={plates.cloth.alt}
						loading="lazy"
						decoding="async"
					/>
				</div>
				<figcaption class="cap"><span>Fig. 2</span>{plates.cloth.caption}</figcaption>
			</figure>

			<div class="fibre__text">
				<div class="prose">
					{#each content.hemp.body as paragraph, i (i)}<p>{paragraph}</p>{/each}
				</div>

				<dl class="terms">
					{#each content.hemp.properties as property (property.term)}
						<div class="terms__row">
							<dt>{property.term}</dt>
							<dd>{property.definition}</dd>
						</div>
					{/each}
				</dl>
			</div>
		</div>

		<div class="blend">
			<p class="kicker">The blend</p>
			<p class="blend__note">{content.hemp.blendNote}</p>
			<ul class="figures">
				{#each content.hemp.facts as fact (fact.label)}
					<li>
						<span class="figures__value"
							>{fact.value}{#if fact.unit}<small>{fact.unit}</small>{/if}</span
						>
						<span class="figures__label">{fact.label}</span>
					</li>
				{/each}
			</ul>
		</div>
	</section>

	<!-- ───────── 03 · The label ───────── -->
	<section id={label.id} class="sec" aria-labelledby="movement-{label.id}">
		{@render head(label)}

		<ol class="ledger ledger--principles">
			{#each content.whyRootwear.principles as principle (principle.index)}
				<li class="ledger__row">
					<p class="ledger__era">{principle.index}</p>
					<h3 class="ledger__title">{principle.title}</h3>
					<div class="ledger__body"><p>{principle.body}</p></div>
				</li>
			{/each}
		</ol>

		<figure class="quote">
			<blockquote>{content.whyRootwear.pullquote.line}</blockquote>
			<figcaption class="cap">{content.whyRootwear.pullquote.attribution}</figcaption>
		</figure>
	</section>

	<!-- ───────── 04 · The making ───────── -->
	<section id={making.id} class="sec" aria-labelledby="movement-{making.id}">
		{@render head(making)}

		<ol class="steps">
			{#each content.making.steps as step (step.index)}
				<li>
					<span class="steps__no">{step.index}</span>
					<h3>{step.title}</h3>
					<p>{step.body}</p>
				</li>
			{/each}
		</ol>
	</section>

	<!-- ───────── Close: where this goes next. ───────── -->
	<section class="sec close" aria-labelledby="close-title">
		<p class="kicker">{close.kicker}</p>
		<h2 id="close-title" class="close__title">
			{#each close.line as line, i (i)}<span>{line}</span>{/each}
		</h2>
		<div class="close__side">
			<p>{close.body}</p>
			<div class="close__actions">
				{#each close.actions as action (action.href)}
					<a class={action.primary ? 'cta' : 'link'} href={action.href}>{action.label}</a>
				{/each}
			</div>
		</div>
	</section>
</main>

<style>
	/* Layout: the homepage's magazine — white page, black ink, Didot, hairlines, one gutter. */
	.roots {
		--ink: var(--color-forest-black);
		--soft: rgb(11 15 11 / 0.62);
		--rule: rgb(11 15 11 / 0.14);
		--stone: #efeeeb;
		--gutter: clamp(20px, 4vw, 56px);
		background: #ffffff;
		color: var(--ink);
		overflow-x: clip;
	}

	/* ── Shared ───────────────────────────────────────────────── */
	.kicker {
		margin: 0;
		font-size: 13px;
		color: var(--soft);
	}
	.kicker__no {
		margin-right: 10px;
		color: var(--ink);
		font-variant-numeric: tabular-nums;
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
		margin-right: 10px;
		color: var(--ink);
	}

	/* ── Opening ──────────────────────────────────────────────── */
	.opening {
		padding: clamp(40px, 5vw, 72px) var(--gutter) clamp(80px, 10vw, 144px);
	}
	.opening__head {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 26rem);
		grid-template-areas:
			'kicker kicker'
			'title lede';
		align-items: end;
		column-gap: clamp(32px, 6vw, 96px);
		row-gap: 18px;
	}
	.opening__head .kicker {
		grid-area: kicker;
	}
	.opening__title {
		grid-area: title;
		margin: 0;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: clamp(3.4rem, 10vw, 10rem);
		line-height: 0.86;
		letter-spacing: -0.05em;
	}
	/* One entrance: each line rises out of its own mask. */
	.opening__title > span {
		display: block;
		overflow: hidden;
		/* Room for the descenders inside the mask, given back to the line below. */
		padding-bottom: 0.16em;
		margin-bottom: -0.16em;
	}
	.opening__title > span > span {
		display: block;
		animation: line-up 1.1s cubic-bezier(0.16, 1, 0.3, 1) both;
		animation-delay: calc(0.1s + var(--i) * 0.12s);
	}
	@keyframes line-up {
		from {
			transform: translateY(105%);
		}
	}
	.opening__lede {
		grid-area: lede;
		padding-bottom: 0.6em;
		max-width: 46ch;
		font-size: 16px;
		line-height: 1.65;
		color: var(--soft);
	}

	/* The contents: four numbered entries on a black rule. */
	.toc {
		margin-top: clamp(40px, 5vw, 72px);
		border-top: 1px solid var(--ink);
	}
	.toc ol {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.toc li + li {
		border-left: 1px solid var(--rule);
	}
	.toc a {
		display: flex;
		align-items: baseline;
		gap: 12px;
		padding: 16px 16px 18px 0;
		transition: color 0.25s;
	}
	.toc li + li a {
		padding-left: 16px;
	}
	.toc__no {
		font-size: 13px;
		color: var(--soft);
		font-variant-numeric: tabular-nums;
	}
	.toc__name {
		font-family: var(--font-display);
		font-size: clamp(1.25rem, 1.8vw, 1.7rem);
		letter-spacing: -0.015em;
		line-height: 1.1;
	}
	.toc a:hover .toc__name {
		text-decoration: underline;
		text-decoration-thickness: 1px;
		text-underline-offset: 5px;
	}

	.plate {
		margin: clamp(32px, 4vw, 56px) 0 0;
	}
	.plate__frame {
		aspect-ratio: 12 / 5;
		overflow: hidden;
		background: var(--stone);
	}
	.plate__frame img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		transform: scale(1.04);
	}

	/* ── Sections ─────────────────────────────────────────────── */
	.sec {
		padding: clamp(80px, 10vw, 144px) var(--gutter);
		border-top: 1px solid var(--rule);
		scroll-margin-top: 60px;
	}
	/* The head: kicker, title left, lede right, a black rule under it. */
	.head {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 26rem);
		grid-template-areas:
			'kicker kicker'
			'title lede';
		align-items: end;
		column-gap: clamp(32px, 6vw, 96px);
		row-gap: 22px;
		padding-bottom: clamp(24px, 3vw, 40px);
		border-bottom: 1px solid var(--ink);
	}
	.head .kicker {
		grid-area: kicker;
	}
	.head__title {
		grid-area: title;
		margin: 0;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: clamp(2.4rem, 5.2vw, 5.6rem);
		line-height: 0.95;
		letter-spacing: -0.04em;
	}
	.head__title span {
		display: block;
	}
	.head__lede {
		grid-area: lede;
		font-size: 15px;
		line-height: 1.65;
		color: var(--soft);
	}

	/* A ruled table: when, what, and the note. */
	.ledger {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.ledger__row {
		display: grid;
		grid-template-columns: minmax(0, 14rem) minmax(0, 1fr) minmax(0, 1.25fr);
		gap: clamp(16px, 3vw, 48px);
		align-items: baseline;
		padding: clamp(24px, 2.6vw, 36px) 0;
		border-bottom: 1px solid var(--rule);
	}
	.ledger__era {
		font-size: 13px;
		color: var(--soft);
		font-variant-numeric: tabular-nums;
	}
	.ledger__title {
		margin: 0;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: clamp(1.5rem, 2.2vw, 2.1rem);
		line-height: 1.1;
		letter-spacing: -0.02em;
	}
	.ledger__body {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 14px;
	}
	.ledger__body p {
		max-width: 56ch;
		font-size: 15px;
		line-height: 1.65;
		color: rgb(11 15 11 / 0.75);
	}
	.ledger--principles .ledger__row {
		grid-template-columns: minmax(0, 4rem) minmax(0, 1fr) minmax(0, 1.25fr);
	}

	/* The lineage's sign-off: a line set large, the note beside it. */
	.coda {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 26rem);
		column-gap: clamp(32px, 6vw, 96px);
		row-gap: 24px;
		align-items: end;
		margin-top: clamp(56px, 7vw, 104px);
	}
	.coda__line {
		max-width: 16ch;
		font-family: var(--font-display);
		font-size: clamp(2rem, 4vw, 4rem);
		line-height: 1;
		letter-spacing: -0.035em;
		text-wrap: balance;
	}
	.coda__side {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 14px;
		font-size: 15px;
		line-height: 1.65;
		color: rgb(11 15 11 / 0.75);
	}
	.coda__tag {
		font-size: 13px;
		color: var(--soft);
	}

	/* ── The fibre ────────────────────────────────────────────── */
	.fibre {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: clamp(32px, 6vw, 96px);
		align-items: start;
		margin-top: clamp(40px, 5vw, 72px);
	}
	.fibre__fig {
		position: sticky;
		top: 90px;
		margin: 0;
	}
	.fibre__frame {
		aspect-ratio: 4 / 5;
		overflow: hidden;
		background: var(--stone);
	}
	/* The knit close, exported at this frame's shape. */
	.fibre__frame img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.fibre__text {
		display: flex;
		flex-direction: column;
		gap: clamp(32px, 4vw, 48px);
	}
	.prose {
		display: flex;
		flex-direction: column;
		gap: 18px;
	}
	.prose p {
		max-width: 58ch;
		font-size: 16px;
		line-height: 1.7;
		color: rgb(11 15 11 / 0.75);
	}
	.prose p:first-child {
		font-family: var(--font-display);
		font-size: clamp(1.4rem, 2vw, 1.85rem);
		line-height: 1.25;
		letter-spacing: -0.015em;
		color: var(--ink);
	}
	.terms {
		margin: 0;
		border-top: 1px solid var(--ink);
	}
	.terms__row {
		display: grid;
		grid-template-columns: minmax(0, 9rem) minmax(0, 1fr);
		gap: 20px;
		padding: 14px 0;
		border-bottom: 1px solid var(--rule);
		font-size: 14px;
		line-height: 1.6;
	}
	.terms__row dd {
		margin: 0;
		color: var(--soft);
	}

	.blend {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 24px clamp(32px, 6vw, 96px);
		margin-top: clamp(56px, 7vw, 104px);
		padding-top: 18px;
		border-top: 1px solid var(--rule);
	}
	.blend .kicker {
		grid-column: 1 / -1;
	}
	.blend__note {
		max-width: 34ch;
		font-family: var(--font-display);
		font-size: clamp(1.35rem, 2vw, 1.9rem);
		line-height: 1.2;
		letter-spacing: -0.02em;
		text-wrap: pretty;
	}
	.figures {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 32px clamp(20px, 3vw, 40px);
		align-self: start;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.figures li {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding-top: 14px;
		border-top: 1px solid var(--ink);
	}
	.figures__value {
		font-family: var(--font-display);
		font-size: clamp(2.8rem, 4.6vw, 4.4rem);
		line-height: 0.9;
		letter-spacing: -0.04em;
		font-variant-numeric: lining-nums;
	}
	.figures__value small {
		margin-left: 8px;
		font-family: var(--font-sans, inherit);
		font-size: 13px;
		letter-spacing: 0;
		color: var(--soft);
	}
	.figures__label {
		font-size: 13px;
		color: var(--soft);
	}

	/* ── The label ────────────────────────────────────────────── */
	.quote {
		margin: clamp(56px, 7vw, 104px) 0 0;
	}
	.quote blockquote {
		margin: 0;
		font-family: var(--font-display);
		font-size: clamp(2.6rem, 7vw, 7.4rem);
		line-height: 0.92;
		letter-spacing: -0.045em;
		text-wrap: balance;
	}

	/* ── The making ───────────────────────────────────────────── */
	.steps {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: clamp(24px, 3vw, 44px);
		margin: clamp(40px, 5vw, 72px) 0 0;
		padding: 0;
		list-style: none;
	}
	.steps li {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding-top: 18px;
		border-top: 1px solid var(--rule);
	}
	.steps__no {
		font-size: 13px;
		color: var(--soft);
		font-variant-numeric: tabular-nums;
	}
	.steps h3 {
		margin: 0;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: clamp(1.4rem, 1.9vw, 1.8rem);
		line-height: 1.1;
		letter-spacing: -0.015em;
	}
	.steps p {
		font-size: 14px;
		line-height: 1.65;
		color: rgb(11 15 11 / 0.75);
	}

	/* ── Close ────────────────────────────────────────────────── */
	.close {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 26rem);
		grid-template-areas:
			'kicker kicker'
			'title side';
		align-items: end;
		column-gap: clamp(32px, 6vw, 96px);
		row-gap: 22px;
	}
	.close .kicker {
		grid-area: kicker;
	}
	.close__title {
		grid-area: title;
		margin: 0;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: clamp(2.6rem, 6.4vw, 6.8rem);
		line-height: 0.92;
		letter-spacing: -0.045em;
	}
	.close__title span {
		display: block;
	}
	.close__side {
		grid-area: side;
		display: flex;
		flex-direction: column;
		gap: 24px;
		font-size: 15px;
		line-height: 1.65;
		color: rgb(11 15 11 / 0.75);
	}
	.close__actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 24px;
		color: var(--ink);
	}

	/* ── Tablet ───────────────────────────────────────────────── */
	@media (max-width: 1100px) {
		.steps {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.ledger__row,
		.ledger--principles .ledger__row {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
		}
		.ledger__era {
			grid-column: 1 / -1;
		}
	}

	/* ── Phone ────────────────────────────────────────────────── */
	@media (max-width: 860px) {
		.toc ol {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.toc li:nth-child(odd) {
			border-left: 0;
		}
		.toc li:nth-child(odd) a {
			padding-left: 0;
		}
		.toc li:nth-child(n + 3) {
			border-top: 1px solid var(--rule);
		}
		.plate__frame {
			aspect-ratio: 4 / 3;
		}
		.opening__head,
		.head,
		.close {
			grid-template-columns: minmax(0, 1fr);
			grid-template-areas: 'kicker' 'title' 'lede';
		}
		.close {
			grid-template-areas: 'kicker' 'title' 'side';
		}
		.ledger__row,
		.ledger--principles .ledger__row {
			grid-template-columns: minmax(0, 1fr);
			gap: 10px;
		}
		.ledger__body {
			margin-top: 4px;
		}
		.coda,
		.fibre,
		.blend {
			grid-template-columns: minmax(0, 1fr);
		}
		.fibre__fig {
			position: relative;
			top: auto;
		}
		.fibre__frame {
			aspect-ratio: 1;
		}
		.steps {
			grid-template-columns: minmax(0, 1fr);
		}
		.terms__row {
			grid-template-columns: minmax(0, 1fr);
			gap: 4px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.opening__title > span > span {
			animation: none;
		}
	}
</style>
