<script lang="ts">
	/**
	 * The hero piece: the photograph, and — where the device can — the same
	 * photograph as a 3D cloth you can turn and touch (cloth-scene.ts).
	 *
	 * The entry is a race against a short deadline. If the 3D piece is ready
	 * within it, the photograph never shows and the cloth materialises in with
	 * its full entry (dissolve, tumble, bounce on the hanger). If not, the
	 * photograph makes its own, simpler entrance — in pure CSS, so it happens
	 * with no JavaScript at all — and the 3D piece fades in over it later,
	 * already at rest. Reduced motion skips the 3D and every entrance.
	 */
	import { onMount } from 'svelte';
	import type { ClothScene } from './cloth-scene';

	let { src, alt }: { src: string; alt: string } = $props();

	/** Must match the photograph's CSS animation-delay below. */
	const DEADLINE_MS = 1300;
	/** Let the headline start before the piece arrives. */
	const ENTRY_AFTER_MS = 450;

	let image: HTMLImageElement;
	let canvas: HTMLCanvasElement;
	/** The 3D piece has claimed the entrance; keep the photograph hidden. */
	let claimed = $state(false);
	let live = $state(false);

	onMount(() => {
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const probe = document.createElement('canvas');
		if (!probe.getContext('webgl2') && !probe.getContext('webgl')) return;

		const mountedAt = performance.now();
		let scene: ClothScene | null = null;
		let cancelled = false;

		const start = async () => {
			try {
				const { mountCloth } = await import('./cloth-scene');
				if (cancelled) return;

				const elapsed = performance.now() - mountedAt;
				const intro = elapsed < DEADLINE_MS - 150;
				if (intro) {
					claimed = true;
					const wait = ENTRY_AFTER_MS - elapsed;
					if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
					if (cancelled) return;
				}

				scene = await mountCloth(canvas, image, { intro });
				if (cancelled) return scene.destroy();
				await scene.ready;
				if (!cancelled) live = true;
			} catch (cause) {
				// Give the photograph back; the page loses nothing.
				claimed = false;
				console.warn('[cloth] 3D unavailable', cause);
			}
		};
		void start();

		return () => {
			cancelled = true;
			scene?.destroy();
		};
	});
</script>

<div class="cloth3d" class:cloth3d--claimed={claimed} class:cloth3d--live={live}>
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
