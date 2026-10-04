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
	import type { ClothScene } from './cloth-scene';

	let { src, alt }: { src: string; alt: string } = $props();

	let image: HTMLImageElement;
	let canvas: HTMLCanvasElement;
	let stage = $state<'waiting' | 'photo' | 'cloth'>('waiting');

	onMount(() => {
		let cancelled = false;
		let scene: ClothScene | null = null;

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
					scene = await mountCloth(canvas, image, { intro: 'puff' });
					if (cancelled) return scene.destroy();
					await scene.ready;
					await entrance;
					if (cancelled) return;
					stage = 'cloth';
					scene.reveal();
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
>
	<img bind:this={image} {src} {alt} fetchpriority="high" decoding="async" />
	<canvas bind:this={canvas} aria-hidden="true"></canvas>
</div>

<style>
	.cloth3d {
		position: relative;
	}
	.cloth3d img {
		display: block;
		width: 100%;
		height: auto;
		/* Holds the piece's place before the photograph has a size of its own. */
		aspect-ratio: auto 1152 / 1366;
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
	:global(.js) .cloth3d img {
		animation: none;
		opacity: 0;
	}
	/* The photograph's entrance: a soft inhale, a touch past full. */
	:global(.js) .cloth3d--photo img {
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
		opacity: 0;
		transition: opacity 0s linear 0.1s;
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
		cursor: grab;
	}

	@media (prefers-reduced-motion: reduce) {
		.cloth3d img,
		:global(.js) .cloth3d--photo img {
			animation: none;
		}
	}
</style>
