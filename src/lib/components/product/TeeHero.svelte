<script lang="ts">
	/**
	 * The hero tee, front and back, as a real 3D garment where the device can
	 * carry it (tee3d/garment.ts).
	 *
	 * Seamless by construction: while three.js and the model load, what shows
	 * is a poster that IS the 3D scene's first frame (rendered once, offline,
	 * from this same code). The scene mounts held on exactly that frame, the
	 * canvas replaces the poster pixel for pixel, and only then does the tee
	 * start to move. The poster shows from the first paint wherever scripts
	 * run and motion is welcome (the `.js` class is set before paint).
	 *
	 * Without scripts or WebGL, with reduced motion, or on a device that
	 * cannot hold the frame rate, the studio photographs show instead, and
	 * Front / Back cross-fades between the two shots.
	 */
	import { onMount, tick } from 'svelte';
	import { dev } from '$app/environment';
	import type { TeeShots } from '$lib/drop/tee-shots';
	import type { Side } from './tee3d';

	let { shots }: { shots: TeeShots } = $props();

	let wrapper: HTMLElement;
	let frontImage: HTMLImageElement;
	let backImage: HTMLImageElement;
	let canvas = $state<HTMLCanvasElement>();
	/** poster: waiting on the 3D; tee: the canvas is live; flat: the photographs. */
	let stage = $state<'poster' | 'tee' | 'flat'>('poster');
	let side = $state<Side>('front');
	let scene: { face(side: Side): void; reveal(): void; snapshot(): string; destroy(): void } | null =
		null;

	const sizes = '(max-width: 860px) 58vw, 560px';
	const srcset = (small: string, large: string) => `${small} 640w, ${large} 1024w`;
	const posterSizes = '(max-width: 860px) 100vw, 860px';

	/** Two frames: the canvas has painted before the poster goes. */
	const painted = () =>
		new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

	onMount(() => {
		const probe = document.createElement('canvas');
		const capable =
			!window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
			!!(probe.getContext('webgl2') || probe.getContext('webgl'));
		if (!capable) {
			stage = 'flat';
			return;
		}
		// Dev only: ?tee-poster holds the first frame and exposes it, to (re)make the poster.
		const makingPoster = dev && new URL(location.href).searchParams.has('tee-poster');

		let cancelled = false;
		(async () => {
			await tick();
			if (!canvas) return;
			try {
				const { mountGarment } = await import('./tee3d');
				if (cancelled) return;
				const mounted = await mountGarment(canvas, frontImage, backImage, {
					hold: true,
					scrollAnchor: wrapper.closest('section'),
					onSide: (next) => (side = next),
					onFallback: () => {
						stage = 'flat';
						scene?.destroy();
						scene = null;
					}
				});
				if (cancelled) return mounted.destroy();
				scene = mounted;
				await mounted.ready;
				if (cancelled || scene !== mounted) return;
				stage = 'tee';
				if (makingPoster) {
					(window as unknown as { __teeSnapshot: () => string }).__teeSnapshot = () =>
						mounted.snapshot();
					return;
				}
				await painted();
				mounted.reveal();
			} catch (cause) {
				console.warn('[tee] 3D unavailable', cause);
				if (!cancelled) stage = 'flat';
			}
		})();
		return () => {
			cancelled = true;
			scene?.destroy();
			scene = null;
		};
	});

	function show(next: Side) {
		side = next;
		scene?.face(next);
	}
</script>

