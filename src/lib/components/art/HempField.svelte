<script lang="ts">
	/**
	 * A standing field of hemp, rooted at the bottom edge of its box.
	 *
	 * Where HempMotif draws the leaf, this draws the PLANT: a stalk as a single
	 * bending curve, leaf nodes set in opposite pairs along it, each node a
	 * small palmate fan, and an apical cluster at the tip. Stalks in the back
	 * row are shorter and thinner so the field has depth without needing a
	 * second colour.
	 *
	 * Everything is computed — stalk curves, node positions on the curve and
	 * the tangent each leaf hangs off — from a deterministic PRNG, so the
	 * markup is byte-identical on server and client (no hydration mismatch),
	 * and one leaf fan is defined once and `<use>`d, so a dense field is still
	 * a light DOM.
	 *
	 * Inherits `currentColor`. Absolutely positioned to fill its parent — give
	 * it a positioned, sized wrapper.
	 */
	let {
		opacity = 0.06,
		density = 9,
		seed = 5,
		class: klass = ''
	}: { opacity?: number; density?: number; seed?: number; class?: string } = $props();

	/** Deterministic PRNG — same output every render, server and browser. */
	function makeRandom(value: number) {
		let s = value >>> 0 || 1;
		return () => {
			s = (s * 1664525 + 1013904223) >>> 0;
			return s / 4294967296;
		};
	}

	const WIDTH = 400;
	const GROUND = 250;

	/** One lanceolate blade, pointing up from the origin, length 1. */
	function blade(length: number, width: number): string {
		const w = width / 2;
		return (
			`M0 0 C${w.toFixed(2)} ${(-length * 0.26).toFixed(2)} ` +
			`${(w * 0.72).toFixed(2)} ${(-length * 0.74).toFixed(2)} 0 ${(-length).toFixed(2)} ` +
			`C${(-w * 0.72).toFixed(2)} ${(-length * 0.74).toFixed(2)} ` +
			`${(-w).toFixed(2)} ${(-length * 0.26).toFixed(2)} 0 0 Z`
		);
	}

	/** Three blades fanned from one point: the leaf, at unit scale. */
	const LEAF_FAN = [
		{ d: blade(30, 7.5), rotate: 0 },
		{ d: blade(20, 5.5), rotate: 34 },
		{ d: blade(20, 5.5), rotate: -34 }
	];

	type Stalk = { d: string; w: number };
	type Leaf = { x: number; y: number; rot: number; scale: number };

	let art = $derived.by(() => {
		const rand = makeRandom(seed * 2654435761 + 97);
		const stalks: Stalk[] = [];
		const leaves: Leaf[] = [];
		const lanes = Math.max(3, density);

		for (let i = 0; i < lanes; i++) {
			// Back row: shorter, thinner, fewer leaves. Depth without a second tone.
			const back = rand() < 0.42;
			const baseX = ((i + 0.5) / lanes) * WIDTH + (rand() - 0.5) * (WIDTH / lanes) * 0.7;
			const height = back ? 96 + rand() * 46 : 150 + rand() * 72;
			const lean = (rand() - 0.5) * 0.44;

			// The stalk is one quadratic: base, a control point that gives the
			// bend, and a tip displaced by the lean.
			const p0 = { x: baseX, y: GROUND };
			const p1 = { x: baseX + lean * height * 0.62, y: GROUND - height };
			const c = { x: baseX + lean * height * 0.16, y: GROUND - height * 0.56 };

			stalks.push({
				d: `M${p0.x.toFixed(2)} ${p0.y.toFixed(2)} Q${c.x.toFixed(2)} ${c.y.toFixed(2)} ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
				w: back ? 0.6 : 1.05
			});

			const nodeCount = back ? 3 : 4;
			for (let n = 0; n < nodeCount; n++) {
				const t = 0.34 + (n / nodeCount) * 0.52 + rand() * 0.05;

				// Point on the quadratic, and the tangent the leaves hang off.
				const u = 1 - t;
				const px = u * u * p0.x + 2 * u * t * c.x + t * t * p1.x;
				const py = u * u * p0.y + 2 * u * t * c.y + t * t * p1.y;
				const dx = 2 * u * (c.x - p0.x) + 2 * t * (p1.x - c.x);
				const dy = 2 * u * (c.y - p0.y) + 2 * t * (p1.y - c.y);

				// A blade drawn along -y already points "up", so align it to the
				// tangent by its angle plus a quarter turn.
				const along = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
				const spread = 52 + rand() * 18;
				// Leaves get smaller toward the tip.
				const scale = (back ? 0.64 : 0.98) * (1 - t * 0.46) * (0.85 + rand() * 0.3);

				leaves.push({ x: px, y: py, rot: along - spread, scale });
				leaves.push({ x: px, y: py, rot: along + spread, scale });
			}

			// The apical cluster, sitting upright on the tip.
			const tipAlong = (Math.atan2(p1.y - c.y, p1.x - c.x) * 180) / Math.PI + 90;
			leaves.push({
				x: p1.x,
				y: p1.y,
				rot: tipAlong,
				scale: (back ? 0.42 : 0.6) * (0.9 + rand() * 0.2)
			});
		}

		return { stalks, leaves };
	});
</script>

<svg
	class="pointer-events-none absolute inset-0 size-full {klass}"
	viewBox="0 0 400 250"
	preserveAspectRatio="xMidYMax slice"
	aria-hidden="true"
	focusable="false"
	style:opacity
>
	<defs>
		<g id="hemp-field-leaf-{seed}">
			{#each LEAF_FAN as l, i (i)}
				<path
					d={l.d}
					transform="rotate({l.rotate})"
					fill="none"
					stroke="currentColor"
					stroke-width="1.1"
					stroke-linejoin="round"
				/>
			{/each}
		</g>
	</defs>

	{#each art.stalks as s, i (i)}
		<path d={s.d} fill="none" stroke="currentColor" stroke-width={s.w} stroke-linecap="round" />
	{/each}

	{#each art.leaves as l, i (i)}
		<use
			href="#hemp-field-leaf-{seed}"
			transform="translate({l.x.toFixed(2)} {l.y.toFixed(2)}) rotate({l.rot.toFixed(
				2
			)}) scale({l.scale.toFixed(3)})"
		/>
	{/each}
</svg>
