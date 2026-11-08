<script lang="ts">
	/**
	 * The hero piece: the photograph, and — where the device can — the same
	 * photograph as a 3D cloth you can turn and touch (cloth-scene.ts).
	 *
	 * The photograph always comes first: it shows the moment it loads. When
	 * three.js arrives, the cloth takes its place as a flat card exactly where
	 * the photo sits, then inflates from the chest outward — the photo itself seems to fill with air
	 * (the 'puff' entrance in cloth-scene.ts). three.js is imported
	 * dynamically, so it never holds up hydration or the photograph. Without
	 * JavaScript the photograph enters in pure CSS. Reduced motion skips the
	 * 3D and every entrance.
	 */
	import { onMount, tick } from 'svelte';
	import type { ClothMaps, ClothScene } from './cloth-scene';

	/**
	 * With a back photograph the piece shows one face at a time: a Front /
	 * Back toggle turns the cloth round (never the hand — see cloth-scene's
	 * face()). Without 3D, the toggle cross-fades between the two photographs.
	 */
	let {
		src,
		alt,
		width = 1152,
		height = 1366,
		back = null,
		maps = null
	}: {
		src: string;
		alt: string;
		width?: number;
		height?: number;
		back?: { src: string; alt: string } | null;
		maps?: ClothMaps | null;
	} = $props();

	let image: HTMLImageElement;
	let backImage = $state<HTMLImageElement>();
	let canvas: HTMLCanvasElement;
	let stage = $state<'waiting' | 'photo' | 'cloth'>('waiting');
	let side = $state<'front' | 'back'>('front');
	let scene: ClothScene | null = null;

	function show(next: 'front' | 'back') {
		side = next;
		scene?.face(next);
	}

	onMount(() => {
		let cancelled = false;

		const loaded =
			image.complete && image.naturalWidth
				? Promise.resolve()
				: new Promise<void>((resolve, reject) => {
						image.addEventListener('load', () => resolve(), { once: true });
						image.addEventListener('error', () => reject(new Error('image failed')), {
							once: true
						});
					});

		const probe = document.createElement('canvas');
		const can3d =
			!window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
			!!(probe.getContext('webgl2') || probe.getContext('webgl'));

		if (!can3d) {
			loaded.then(
				() => !cancelled && (stage = 'photo'),
				() => {}
			);
			return () => (cancelled = true);
		}

		// Fetch three.js now, in parallel with the photograph.
		const moduleReady = import('./cloth-scene');
		moduleReady.catch(() => {});

		loaded.then(
			async () => {
				if (cancelled) return;
				stage = 'photo';
				await tick();
				// The cloth must not cut into the photo's entrance mid-blur.
				const entrance = Promise.all(image.getAnimations().map((a) => a.finished)).catch(
					() => {}
				);
				try {
					const { mountCloth } = await moduleReady;
					if (cancelled) return;
					const mounted = await mountCloth(canvas, image, {
						intro: 'puff',
						back: backImage ?? null,
						maps
					});
					if (cancelled) return mounted.destroy();
					scene = mounted;
					await mounted.ready;
					await entrance;
					if (cancelled) return;
					stage = 'cloth';
					mounted.reveal();
					// Toggled to the back while the 3D was loading: turn round now.
					if (side === 'back') mounted.face('back');
				} catch (cause) {
					// Give the photograph back; the page loses nothing.
					if (!cancelled) stage = 'photo';
					console.warn('[cloth] 3D unavailable', cause);
				}
			},
			() => {}
		);

		return () => {
			cancelled = true;
			scene?.destroy();
		};
	});
</script>

<div
	class="cloth3d"
	class:cloth3d--photo={stage === 'photo'}
	class:cloth3d--cloth={stage === 'cloth'}
	data-side={side}