<div class="tee tee--{stage}" bind:this={wrapper}>
	<!-- The photographs: the layout's size, and the fallback. -->
	<div class="tee__photos" data-side={side}>
		<img
			bind:this={frontImage}
			class="tee__front"
			src={shots.front}
			srcset={srcset(shots.frontSmall, shots.front)}
			{sizes}
			alt={shots.alt}
			width={shots.width}
			height={shots.height}
			decoding="async"
			draggable="false"
		/>
		<img
			bind:this={backImage}
			class="tee__back"
			src={shots.back}
			srcset={srcset(shots.backSmall, shots.back)}
			{sizes}
			alt=""
			width={shots.width}
			height={shots.height}
			decoding="async"
			draggable="false"
		/>
	</div>
	<!-- The 3D scene's first frame, in the canvas's exact box. -->
	<img
		class="tee__poster"
		src={shots.poster}
		srcset="{shots.posterSmall} 800w, {shots.poster} 1600w"
		sizes={posterSizes}
		alt=""
		fetchpriority="high"
		decoding="async"
		draggable="false"
	/>
	{#if stage !== 'flat'}<canvas bind:this={canvas} aria-hidden="true"></canvas>{/if}
	<!-- While the 3D loads: a sheen sweeps the poster, cut to the tee's own outline. -->
	<span class="tee__sheen" style="--poster: url({shots.posterSmall})" aria-hidden="true"></span>

	<div class="tee__sides" role="group" aria-label="Show the piece">
		<button type="button" aria-pressed={side === 'front'} onclick={() => show('front')}>Front</button>
		<button type="button" aria-pressed={side === 'back'} onclick={() => show('back')}>Back</button>
	</div>
</div>

<style>
	.tee {
		position: relative;
		/* The piece is handled, not read: no selection, no image drag, no tap flash. */
		-webkit-user-select: none;
		user-select: none;
		-webkit-touch-callout: none;
		-webkit-tap-highlight-color: transparent;
	}
	.tee img,
	.tee canvas {
		-webkit-user-drag: none;
	}
	.tee canvas::selection,
	.tee img::selection {
		background: transparent;
	}
	.tee__photos {
		position: relative;
		filter: drop-shadow(0 40px 50px rgb(0 0 0 / 0.55));
	}
	.tee__photos img {
		display: block;
		width: 100%;
		height: auto;
		transition:
			opacity 0.45s ease,
			transform 0.6s cubic-bezier(0.2, 0.7, 0.2, 1);
	}
	.tee__back {
		position: absolute;
		inset: 0;
		opacity: 0;
		transform: scaleX(0.92);
	}
	.tee__photos[data-side='back'] .tee__back {
		opacity: 1;
		transform: none;
	}
	.tee__photos[data-side='back'] .tee__front {
		opacity: 0;
		transform: scaleX(0.92);
	}

	/* The canvas and the poster share one box: larger than the photo on every side. */
	canvas,
	.tee__sheen,
	.tee__poster {
		position: absolute;
		left: -26%;
		top: -24%;
		width: 152%;
		height: 160%;
	}
	.tee__poster {
		display: none;
		/* The reset caps images at 100%; the poster must fill the canvas's wider box exactly. */
		max-width: none;
		object-fit: fill;
		pointer-events: none;
	}
	canvas {
		visibility: hidden;
		pointer-events: none;
		touch-action: pan-y;
	}

	/*
	 * The sheen: a soft band of light crossing the piece, masked by the poster's
	 * own alpha so it only lights the cloth. It waits a beat (a fast load never
	 * shows it) and fades the moment the 3D takes over.
	 */
	.tee__sheen {
		display: none;
		pointer-events: none;
		-webkit-mask: var(--poster) center / 100% 100% no-repeat;
		mask: var(--poster) center / 100% 100% no-repeat;
		background: linear-gradient(
			105deg,
			transparent 30%,
			rgb(255 240 214 / 0.14) 45%,
			rgb(255 246 230 / 0.3) 50%,
			rgb(255 240 214 / 0.14) 55%,
			transparent 70%
		);
		background-size: 300% 100%;
		mix-blend-mode: screen;
		opacity: 0;
	}

	/* Scripts and motion: the poster from the first paint, photos held for layout only. */
	@media (prefers-reduced-motion: no-preference) {
		:global(.js) .tee--poster .tee__poster {
			display: block;
		}
		:global(.js) .tee--poster .tee__sheen,
		:global(.js) .tee--tee .tee__sheen {
			display: block;
		}
		:global(.js) .tee--poster .tee__sheen {
			animation:
				tee-sheen-in 0.4s ease 0.45s forwards,
				tee-sheen 1.7s cubic-bezier(0.45, 0, 0.25, 1) 0.45s infinite;
		}
		/* The hand-off: one last bright pass as the 3D comes alive, then gone. */
		:global(.js) .tee--tee .tee__sheen {
			animation: tee-sheen-out 0.7s ease forwards;
			background-position: 0% 0;
		}
		:global(.js) .tee--poster .tee__photos,
		:global(.js) .tee--tee .tee__photos {
			visibility: hidden;
		}
	}
	/* Live: the canvas, exactly where the poster was. No fade — they are the same frame. */
	.tee--tee canvas {
		visibility: visible;
		pointer-events: auto;
		cursor: grab;
	}

	@keyframes tee-sheen {
		from {
			background-position: 100% 0;
		}
		to {
			background-position: 0% 0;
		}
	}
	@keyframes tee-sheen-in {
		to {
			opacity: 1;
		}
	}
	@keyframes tee-sheen-out {
		from {
			opacity: 1;
		}
		to {
			opacity: 0;
		}
	}

	.tee__sides {
		position: absolute;
		left: 50%;
		bottom: -30%;
		transform: translateX(-50%);
		display: flex;
		gap: 2px;
		padding: 3px;
		border-radius: 999px;
		background: rgb(255 255 255 / 0.08);
		backdrop-filter: blur(8px);
		z-index: 2;
	}
	.tee__sides button {
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
	.tee__sides button[aria-pressed='true'] {
		color: #111;
		background: rgb(255 255 255 / 0.92);
	}
	.tee__sides button:focus-visible {
		outline: 2px solid currentColor;
		outline-offset: 2px;
	}

	@media (max-width: 760px) {
		.tee__sides {
			bottom: -42%;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.tee__photos img {
			transition: opacity 0.2s linear;
			transform: none !important;
		}
	}
</style>
