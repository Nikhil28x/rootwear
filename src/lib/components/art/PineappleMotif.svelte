<script lang="ts">
	/**
	 * A pineapple, drawn rather than traced: the body is an oval, the lattice is
	 * two families of parallel diagonals clipped to that oval, and the crown is
	 * a fan of tapered blades placed on an arc.
	 *
	 * Everything is computed from the geometry below, so changing `latticeStep`
	 * or `blades` reflows the whole drawing instead of breaking a hand-authored
	 * path. No randomness anywhere — the same markup renders on the server and
	 * on the client, which a Math.random() version would not.
	 *
	 * Inherits `currentColor`, so the caller decides whether it reads gold on
	 * forest-black or something quieter.
	 */
	let {
		opacity = 0.16,
		latticeStep = 17,
		blades = 9,
		/** Degrees. Lets the same drawing sit at a different angle per placement. */
		rotate = 0,
		class: klass = ''
	}: {
		opacity?: number;
		latticeStep?: number;
		blades?: number;
		rotate?: number;
		class?: string;
	} = $props();

	// Body geometry. Everything else is derived from these four numbers.
	/**
	 * A unique id per instance. Every copy previously emitted
	 * clipPath id="pineapple-body", so the page carried duplicate ids and each
	 * SVG clipped to whichever element the document resolved first. Identical
	 * silhouettes hid it — until one instance changed latticeStep or blades.
	 */
	const uid = $props.id();
	const clipId = `pineapple-body-${uid}`;

	const CX = 100;
	const BODY_TOP = 108;
	const BODY_BOTTOM = 286;
	const RX = 62;

	const CY = (BODY_TOP + BODY_BOTTOM) / 2;
	const RY = (BODY_BOTTOM - BODY_TOP) / 2;

	/**
	 * The body: an oval narrowed slightly at the shoulders and drawn to a soft
	 * point at the base, which is what separates a pineapple from an egg.
	 */
	const body = [
		`M ${CX} ${BODY_TOP}`,
		`C ${CX + RX * 0.92} ${BODY_TOP + RY * 0.16} ${CX + RX} ${CY + RY * 0.2} ${CX + RX * 0.52} ${BODY_BOTTOM - RY * 0.16}`,
		`C ${CX + RX * 0.26} ${BODY_BOTTOM + 6} ${CX - RX * 0.26} ${BODY_BOTTOM + 6} ${CX - RX * 0.52} ${BODY_BOTTOM - RY * 0.16}`,
		`C ${CX - RX} ${CY + RY * 0.2} ${CX - RX * 0.92} ${BODY_TOP + RY * 0.16} ${CX} ${BODY_TOP}`,
		'Z'
	].join(' ');

	/**
	 * Diagonals in both directions. Each line is long enough to cross the whole
	 * body at 45 degrees; the clip path trims them to the silhouette, which is
	 * what produces the diamond lattice without computing intersections.
	 */
	function diagonals(direction: 1 | -1) {
		const span = RX * 2 + (BODY_BOTTOM - BODY_TOP);
		const lines: Array<[number, number, number, number]> = [];
		for (let offset = -span; offset <= span; offset += latticeStep) {
			const x1 = CX + offset;
			const y1 = BODY_TOP - 20;
			const x2 = x1 + direction * (BODY_BOTTOM - BODY_TOP + 40);
			const y2 = BODY_BOTTOM + 20;
			lines.push([x1, y1, x2, y2]);
		}
		return lines;
	}

	let rising = $derived(diagonals(1));
	let falling = $derived(diagonals(-1));

	/**
	 * The crown. Blades fan across an arc, each one a quadratic that leans
	 * further out the further it sits from centre, so the silhouette opens
	 * rather than splaying evenly.
	 */
	let crown = $derived(
		Array.from({ length: blades }, (_, i) => {
			const t = blades === 1 ? 0 : (i / (blades - 1)) * 2 - 1; // -1 .. 1
			const lean = t * 46;
			const height = 96 - Math.abs(t) * 46;
			const baseX = CX + t * 15;
			const tipX = baseX + lean;
			const tipY = BODY_TOP - height;
			const ctrlX = baseX + lean * 0.32;
			const ctrlY = BODY_TOP - height * 0.68;
			const halfWidth = 7 - Math.abs(t) * 2.6;

			return [
				`M ${baseX - halfWidth} ${BODY_TOP + 4}`,
				`Q ${ctrlX - halfWidth * 0.3} ${ctrlY} ${tipX} ${tipY}`,
				`Q ${ctrlX + halfWidth * 0.3} ${ctrlY} ${baseX + halfWidth} ${BODY_TOP + 4}`
			].join(' ');
			})
	);
</script>

<svg
	class={klass}
	viewBox="0 0 200 320"
	fill="none"
	stroke="currentColor"
	stroke-width="1.05"
	stroke-linecap="round"
	stroke-linejoin="round"
	{opacity}
	style={rotate ? `transform: rotate(${rotate}deg)` : undefined}
	aria-hidden="true"
	focusable="false"
	preserveAspectRatio="xMidYMid meet"
>
	<defs>
		<clipPath id={clipId}>
			<path d={body} />
		</clipPath>
	</defs>

	<!-- The lattice, trimmed to the silhouette. -->
	<g clip-path="url(#{clipId})" opacity="0.72">
		{#each rising as [x1, y1, x2, y2], i (`r${i}`)}
			<line {x1} {y1} {x2} {y2} />
		{/each}
		{#each falling as [x1, y1, x2, y2], i (`f${i}`)}
			<line {x1} {y1} {x2} {y2} />
		{/each}
	</g>

	<!-- The silhouette last, so it sits cleanly over the trimmed lattice. -->
	<path d={body} stroke-width="1.35" />

	{#each crown as blade, i (`c${i}`)}
		<path d={blade} />
	{/each}
</svg>
