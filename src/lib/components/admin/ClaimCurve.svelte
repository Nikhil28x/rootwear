<script lang="ts">
	/**
	 * §12 — "the sell-out curve against time from launch. This is the number
	 * that decides how big Drop 02 is cut."
	 *
	 * Plotted as cumulative pieces CLAIMED, which is the honest series: during
	 * the tease a piece is claimed by a confirmed deposit, and after launch by
	 * an open sale. Drawing only post-launch sales would leave the curve blank
	 * for the whole run-up, which is precisely the part that predicts the cut.
	 *
	 * The launch instant is marked, so the shape either side of it is readable:
	 * a steep pre-launch fill and a flat post-launch line say something very
	 * different from the reverse.
	 *
	 * A step line, not a smoothed one. Pieces are integers and there is no such
	 * thing as 3.4 pieces claimed.
	 */
	type Point = { atMs: number; minutesFromLaunch: number; cumulativeSold: number };

	let {
		points,
		editionSize,
		launchInstant,
		now
	}: { points: Point[]; editionSize: number; launchInstant: number; now: number } = $props();

	const W = 640;
	const H = 190;
	const PAD_L = 34;
	const PAD_R = 12;
	const PAD_T = 14;
	const PAD_B = 26;

	const DAY = 86_400_000;

	let domain = $derived.by(() => {
		const times = points.map((p) => p.atMs);
		const lo = Math.min(launchInstant - DAY, ...(times.length ? times : [launchInstant - DAY]));
		const hi = Math.max(launchInstant + DAY, now, ...(times.length ? times : [launchInstant + DAY]));
		return { lo, hi: hi === lo ? lo + DAY : hi };
	});

	let ceiling = $derived(Math.max(editionSize, points.at(-1)?.cumulativeSold ?? 0, 1));

	function x(atMs: number): number {
		const { lo, hi } = domain;
		return PAD_L + ((atMs - lo) / (hi - lo)) * (W - PAD_L - PAD_R);
	}

	function y(value: number): number {
		return PAD_T + (1 - value / ceiling) * (H - PAD_T - PAD_B);
	}

	/** Step path: hold the level, then jump on each claim. */
	let path = $derived.by(() => {
		if (points.length === 0) return '';
		const segments: string[] = [`M ${x(domain.lo).toFixed(1)} ${y(0).toFixed(1)}`];
		let level = 0;
		for (const point of points) {
			segments.push(`L ${x(point.atMs).toFixed(1)} ${y(level).toFixed(1)}`);
			level = point.cumulativeSold;
			segments.push(`L ${x(point.atMs).toFixed(1)} ${y(level).toFixed(1)}`);
		}
		segments.push(`L ${x(Math.min(domain.hi, now)).toFixed(1)} ${y(level).toFixed(1)}`);
		return segments.join(' ');
	});

	/**
	 * Deduplicated, because the each block below is keyed on the value and a
	 * tiny edition collapses the three rules onto the same numbers — an edition
	 * of one gives [0, 1, 1], and a duplicate key is a runtime error, not a
	 * cosmetic one. Drop 01 is 25 pieces, but edition_size only has to be above
	 * zero, and a one-off piece is exactly the kind of thing this brand does.
	 */
	let gridValues = $derived([...new Set([0, Math.round(ceiling / 2), ceiling])]);

	const dayFormat = new Intl.DateTimeFormat('en-GB', {
		day: '2-digit',
		month: 'short',
		timeZone: 'Asia/Kolkata'
	});
</script>

{#if points.length === 0}
	<p class="px-5 py-10 text-[15px] text-stone-400">
		Nothing claimed yet. The curve starts at the first confirmed deposit and the launch instant is
		marked once there is a line to mark it on.
	</p>
{:else}
	<figure class="m-0 px-5 py-5">
		<svg
			viewBox="0 0 {W} {H}"
			class="w-full"
			role="img"
			aria-label="Cumulative pieces claimed over time. {points.at(-1)?.cumulativeSold} of {editionSize} claimed so far."
		>
			<!-- horizontal grid, labelled in pieces -->
			{#each gridValues as value (value)}
				<line
					x1={PAD_L}
					x2={W - PAD_R}
					y1={y(value)}
					y2={y(value)}
					stroke="currentColor"
					stroke-width="1"
					opacity={value === 0 ? 0.28 : 0.12}
				/>
				<text x="0" y={y(value) + 4} font-size="10" fill="currentColor" opacity="0.5">{value}</text>
			{/each}

			<!-- the edition ceiling: 25 pieces and no more -->
			<line
				x1={PAD_L}
				x2={W - PAD_R}
				y1={y(editionSize)}
				y2={y(editionSize)}
				stroke="currentColor"
				stroke-width="1"
				stroke-dasharray="3 4"
				opacity="0.45"
			/>

			<!-- the launch instant -->
			{#if launchInstant >= domain.lo && launchInstant <= domain.hi}
				<line
					x1={x(launchInstant)}
					x2={x(launchInstant)}
					y1={PAD_T}
					y2={H - PAD_B}
					stroke="var(--color-gold)"
					stroke-width="1"
				/>
				<text
					x={x(launchInstant) + 4}
					y={PAD_T + 9}
					font-size="9"
					fill="var(--color-gold)"
					letter-spacing="1.4">LAUNCH</text
				>
			{/if}

			<path d={path} fill="none" stroke="var(--color-cream)" stroke-width="1.5" />

			<text x={PAD_L} y={H - 8} font-size="10" fill="currentColor" opacity="0.5">
				{dayFormat.format(new Date(domain.lo))}
			</text>
			<text x={W - PAD_R} y={H - 8} font-size="10" fill="currentColor" opacity="0.5" text-anchor="end">
				{dayFormat.format(new Date(domain.hi))}
			</text>
		</svg>
		<figcaption class="mt-3 text-[13px] text-stone-400">
			Cumulative pieces claimed against time. The dashed rule is the edition ceiling of {editionSize}.
		</figcaption>
	</figure>
{/if}
