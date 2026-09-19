<script lang="ts">
	import { onMount } from 'svelte';
	import { DROP_START, DROP_LAUNCH, DAY_MS, GROWTH_STAGES, getDropState } from './drop-timeline';

	let { serverNow }: { serverNow: number } = $props();
	let clockNow = $state<number | null>(null);
	let now = $derived(clockNow ?? serverNow);
	let growth = $derived(getDropState(now));
	const dateLabel = (time: number) =>
		new Intl.DateTimeFormat('en-IN', {
			day: 'numeric',
			month: 'short',
			timeZone: 'Asia/Kolkata'
		}).format(time);
	const pad = (number: number) => String(number).padStart(2, '0');

	onMount(() => {
		const serverOffset = serverNow - Date.now();
		const tick = () => {
			clockNow = Date.now() + serverOffset;
		};
		const timer = window.setInterval(tick, 1000);
		document.addEventListener('visibilitychange', tick);
		return () => {
			clearInterval(timer);
			document.removeEventListener('visibilitychange', tick);
		};
	});

	// Each visit reveals just the current chapter, then holds that growth stage.
	function playChapter(video: HTMLVideoElement, stageIndex: number) {
		const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
		let frame = 0;
		let started = false;
		let preparing = false;
		let target = 0;
		const hold = () => {
			video.pause();
			cancelAnimationFrame(frame);
			if (Number.isFinite(target)) video.currentTime = target;
		};
		const track = () => {
			if (video.currentTime >= target) {
				hold();
				return;
			}
			frame = requestAnimationFrame(track);
		};
		const reveal = () => {
			if (!preparing) return;
			preparing = false;
			if (motion.matches) return;
			video.style.opacity = '1';
			video.playbackRate = 0.5;
			video
				.play()
				.then(track)
				.catch(() => {
					video.style.opacity = '0';
				});
		};
		const prepare = () => {
			if (started || motion.matches || !Number.isFinite(video.duration)) return;
			started = true;
			target = Math.min(video.duration - 1 / 24, (stageIndex * 32) / 24);
			preparing = true;
			const from = Math.max(0, ((stageIndex - 1) * 32) / 24);
			if (Math.abs(video.currentTime - from) < 0.01) reveal();
			else video.currentTime = from;
		};
		const updateMotion = () => {
			if (motion.matches) {
				hold();
				video.style.opacity = '0';
			} else {
				started = false;
				prepare();
			}
		};
		video.addEventListener('loadeddata', prepare);
		video.addEventListener('seeked', reveal);
		motion.addEventListener('change', updateMotion);
		if (video.readyState >= 2) prepare();
		return {
			destroy() {
				cancelAnimationFrame(frame);
				video.pause();
				video.removeEventListener('loadeddata', prepare);
				video.removeEventListener('seeked', reveal);
				motion.removeEventListener('change', updateMotion);
			}
		};
	}
</script>

