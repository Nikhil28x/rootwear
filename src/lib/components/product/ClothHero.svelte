<script lang="ts">
	/**
	 * The hero piece: the photograph, and — where the device can — the same
	 * photograph as a 3D cloth you can turn and touch (cloth-scene.ts).
	 *
	 * On a device that can draw it, the 3D piece claims the entrance the moment
	 * the page hydrates: the photograph stays hidden and the cloth materialises
	 * with its full entry (dissolve, tumble, bounce on the hanger) — the photo
	 * never shows first. Only if the 3D is not ready within FALLBACK_MS (a very
	 * slow connection) or fails does the photograph make its own entrance, and
	 * the 3D fades in over it later, at rest. Without JavaScript the photograph
	 * enters in pure CSS. Reduced motion skips the 3D and every entrance.
	 */
	import { onMount } from 'svelte';
	// Loaded with the page, not after it: the 3D starts the moment the page hydrates.
	import { mountCloth, type ClothScene } from './cloth-scene';

	let { src, alt }: { src: string; alt: string } = $props();

	/** How long the 3D may take before the photograph is shown instead. */
	const FALLBACK_MS = 5000;

	let image: HTMLImageElement;
	let canvas: HTMLCanvasElement;
	/** The 3D piece has claimed the entrance; keep the photograph hidden. */
	let claimed = $state(false);
	let live = $state(false);
	/** No 3D coming (or not in time): show the photograph now. */
	let photo = $state(false);

	onMount(() => {
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			photo = true;
			return;
		}
		const probe = document.createElement('canvas');
		if (!probe.getContext('webgl2') && !probe.getContext('webgl')) {
			photo = true;
			return;
		}

		let scene: ClothScene | null = null;
		let cancelled = false;

		// Claim now, before anything loads, so the photograph never flashes in.
		claimed = true;
		const fallback = setTimeout(() => {
			if (!live) {
				claimed = false;
				photo = true;
			}
		}, FALLBACK_MS);

		const start = async () => {
			try {
				// Still claimed: the full entrance. Timed out: fade in at rest over the photo.
				const intro = claimed;

				scene = await mountCloth(canvas, image, { intro });
				if (cancelled) return scene.destroy();
				await scene.ready;
				if (!cancelled) live = true;
				clearTimeout(fallback);
			} catch (cause) {
				clearTimeout(fallback);
				// Give the photograph back; the page loses nothing.
				claimed = false;
				photo = true;
				console.warn('[cloth] 3D unavailable', cause);
			}
		};
		void start();

		return () => {
			clearTimeout(fallback);
			cancelled = true;
			scene?.destroy();
		};
	});
</script>

<div
	class="cloth3d"
	class:cloth3d--claimed={claimed}
	class:cloth3d--live={live}
	class:cloth3d--photo={photo}
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
		/* The photograph's own entrance, held back by the deadline. */
		animation: photo-in 1s cubic-bezier(0.2, 0.7, 0.2, 1) 1.3s both;
		transition: opacity 0.7s ease;
	}
	@keyframes photo-in {
		from {
			opacity: 0;
			transform: translateY(-5%) scale(0.95);
		}
	}
	/*
	 * With scripts, the photograph waits: the 3D piece may claim the entrance
	 * once the page hydrates, and the photo must not flash in before it. The
	 * long delay is only a safety net if scripts never run; the component
	 * releases the photo at once when there will be no 3D (.cloth3d--photo).
	 */
	:global(.js) .cloth3d img {
		animation-delay: 6s;
	}
	:global(.js) .cloth3d--photo img {
		animation-delay: 0s;
	}
	.cloth3d--claimed img,
	.cloth3d--live img {
		animation: none;
		opacity: 0;
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
	/* A late 3D piece cross-fades over the photograph; an entering one is drawn in by its dissolve. */
	.cloth3d--live canvas {
		opacity: 1;
		pointer-events: auto;
		cursor: grab;
		transition: opacity 0.7s ease;
	}
	.cloth3d--claimed.cloth3d--live canvas {
		transition: none;
	}

	@media (prefers-reduced-motion: reduce) {
		.cloth3d img {
			animation: none;
		}
	}
</style>
