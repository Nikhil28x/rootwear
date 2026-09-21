<script lang="ts">
	import { onMount } from 'svelte';
	import { DROP_LAUNCH, GROWTH_STAGES, getDropState } from './drop-timeline';

	let { serverNow }: { serverNow: number } = $props();
	let clockNow = $state<number | null>(null);
	let motionEnabled = $state(false);
	let now = $derived(clockNow ?? serverNow);
	let growth = $derived(getDropState(now));
	const launchDate = new Intl.DateTimeFormat('en-IN', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		timeZone: 'Asia/Kolkata'
	}).format(DROP_LAUNCH);
	const launchTime = new Intl.DateTimeFormat('en-IN', {
		hour: 'numeric',
		minute: '2-digit',
		hour12: true,
		timeZone: 'Asia/Kolkata'
	}).format(DROP_LAUNCH);
	const pad = (number: number) => String(number).padStart(2, '0');

	onMount(() => {
		const serverOffset = serverNow - Date.now();
		const tick = () => {
			clockNow = Date.now() + serverOffset;
		};
		const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
		const updateMotion = () => {
			motionEnabled = !motion.matches;
		};
		updateMotion();
		const timer = window.setInterval(tick, 1000);
		document.addEventListener('visibilitychange', tick);
		motion.addEventListener('change', updateMotion);
		return () => {
			clearInterval(timer);
			document.removeEventListener('visibilitychange', tick);
			motion.removeEventListener('change', updateMotion);
		};
	});

	// Reveal only today's growth, then return to the matching high-resolution still.
	function playChapter(video: HTMLVideoElement) {
		let disposed = false;
		let started = false;
		const hide = () => {
			video.style.opacity = '0';
		};
		const show = () => {
			if (!disposed) video.style.opacity = '1';
		};
		const play = () => {
			if (started || disposed) return;
			started = true;
			video.playbackRate = 0.5;
			void video.play().catch(hide);
		};
		video.addEventListener('loadeddata', play);
		video.addEventListener('playing', show);
		video.addEventListener('ended', hide);
		video.addEventListener('error', hide);
		if (video.readyState >= 2) play();
		return {
			destroy() {
				disposed = true;
				video.pause();
				video.removeEventListener('loadeddata', play);
				video.removeEventListener('playing', show);
				video.removeEventListener('ended', hide);
				video.removeEventListener('error', hide);
			}
		};
	}
</script>