<section class="drop-countdown" aria-labelledby="growth-title">
	<div class="growth-scene">
		<img
			src={`/images/drop-growth/stage-${growth.stageIndex}.jpg`}
			alt={`${growth.stage.label}: a plant growing in Rootwear's misty forest`}
		/>
		{#if growth.stageIndex > 0}
			{#key growth.stageIndex}
				<video
					use:playChapter={growth.stageIndex}
					src="/video/rootwear-tree-growth.mp4"
					muted
					playsinline
					preload="auto"
					aria-hidden="true"
					tabindex="-1"
				></video>
			{/key}
		{/if}
		<div class="growth-shade"></div>
		<div class="growth-topline">
			<span>Drop 001 / The first growth</span><span>Rooted in time</span>
		</div>
		<div class="growth-copy">
			<p class="eyebrow">
				{growth.launched
					? 'Full growth / Drop day'
					: `Chapter 0${growth.stageIndex + 1} / ${growth.stage.label}`}
			</p>
			<h1 id="growth-title">{growth.launched ? 'The wait is over.' : 'Good things grow.'}</h1>
			<p>{growth.stage.note}</p>
			<a href="#collection-title"
				>{growth.launched ? 'Explore the drop' : 'Meet the coming drop'}
				<span aria-hidden="true">↘</span></a
			>
		</div>
	</div>
	<div class="growth-calendar">
		<div class="launch-heading">
			<div>
				<p class="eyebrow">Pineapple Haze / Drop 001</p>
				<h2>{growth.launched ? 'Fully grown.' : 'A little closer, every day.'}</h2>
			</div>
			<p class="launch-date">
				{growth.launched ? 'Launch date' : 'Arriving'}<time
					datetime={new Date(DROP_LAUNCH).toISOString()}>11 October 2026 · 6:00 PM IST</time
				>
			</p>
		</div>
		{#if !growth.launched}
			<div class="countdown-digits" role="timer" aria-label="Time until the drop">
				{#each [[growth.days, 'Days'], [growth.hours, 'Hours'], [growth.minutes, 'Minutes'], [growth.seconds, 'Seconds']] as [value, label]}
					<div><strong>{pad(Number(value))}</strong><span>{label}</span></div>
				{/each}
			</div>
		{/if}
		<div
			class="growth-progress"
			role="progressbar"
			aria-label="Journey to launch"
			aria-valuemin="0"
			aria-valuemax="100"
			aria-valuenow={Math.round(growth.progress * 100)}
		>
			<span style:width={`${growth.progress * 100}%`}></span>
		</div>
		<ol class="growth-stages">
			{#each GROWTH_STAGES as stage, index}
				<li
					class:reached={index <= growth.stageIndex}
					aria-current={index === growth.stageIndex ? 'step' : undefined}
				>
					<span class="stage-dot"></span><time
						datetime={new Date(DROP_START + stage.day * DAY_MS).toISOString()}
						>{dateLabel(DROP_START + stage.day * DAY_MS)}</time
					><span>{stage.label}</span>
				</li>
			{/each}
		</ol>
		<p class="growth-return">
			{#if growth.nextGrowthAt}A new stage every five days. Come back on <strong
					>{dateLabel(growth.nextGrowthAt)}</strong
				> to watch the next chapter unfold.{:else}From a small beginning to our first drop. Explore
				Pineapple Haze below.{/if}
		</p>
	</div>
</section>

<style>
	.drop-countdown {
		color: #f6efdd;
		background: #12251b;
	}
	.growth-scene {
		position: relative;
		height: min(78svh, 880px);
		min-height: 540px;
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
	}
	.growth-shade {
		position: absolute;
		inset: 0;
		background: linear-gradient(180deg, #07130a66, transparent 25%, transparent 48%, #07130adb);
	}
	.growth-topline {
		position: absolute;
		top: 2rem;
		left: 4%;
		right: 4%;
		display: flex;
		justify-content: space-between;
		font-size: 9px;
		letter-spacing: 0.2em;
		text-transform: uppercase;
	}
	.growth-copy {
		position: absolute;
		bottom: 3rem;
		left: 4%;
		right: 4%;
	}
	.eyebrow {
		font-size: 10px;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: #d6b76d;
	}
	.growth-copy h1 {
		margin: 1rem 0;
		font-family: Didot, 'Bodoni 72', serif;
		font-size: clamp(3.4rem, 7vw, 7.5rem);
		font-weight: 400;
		line-height: 0.94;
		letter-spacing: -0.055em;
	}
	.growth-copy > p:not(.eyebrow) {
		font-size: 14px;
		color: #f6efddc9;
	}
	.growth-copy a {
		display: inline-flex;
		gap: 2rem;
		margin-top: 1.5rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid #c9a55499;
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.14em;
	}
	.growth-calendar {
		padding: 3.5rem 4% 2.5rem;
	}
	.launch-heading {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 2rem;
	}
	.launch-heading h2 {
		margin: 0.75rem 0 0;
		font-family: Didot, 'Bodoni 72', serif;
		font-size: clamp(2rem, 3vw, 3rem);
		font-weight: 400;
		line-height: 1.1;
	}
	.launch-date {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: #f6efddaa;
		text-align: right;
	}
	.launch-date time {
		display: block;
		margin-top: 0.6rem;
		color: #f6efdd;
	}
	.countdown-digits {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		max-width: 760px;
		margin: 3rem 0;
	}
	.countdown-digits > div {
		border-right: 1px solid #f6efdd26;
		padding-left: 2rem;
	}
	.countdown-digits > div:first-child {
		padding-left: 0;
	}
	.countdown-digits > div:last-child {
		border: 0;
	}
	.countdown-digits strong {
		display: block;
		font-family: Didot, 'Bodoni 72', serif;
		font-size: clamp(3rem, 6vw, 6rem);
		font-weight: 400;
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}
	.countdown-digits span {
		display: block;
		margin-top: 0.75rem;
		font-size: 9px;
		text-transform: uppercase;
		letter-spacing: 0.2em;
		color: #f6efdd99;
	}
	.growth-progress {
		height: 1px;
		background: #f6efdd26;
		margin-top: 3rem;
	}
	.growth-progress > span {
		display: block;
		height: 1px;
		background: #c9a554;
	}
	.growth-stages {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		list-style: none;
		padding: 0;
		margin: 0;
		gap: 0.5rem;
	}
	.growth-stages li {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		font-size: 10px;
		color: #f6efdd80;
	}
	.stage-dot {
		width: 7px;
		height: 7px;
		border: 1px solid #9caa9f;
		border-radius: 50%;
		margin-top: -4px;
		background: #12251b;
	}
	.growth-stages .reached {
		color: #e4c887;
	}
	.reached .stage-dot {
		background: #c9a554;
		border-color: #c9a554;
	}
	.growth-stages time {
		margin-top: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}
	.growth-return {
		margin: 2.5rem 0 0;
		font-size: 12px;
		line-height: 1.7;
		color: #f6efddaa;
	}
	.growth-return strong {
		font-weight: 400;
		color: #e4c887;
	}
	@media (max-width: 680px) {
		.growth-scene {
			height: 72svh;
			min-height: 500px;
		}
		.growth-copy {
			bottom: 2rem;
		}
		.growth-copy h1 {
			max-width: 7ch;
		}
		.growth-topline > span:last-child {
			display: none;
		}
		.launch-heading {
			align-items: start;
			flex-direction: column;
		}
		.launch-date {
			text-align: left;
			line-height: 1.7;
		}
		.countdown-digits > div {
			padding-left: 0.8rem;
		}
		.growth-stages {
			grid-template-columns: repeat(4, 1fr);
			row-gap: 1.5rem;
		}
		.growth-stages li {
			font-size: 9px;
		}
		.growth-calendar {
			padding-top: 2.5rem;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.growth-scene > video {
			display: none;
		}
	}
</style>
