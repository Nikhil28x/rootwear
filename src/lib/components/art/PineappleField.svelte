<script lang="ts">
	import PineappleMotif from './PineappleMotif.svelte';

	/**
	 * A drift of pineapples across a whole page.
	 *
	 * Placed once inside a `relative` container rather than per section, so the
	 * composition is tuned as one thing: the earlier per-section version meant
	 * spacing depended on how tall each section happened to be, and two
	 * neighbours could collide or leave a long empty stretch.
	 *
	 * Positions are percentages of the container's height, so the drift
	 * redistributes when content grows instead of bunching at the top.
	 *
	 * Hand-placed, not random: they alternate sides, avoid the middle where the
	 * copy runs, and no two adjacent entries share an angle or a size.
	 */
	type Placement = {
		/** % down the container. */
		top: number;
		/** % across. Negative or >100 lets one bleed past the gutter. */
		left: number;
		/** Tailwind height at sm and at lg. */
		h: [string, string];
		rotate: number;
		opacity: number;
	};

	let {
		placements = [
			// Header: the large one beside the title, as before.
			{ top: 4, left: 60, h: ['h-[9rem]', 'lg:h-[19rem]'], rotate: 0, opacity: 0.13 },
			{ top: 8, left: 92, h: ['h-[6rem]', 'lg:h-[10rem]'], rotate: 16, opacity: 0.09 },
			{ top: 12, left: 5, h: ['h-[9rem]', 'lg:h-[15rem]'], rotate: -19, opacity: 0.11 },
			// 22-40% on the right is the poster panel, which is opaque — a
			// pineapple behind it is simply not seen, so that lane stays empty.
			{ top: 20, left: 22, h: ['h-[6rem]', 'lg:h-[10rem]'], rotate: 29, opacity: 0.08 },
			{ top: 28, left: 6, h: ['h-[8rem]', 'lg:h-[14rem]'], rotate: -11, opacity: 0.1 },
			{ top: 35, left: 30, h: ['h-[6rem]', 'lg:h-[9rem]'], rotate: 22, opacity: 0.08 },
			{ top: 43, left: 90, h: ['h-[9rem]', 'lg:h-[16rem]'], rotate: -26, opacity: 0.11 },
			{ top: 49, left: 3, h: ['h-[7rem]', 'lg:h-[12rem]'], rotate: 13, opacity: 0.09 },
			{ top: 56, left: 52, h: ['h-[6rem]', 'lg:h-[10rem]'], rotate: -34, opacity: 0.075 },
			{ top: 62, left: 94, h: ['h-[8rem]', 'lg:h-[15rem]'], rotate: 8, opacity: 0.1 },
			{ top: 69, left: 14, h: ['h-[9rem]', 'lg:h-[17rem]'], rotate: -17, opacity: 0.11 },
			{ top: 75, left: 70, h: ['h-[6rem]', 'lg:h-[10rem]'], rotate: 27, opacity: 0.08 },
			{ top: 82, left: 4, h: ['h-[7rem]', 'lg:h-[13rem]'], rotate: -7, opacity: 0.1 },
			{ top: 88, left: 86, h: ['h-[9rem]', 'lg:h-[16rem]'], rotate: 19, opacity: 0.11 },
			{ top: 94, left: 36, h: ['h-[6rem]', 'lg:h-[11rem]'], rotate: -30, opacity: 0.085 },
			{ top: 98, left: 66, h: ['h-[7rem]', 'lg:h-[12rem]'], rotate: 11, opacity: 0.09 }
		]
	}: { placements?: Placement[] } = $props();
</script>

<!--
	Decorative only: aria-hidden and pointer-events-none, so it is invisible to
	assistive tech and never intercepts a click on the content above it.

	-z-10 puts it BEHIND the page content. An absolutely positioned sibling
	paints above static ones by default, so without this the drift would sit on
	top of the copy rather than under it. The container carries `isolate`, which
	keeps the negative index inside that stacking context instead of dropping it
	behind the page background entirely.
-->
<div class="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
	{#each placements as p, i (i)}
		<div
			class="pointer-events-none absolute hidden aspect-[200/320] text-gold-ink sm:block {p.h[0]} {p
				.h[1]}"
			style="top: {p.top}%; left: {p.left}%; transform: translate(-50%, -50%)"
		>
			<PineappleMotif opacity={p.opacity} rotate={p.rotate} />
		</div>
	{/each}
</div>