<section class="drop-countdown" aria-labelledby="growth-title">
	<div class="growth-intro">
		<p class="eyebrow">Pineapple Haze</p>
		<h1 id="growth-title">Drop<br />001.</h1>
		<p class="growth-explanation" id="growth-explanation">
			{growth.launched
				? 'Pineapple Haze is here. A limited release of 25 numbered hemp-cotton pieces.'
				: 'A limited release of 25 numbered hemp-cotton pieces, arriving at full growth.'}
		</p>
	</div>

	<figure class="growth-scene" aria-describedby="growth-explanation">
		<img
			src={`/images/drop-growth/hd/stage-${growth.stageIndex}-1920.webp`}
			srcset={`/images/drop-growth/hd/stage-${growth.stageIndex}-960.webp 960w, /images/drop-growth/hd/stage-${growth.stageIndex}-1920.webp 1920w, /images/drop-growth/hd/stage-${growth.stageIndex}-3840.webp 3840w`}
			sizes="(max-width: 760px) 180vw, max(60vw, 1680px)"
			width="3840"
			height="1600"
			fetchpriority="high"
			alt={`${growth.stage.label}: the plant in our misty forest, at stage ${growth.stageIndex + 1} of ${GROWTH_STAGES.length} on its journey to the Pineapple Haze launch`}
		/>
		{#if motionEnabled && growth.stageIndex > 0}
			{#key growth.stageIndex}
				<video
					use:playChapter
					src={`/video/drop-growth/hd/stage-${growth.stageIndex}.mp4`}
					muted
					playsinline
					preload="auto"
					aria-hidden="true"
					tabindex="-1"
				></video>
			{/key}
		{/if}
	</figure>

	<div class="launch-panel">
		{#if !growth.launched}
			<div
				class="countdown-digits"
				role="timer"
				aria-label="Time until Drop 001 launches"
				aria-live="off"
			>
				{#each [[growth.days, 'Days'], [growth.hours, 'Hours'], [growth.minutes, 'Minutes']] as [value, label]}
					<div><strong>{pad(Number(value))}</strong><span>{label}</span></div>
				{/each}
			</div>
		{/if}
		<p class="launch-date">
			<time datetime={new Date(DROP_LAUNCH).toISOString()}
				>{launchDate} · {launchTime.toUpperCase()} IST</time
			>
		</p>
		<a class="drop-link" href="#collection-title">
			Explore the drop<span aria-hidden="true">↗</span>
		</a>
	</div>
</section>

<style>
	.drop-countdown {
		display: grid;
		grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.3fr);
		grid-template-rows: 1fr 1fr;
		grid-template-areas: 'intro scene' 'launch scene';
		min-height: clamp(580px, 72svh, 740px);
		color: #f6efdd;
		background: #12251b;
	}
	.growth-intro {
		grid-area: intro;
		align-self: end;
		padding: 4rem clamp(2rem, 5vw, 6rem) 0;
	}
	.eyebrow {
		font-size: 9px;
		line-height: 1.6;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: #b6c0b3;
	}
	.growth-intro h1 {
		margin: 1.5rem 0 1.25rem;
		font-family: Didot, 'Bodoni 72', 'Times New Roman', serif;
		font-size: clamp(3rem, 4.5vw, 5.25rem);
		font-weight: 400;
		line-height: 1.02;
		letter-spacing: -0.045em;
	}
	.growth-explanation {
		max-width: 31ch;
		font-size: 13px;
		line-height: 1.8;
		text-wrap: pretty;
		color: #b6c0b3;
	}
	.launch-panel {
		grid-area: launch;
		align-self: start;
		padding: 2.5rem clamp(2rem, 5vw, 6rem) 4rem;
	}
	.countdown-digits {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 1.5rem;
		max-width: 245px;
		margin-bottom: 1.5rem;
	}
	.countdown-digits strong {
		display: block;
		font-size: 2.1rem;
		font-weight: 300;
		line-height: 1;
		letter-spacing: -0.035em;
		font-variant-numeric: tabular-nums;
	}
	.countdown-digits span {
		display: block;
		margin-top: 0.5rem;
		font-size: 8px;
		line-height: 1.5;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: #b6c0b3;
	}
	.launch-date {
		font-size: 10px;
		line-height: 1.8;
		color: #b6c0b3;
	}
	.drop-link {
		display: inline-flex;
		align-items: center;
		gap: 1.5rem;
		margin-top: 2rem;
		padding: 0.4rem 0;
		border-bottom: 1px solid #f6efdd50;
		font-size: 11px;
		line-height: 1.5;
		transition:
			color 180ms ease,
			border-color 180ms ease;
	}
	.drop-link:hover {
		color: #d6b76d;
		border-color: currentColor;
	}
	.drop-link > span {
		font-size: 16px;
	}
	.growth-scene {
		grid-area: scene;
		position: relative;
		min-width: 0;
		margin: 0;
		overflow: hidden;
		background: #101a14;
	}
	.growth-scene > img,
	.growth-scene > video {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center;
	}
	.growth-scene > video {
		opacity: 0;
		transition: opacity 300ms ease;
	}
	@media (min-width: 761px) and (max-width: 1020px) {
		.drop-countdown {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
		}
		.growth-intro,
		.launch-panel {
			padding-left: 2rem;
			padding-right: 2rem;
		}
	}
	@media (max-width: 760px) {
		.drop-countdown {
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: auto auto auto;
			grid-template-areas: 'intro' 'scene' 'launch';
			min-height: 0;
		}
		.growth-intro {
			padding: 2.5rem 1.5rem 2rem;
		}
		.growth-intro h1 {
			margin: 1rem 0;
			font-size: clamp(2.8rem, 9vw, 4rem);
		}
		.growth-explanation {
			max-width: 36ch;
			font-size: 12px;
		}
		.growth-scene {
			aspect-ratio: 4 / 3;
			max-height: 460px;
		}
		.launch-panel {
			padding: 2rem 1.5rem 2.5rem;
		}
		.countdown-digits {
			max-width: 230px;
		}
		.drop-link {
			margin-top: 1.5rem;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.growth-scene > video {
			display: none;
		}
		.growth-scene > video,
		.drop-link {
			transition: none;
		}
	}
</style>
