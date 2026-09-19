<script lang="ts">
	import DropCountdown from '$lib/DropCountdown.svelte';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	const campaignViews = [
		{
			index: '01',
			label: 'Front study',
			detail: 'Embroidered chest · oversized form',
			image: '/images/pineapple-haze-front.jpg',
			alt: 'Pineapple Haze hemp T-shirt worn from the front',
			alternateLabel: 'Back',
			alternateImage: '/images/pineapple-haze-back.jpg',
			alternateAlt: 'Pineapple Haze hemp T-shirt showing the back artwork'
		},
		{
			index: '02',
			label: 'Back study',
			detail: 'Tree artwork · numbered edition',
			image: '/images/pineapple-haze-back.jpg',
			alt: 'Pineapple Haze hemp T-shirt showing the back artwork',
			alternateLabel: 'Front',
			alternateImage: '/images/pineapple-haze-front.jpg',
			alternateAlt: 'Pineapple Haze hemp T-shirt worn from the front'
		},
		{
			index: '03',
			label: 'Worn study',
			detail: 'Unisex shape · made to soften',
			image: '/images/pineapple-haze-editorial.jpg',
			alt: 'Pineapple Haze hemp T-shirt styled in the campaign',
			alternateLabel: 'Back',
			alternateImage: '/images/pineapple-haze-editorial-back.jpg',
			alternateAlt: 'Pineapple Haze hemp T-shirt worn by the woman from the back'
		}
	];

	const specifications = [
		['Fibre', 'Hemp-cotton blend'],
		['Weight', '180 GSM'],
		['Fit', 'Relaxed oversized'],
		['Edition', '25 numbered pieces'],
		['Sizes', 'XS — XXL']
	];
</script>

<svelte:head>
	<title>Drop 01 — Pineapple Haze | Rootwear</title>
	<meta
		name="description"
		content="Discover Pineapple Haze, Rootwear's first limited hemp-led clothing drop."
	/>
	<meta name="theme-color" content="#faf9f5" />
</svelte:head>