>
	<img
		bind:this={image}
		class="cloth3d__front"
		{src}
		{alt}
		style="--w: {width}; --h: {height}"
		fetchpriority="high"
		decoding="async"
		draggable="false"
	/>
	{#if back}
		<img
			bind:this={backImage}
			class="cloth3d__back"
			src={back.src}
			alt={back.alt}
			decoding="async"
			draggable="false"
		/>
	{/if}
	<canvas bind:this={canvas} aria-hidden="true"></canvas>

	{#if back}
		<div class="cloth3d__sides" role="group" aria-label="Show the piece">
			<button type="button" aria-pressed={side === 'front'} onclick={() => show('front')}>Front</button>
			<button type="button" aria-pressed={side === 'back'} onclick={() => show('back')}>Back</button>
		</div>
	{/if}
</div>

<style>
	.cloth3d {
		position: relative;
		/* The piece is handled, not read: no selection, no image drag, no tap flash. */
		-webkit-user-select: none;
		user-select: none;
		-webkit-touch-callout: none;
		-webkit-tap-highlight-color: transparent;
	}
	.cloth3d img {
		-webkit-user-drag: none;
	}
	.cloth3d__front {
		display: block;
		width: 100%;
		height: auto;
		/* Holds the piece's place before the photograph has a size of its own. */
		aspect-ratio: auto var(--w) / var(--h);
		/* Without scripts, the photograph makes its own entrance. */
		animation: photo-in 1s cubic-bezier(0.2, 0.7, 0.2, 1) 1.3s both;
	}
	@keyframes photo-in {
		from {
			opacity: 0;
			transform: translateY(-5%) scale(0.95);
		}
	}

	/* ---- With scripts, the stages take over. */
	:global(.js) .cloth3d__front {
		animation: none;
		opacity: 0;
	}
	/* The photograph's entrance: a soft inhale, a touch past full. */
	:global(.js) .cloth3d--photo .cloth3d__front {
		opacity: 1;
		animation: photo-puff 0.75s cubic-bezier(0.3, 0.7, 0.25, 1) both;
	}
	@keyframes photo-puff {
		from {
			opacity: 0;
			transform: scale(0.93);
			filter: blur(8px);
		}
		60% {
			opacity: 1;
			transform: scale(1.015);
			filter: blur(0);
		}
	}
	/* The cloth, flat, is pixel for pixel the photo: swap, no fade, once it has painted. */
	:global(.js) .cloth3d--cloth img {
		opacity: 0 !important;
		transition: opacity 0s linear 0.1s;
	}

	/*
	 * The back photograph: the same frame as the front, hidden until asked for.
	 * Without 3D, the toggle cross-fades between them with a slight turn.
	 */
	.cloth3d__back {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		opacity: 0;
		transform: scaleX(0.9);
		transition:
			opacity 0.45s ease,
			transform 0.6s cubic-bezier(0.2, 0.7, 0.2, 1);
	}
	.cloth3d--photo[data-side='back'] .cloth3d__back {
		opacity: 1;
		transform: none;
	}
	:global(.js) .cloth3d--photo[data-side='back'] .cloth3d__front {
		opacity: 0;
		transform: scaleX(0.9);
		transition:
			opacity 0.45s ease,
			transform 0.6s cubic-bezier(0.2, 0.7, 0.2, 1);
	}

	/* Larger than the image on every side, so the piece can turn without clipping. */
	.cloth3d canvas {
		position: absolute;
		left: -24%;
		top: -14%;
		width: 148%;
		height: 128%;
		opacity: 0;
		pointer-events: none;
		touch-action: pan-y;
	}
	.cloth3d--cloth canvas {
		opacity: 1;
		pointer-events: auto;
	}

	/* Front / Back: the only way the piece turns. */
	.cloth3d__sides {
		position: absolute;
		left: 50%;
		/* Just under the hem. */
		top: calc(100% + 10px);
		transform: translateX(-50%);
		display: flex;
		gap: 2px;
		padding: 3px;
		border-radius: 999px;
		background: rgb(255 255 255 / 0.08);
		backdrop-filter: blur(8px);
		z-index: 2;
	}
	.cloth3d__sides button {
		font: inherit;
		font-size: 12px;
		letter-spacing: 0.04em;
		color: rgb(255 255 255 / 0.7);
		padding: 6px 14px;
		border-radius: 999px;
		background: none;
		border: 0;
		cursor: pointer;
	}
	.cloth3d__sides button[aria-pressed='true'] {
		color: #111;
		background: rgb(255 255 255 / 0.92);
	}
	.cloth3d__sides button:focus-visible {
		outline: 2px solid currentColor;
		outline-offset: 2px;
	}

	@media (prefers-reduced-motion: reduce) {
		.cloth3d__front,
		:global(.js) .cloth3d--photo .cloth3d__front {
			animation: none;
		}
		.cloth3d__back,
		:global(.js) .cloth3d--photo[data-side='back'] .cloth3d__front {
			transform: none;
		}
	}
</style>
