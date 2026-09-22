<script lang="ts">
	/**
	 * Hemp leaf motif, drawn as a background field.
	 *
	 * The hemp leaf is palmate: an odd number of serrated lanceolate leaflets
	 * radiating from one point, the centre leaflet longest. Drawn from that
	 * structure rather than traced, so it reads as the plant and not as a
	 * clip-art cannabis leaf — §14's identity rules matter here.
	 *
	 * Pure geometry, no external asset, and it inherits `currentColor` so it
	 * works on cream and on forest-black without a second copy.
	 */
	let {
		opacity = 0.06,
		class: klass = '',
		seed = 0
	}: { opacity?: number; class?: string; seed?: number } = $props();

	/** One serrated leaflet, pointing up from the origin. */
	function leaflet(length: number, width: number, teeth = 5): string {
		const half = width / 2;
		let right = `M 0 0`;
		for (let i = 0; i < teeth; i++) {
			const t0 = i / teeth;
			const t1 = (i + 1) / teeth;
			// Taper toward the tip; each tooth juts out then cuts back in.
			const w0 = half * (1 - t0) ** 0.75;
			const w1 = half * (1 - t1) ** 0.75;
			const y0 = -length * t0;
			const y1 = -length * t1;
			right += ` L ${w0.toFixed(2)} ${y0.toFixed(2)}`;
			right += ` L ${(w1 * 0.45).toFixed(2)} ${((y0 + y1) / 2).toFixed(2)}`;
			right += ` L ${w1.toFixed(2)} ${y1.toFixed(2)}`;
		}
		right += ` L 0 ${(-length).toFixed(2)}`;
		// Mirror for the left edge.
		let left = '';
		for (let i = teeth - 1; i >= 0; i--) {
			const t0 = i / teeth;
			const t1 = (i + 1) / teeth;
			const w0 = half * (1 - t0) ** 0.75;
			const w1 = half * (1 - t1) ** 0.75;
			const y0 = -length * t0;
			const y1 = -length * t1;
			left += ` L ${(-w1).toFixed(2)} ${y1.toFixed(2)}`;
			left += ` L ${(-w1 * 0.45).toFixed(2)} ${((y0 + y1) / 2).toFixed(2)}`;
			left += ` L ${(-w0).toFixed(2)} ${y0.toFixed(2)}`;
		}
		return `${right}${left} Z`;
	}

	/** Seven leaflets, centre longest, fanned symmetrically. */
	const FAN = [
		{ angle: 0, length: 62, width: 15 },
		{ angle: 32, length: 52, width: 13 },
		{ angle: -32, length: 52, width: 13 },
		{ angle: 62, length: 38, width: 11 },
		{ angle: -62, length: 38, width: 11 },
		{ angle: 92, length: 23, width: 8 },
		{ angle: -92, length: 23, width: 8 }
	];
</script>

<svg
	class="pointer-events-none absolute inset-0 size-full {klass}"
	viewBox="0 0 400 400"
	preserveAspectRatio="xMidYMid slice"
	aria-hidden="true"
	focusable="false"
	style:opacity
>
	<defs>
		<g id="hemp-{seed}">
			{#each FAN as l (l.angle)}
				<path
					d={leaflet(l.length, l.width)}
					transform="rotate({l.angle})"
					fill="none"
					stroke="currentColor"
					stroke-width="1"
					stroke-linejoin="round"
				/>
			{/each}
			<!-- Petiole -->
			<line x1="0" y1="0" x2="0" y2="16" stroke="currentColor" stroke-width="1" />
		</g>
	</defs>

	<use href="#hemp-{seed}" transform="translate(84 120) rotate(-14) scale(0.95)" />
	<use href="#hemp-{seed}" transform="translate(300 96) rotate(18) scale(0.7)" />
	<use href="#hemp-{seed}" transform="translate(196 300) rotate(-4) scale(1.15)" />
	<use href="#hemp-{seed}" transform="translate(356 268) rotate(30) scale(0.55)" />
	<use href="#hemp-{seed}" transform="translate(30 320) rotate(-28) scale(0.62)" />
</svg>