<div class="collection-page">
	<header class="collection-header">
		<a class="collection-wordmark" href="/" aria-label="Rootwear home">ROOTWEAR</a>
		<div class="collection-header__drop">Drop 001 · The first growth</div>
		<a class="collection-header__back" href="/"
			>Back to the forest <span aria-hidden="true">↖</span></a
		>
	</header>

	<main>
		<DropCountdown serverNow={data.serverNow} />
		<section class="collection-intro" aria-labelledby="collection-title">
			<div class="collection-kicker">
				<span>New collection</span>
				<span>25 pieces · 2026</span>
			</div>

			<div class="collection-intro__grid">
				<h2 id="collection-title"><span>Pineapple</span><span>Haze.</span></h2>
				<div class="collection-intro__copy">
					<p>
						Our first growth: a tactile everyday uniform made with hemp-led fabric, quiet colour and
						a shape designed to gather character over time.
					</p>
					<div class="collection-price">
						<span>Pineapple Haze Tee</span>
						<strong>₹3,490</strong>
					</div>
				</div>
			</div>
		</section>

		<section class="collection-campaign" aria-label="Pineapple Haze campaign views">
			{#each campaignViews as view}
				<figure class="collection-card">
					<div class="collection-card__image">
						<div class="collection-card__transition">
							<img
								class="collection-face collection-face--primary"
								src={view.image}
								alt={view.alt}
							/>
							<img
								class="collection-face collection-face--alternate"
								src={view.alternateImage}
								alt={view.alternateAlt}
							/>
						</div>
						<span>{view.index}</span>
						<small>{view.label} ↔ {view.alternateLabel}</small>
					</div>
					<figcaption>
						<div>
							<strong>{view.label}</strong>
							<p>{view.detail}</p>
						</div>
						<span>₹3,490</span>
					</figcaption>
				</figure>
			{/each}
		</section>

		<section class="collection-piece" aria-labelledby="piece-title">
			<div class="collection-piece__story">
				<p>01 / The piece</p>
				<h2 id="piece-title">Grown, not manufactured.</h2>
			</div>

			<div class="collection-piece__details">
				<div class="collection-piece__heading">
					<div>
						<span>Drop 001</span>
						<h3>Pineapple Haze Tee</h3>
					</div>
					<strong>₹3,490</strong>
				</div>
				<p class="collection-piece__description">
					Cut loose through the body with a dropped shoulder and substantial hand-feel. Designed for
					repeat wear, small runs and a slower wardrobe.
				</p>

				<dl>
					{#each specifications as specification}
						<div>
							<dt>{specification[0]}</dt>
							<dd>{specification[1]}</dd>
						</div>
					{/each}
				</dl>

				<div class="collection-piece__note">
					<span>Release status</span>
					<strong>Drop 001 · limited to 25</strong>
				</div>
			</div>
		</section>
	</main>

	<footer class="collection-footer">
		<a class="collection-wordmark" href="/">ROOTWEAR</a>
		<p>Future-grown clothing. Grown, not made.</p>
		<a href="/">Return to the canopy ↑</a>
	</footer>
</div>

<style>
	.collection-page {
		min-height: 100vh;
		color: #173426;
		background: #faf9f5;
		color-scheme: light;
	}

	.collection-header {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 2rem;
		padding: 1.4rem clamp(1.25rem, 3vw, 3.5rem);
		font-size: 9px;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		border-bottom: 1px solid rgba(23, 52, 38, 0.2);
	}

	.collection-wordmark {
		font-family: Didot, 'Bodoni 72', 'Times New Roman', serif;
		font-size: 1.25rem;
		letter-spacing: 0.22em;
	}

	.collection-header__drop {
		color: rgba(23, 52, 38, 0.58);
	}

	.collection-header__back {
		justify-self: end;
		padding-bottom: 0.25rem;
		border-bottom: 1px solid currentColor;
	}

	.collection-intro {
		padding: clamp(4rem, 9vw, 9rem) clamp(1.25rem, 3vw, 3.5rem) clamp(3rem, 6vw, 6rem);
	}

	.collection-kicker {
		display: flex;
		justify-content: space-between;
		padding-bottom: 1rem;
		font-size: 9px;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		border-bottom: 1px solid rgba(23, 52, 38, 0.2);
	}

	.collection-intro__grid {
		display: grid;
		grid-template-columns: minmax(0, 1.45fr) minmax(18rem, 0.55fr);
		gap: clamp(3rem, 8vw, 9rem);
		align-items: end;
		padding-top: 2rem;
	}

	.collection-intro h2,
	.collection-piece h2 {
		margin: 0;
		font-family: Didot, 'Bodoni 72', 'Times New Roman', serif;
		font-weight: 400;
		letter-spacing: -0.07em;
	}

	.collection-intro h2 {
		font-size: clamp(5rem, 13vw, 14rem);
		line-height: 0.7;
	}

	.collection-intro h2 span {
		display: block;
	}

	.collection-intro h2 span + span {
		margin-top: 0.09em;
	}

	.collection-intro__copy > p {
		margin: 0;
		font-size: clamp(1rem, 1.4vw, 1.3rem);
		line-height: 1.55;
	}

	.collection-price {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		margin-top: 3rem;
		padding-top: 1rem;
		font-size: 10px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		border-top: 1px solid rgba(23, 52, 38, 0.25);
	}

	.collection-price strong {
		font-weight: 500;
	}

	.collection-campaign {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 1rem;
		padding: 0 clamp(1.25rem, 3vw, 3.5rem) clamp(5rem, 10vw, 10rem);
	}

	.collection-card {
		margin: 0;
	}

	.collection-card__image {
		position: relative;
		aspect-ratio: 4 / 5;
		overflow: hidden;
		background: #efede7;
	}

	.collection-card__transition {
		position: absolute;
		inset: 0;
	}

	.collection-face {
		position: absolute;
		inset: 0;
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		transition:
			opacity 600ms cubic-bezier(0.22, 1, 0.36, 1),
			transform 900ms cubic-bezier(0.16, 1, 0.3, 1);
		will-change: opacity, transform;
	}

	.collection-face--alternate {
		opacity: 0;
		transform: scale(1.025);
	}

	.collection-card:hover .collection-face--primary {
		opacity: 0;
		transform: scale(1.015);
	}

	.collection-card:hover .collection-face--alternate {
		opacity: 1;
		transform: scale(1);
	}

	.collection-card__image > span {
		position: absolute;
		top: 1rem;
		left: 1rem;
		display: grid;
		width: 2rem;
		height: 2rem;
		place-items: center;
		font-size: 8px;
		letter-spacing: 0.12em;
		color: #faf9f5;
		background: rgba(23, 52, 38, 0.78);
		border-radius: 50%;
	}

	.collection-card__image > small {
		position: absolute;
		right: 1rem;
		bottom: 1rem;
		z-index: 2;
		padding: 0.55rem 0.65rem;
		font-size: 7px;
		line-height: 1;
		letter-spacing: 0.12em;
		color: rgba(250, 249, 245, 0.88);
		text-transform: uppercase;
		background: rgba(23, 52, 38, 0.76);
		border: 1px solid rgba(250, 249, 245, 0.22);
		opacity: 0;
		transform: translateY(5px);
		transition:
			opacity 240ms ease,
			transform 240ms ease;
		-webkit-backdrop-filter: blur(6px);
		backdrop-filter: blur(6px);
	}

	.collection-card:hover .collection-card__image > small {
		opacity: 1;
		transform: translateY(0);
	}

	.collection-card figcaption {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem 0;
		border-bottom: 1px solid rgba(23, 52, 38, 0.2);
	}

	.collection-card figcaption strong,
	.collection-card figcaption > span {
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.collection-card figcaption p {
		margin: 0.45rem 0 0;
		font-size: 9px;
		letter-spacing: 0.08em;
		color: rgba(23, 52, 38, 0.56);
	}

	.collection-piece {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(22rem, 0.72fr);
		gap: clamp(4rem, 10vw, 12rem);
		padding: clamp(5rem, 10vw, 10rem) clamp(1.25rem, 3vw, 3.5rem);
		color: #f8f4e8;
		background-color: #173426;
		background-image:
			linear-gradient(90deg, rgba(13, 45, 31, 0.7), rgba(13, 45, 31, 0.84)),
			url('/images/rootwear-roots-backdrop.jpg');
		background-repeat: no-repeat;
		background-position:
			center,
			left center;
		background-size:
			cover,
			auto 82%;
	}

	.collection-piece__story > p,
	.collection-piece__heading span {
		margin: 0 0 2rem;
		font-size: 9px;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: rgba(248, 244, 232, 0.58);
	}

	.collection-piece h2 {
		max-width: 8ch;
		font-size: clamp(4rem, 8vw, 9rem);
		line-height: 0.78;
	}

	.collection-piece__details {
		align-self: end;
	}

	.collection-piece__heading {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 2rem;
		padding-bottom: 1.5rem;
		border-bottom: 1px solid rgba(248, 244, 232, 0.28);
	}

	.collection-piece__heading span {
		display: block;
		margin-bottom: 0.6rem;
	}

	.collection-piece__heading h3 {
		margin: 0;
		font-family: Didot, 'Bodoni 72', 'Times New Roman', serif;
		font-size: 2rem;
		font-weight: 400;
	}

	.collection-piece__heading strong {
		font-size: 0.8rem;
		font-weight: 400;
		letter-spacing: 0.12em;
	}

	.collection-piece__description {
		max-width: 38rem;
		margin: 2rem 0 3rem;
		font-size: 1rem;
		line-height: 1.7;
		color: rgba(248, 244, 232, 0.72);
	}

	.collection-piece dl {
		margin: 0;
	}

	.collection-piece dl > div {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.9rem 0;
		font-size: 10px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		border-top: 1px solid rgba(248, 244, 232, 0.16);
	}

	.collection-piece dd {
		margin: 0;
		color: rgba(248, 244, 232, 0.62);
	}

	.collection-piece__note {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		margin-top: 2rem;
		padding: 1.2rem;
		font-size: 9px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		border: 1px solid rgba(201, 165, 84, 0.6);
	}

	.collection-piece__note strong {
		font-weight: 500;
		color: #d6b76d;
	}

	.collection-footer {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 2rem;
		padding: 2rem clamp(1.25rem, 3vw, 3.5rem);
		font-size: 9px;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		border-top: 1px solid rgba(23, 52, 38, 0.2);
	}

	.collection-footer p {
		margin: 0;
		color: rgba(23, 52, 38, 0.6);
	}

	.collection-footer > a:last-child {
		justify-self: end;
	}

	@media (max-width: 900px) {
		.collection-header {
			grid-template-columns: 1fr auto;
		}

		.collection-header__drop {
			display: none;
		}

		.collection-intro__grid,
		.collection-piece {
			grid-template-columns: 1fr;
		}

		.collection-intro__grid {
			gap: 3rem;
		}

		.collection-piece {
			gap: 5rem;
			background-position:
				center,
				20% center;
			background-size:
				cover,
				auto 66%;
		}
	}

	@media (max-width: 680px) {
		.collection-header__back {
			font-size: 0;
		}

		.collection-header__back span {
			font-size: 1rem;
		}

		.collection-kicker {
			align-items: flex-end;
			gap: 1rem;
		}

		.collection-intro h2 {
			font-size: 24vw;
		}

		.collection-campaign {
			grid-template-columns: 1fr;
		}

		.collection-card figcaption {
			padding-bottom: 1.5rem;
		}

		.collection-piece__heading,
		.collection-piece__note {
			align-items: flex-start;
		}

		.collection-piece__note {
			flex-direction: column;
		}

		.collection-footer {
			grid-template-columns: 1fr;
			gap: 1rem;
		}

		.collection-footer > a:last-child {
			justify-self: start;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.collection-card__transition,
		.collection-card__image > small {
			transition: none;
		}
	}
</style>
