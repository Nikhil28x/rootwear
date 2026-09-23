<script lang="ts">
	/**
	 * The drop poster with the piece turning in front of it.
	 *
	 * ON THE ROTATION: this is a limited arc, not a full 360. A true revolve
	 * needs a back-facing cutout, and the only back image in the catalogue is
	 * an editorial shot of a model rather than a garment on transparency —
	 * spinning the front cutout all the way round would show it vanish edge-on
	 * and return mirrored, with the chest script reversed. The arc reads as the
	 * piece turning on a plinth and never promises a face we do not have.
	 * Swapping in a back cutout later is a second <img> and a 180deg face.
	 *
	 * The shadow is driven by the same timing, so it flattens as the garment
	 * turns away rather than sitting under it as a static blob.
	 */
	let {
		poster = '/images/pineapple-haze-poster.jpg',
		posterAlt = 'Rootwear Drop 01 poster: botanical pineapple studies on deep green, with the line “Grown, Not Manufactured”.',
		piece = '/images/pineapple-haze-shirt-cutout.png',
		pieceAlt = 'The Pineapple Haze tee, hemp-cotton waffle with the chest script and the tree mark.'
	}: { poster?: string; posterAlt?: string; piece?: string; pieceAlt?: string } = $props();
</script>

<figure class="poster-showcase">
	<div class="poster-showcase__frame">
		<img class="poster-showcase__poster" src={poster} alt={posterAlt} loading="lazy" />

		<div class="poster-showcase__stage" aria-hidden="true">
			<span class="poster-showcase__shadow"></span>
			<img class="poster-showcase__piece" src={piece} alt="" loading="lazy" />
		</div>
	</div>

	<!-- The piece is decorative inside the stage, so its description lives here
	     where it is announced once rather than twice. -->
	<figcaption class="sr-only">{pieceAlt}</figcaption>
</figure>

<style>
	.poster-showcase {
		margin: 0;
	}

	.poster-showcase__frame {
		position: relative;
		overflow: hidden;
		aspect-ratio: 810 / 1013;
		/* The poster's own ground, so the frame and the band it sits on are the
		   same green and the seam between them disappears. */
		background: var(--color-poster);
	}

	.poster-showcase__poster {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.poster-showcase__stage {
		position: absolute;
		/* Sits above the poster's centre so the gold line at the foot stays read. */
		top: 6%;
		left: 50%;
		width: 74%;
		height: 62%;
		transform: translateX(-50%);
		/* The depth the rotation is read through. Without it the turn is a
		   flat horizontal squash rather than a garment moving in space. */
		perspective: 1100px;
	}

	.poster-showcase__piece {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: contain;
		transform-origin: 50% 55%;
		animation: piece-turn 14s cubic-bezier(0.45, 0, 0.55, 1) infinite;
		filter: drop-shadow(0 18px 26px rgba(0, 0, 0, 0.34));
	}

	.poster-showcase__shadow {
		position: absolute;
		bottom: -4%;
		left: 50%;
		width: 46%;
		height: 3.5%;
		border-radius: 50%;
		background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0.5), transparent 70%);
		transform: translateX(-50%);
		animation: piece-shadow 14s cubic-bezier(0.45, 0, 0.55, 1) infinite;
	}

	@keyframes piece-turn {
		0% {
			transform: rotateY(-26deg);
		}
		50% {
			transform: rotateY(26deg);
		}
		100% {
			transform: rotateY(-26deg);
		}
	}

	/* Widest when the garment faces us, narrowest at the extremes of the turn. */
	@keyframes piece-shadow {
		0%,
		100% {
			opacity: 0.55;
			transform: translateX(-50%) scaleX(0.82);
		}
		50% {
			opacity: 0.55;
			transform: translateX(-50%) scaleX(0.82);
		}
		25%,
		75% {
			opacity: 0.8;
			transform: translateX(-50%) scaleX(1);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.poster-showcase__piece,
		.poster-showcase__shadow {
			animation: none;
		}

		/* Held at a slight angle so it still reads as a staged object. */
		.poster-showcase__piece {
			transform: rotateY(-10deg);
		}
	}
</style>
