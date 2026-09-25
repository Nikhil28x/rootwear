<script lang="ts">
	/**
	 * A hemp stalk in cross-section, drawn as a background medallion.
	 *
	 * Built from the actual anatomy rather than from a stack of compass
	 * circles: a hollow pith at the centre, woody growth rings around it,
	 * medullary rays running outward through them, and — the part that matters
	 * to a shirt — the ring of BAST FIBRE BUNDLES sitting just under the skin.
	 * Those bundles are the thing that becomes yarn, so they are the only
	 * element drawn filled.
	 *
	 * Every ring is a polar curve perturbed by three harmonics, so it reads as
	 * a stem and not as clip art. The harmonics come from a deterministic PRNG
	 * seeded by `seed`: identical on the server and in the browser, which a
	 * Math.random() version would not be (hydration mismatch).
	 *
	 * Inherits `currentColor`, so one component serves cream and forest-black.
	 * The element is absolutely positioned to fill its parent — give it a
	 * positioned, sized wrapper.
	 */
	let {
		opacity = 0.07,
		rings = 5,
		seed = 11,
		class: klass = ''
	}: { opacity?: number; rings?: number; seed?: number; class?: string } = $props();

	/** Deterministic PRNG — same output every render, server and browser. */
	function makeRandom(value: number) {
		let s = value >>> 0 || 1;
		return () => {
			s = (s * 1664525 + 1013904223) >>> 0;
			return s / 4294967296;
		};
	}

	const CX = 200;
	const CY = 200;

	type Shell = { d: string; w: number };
	type Bundle = { x: number; y: number; rx: number; ry: number; rot: number };
	type Ray = { x1: number; y1: number; x2: number; y2: number };

	/**
	 * A closed polar curve of radius `r0`, deformed by three low harmonics.
	 * Small amplitudes read as growth, large amplitudes read as a mistake.
	 */
	function organicRing(r0: number, wobble: number, rand: () => number, points = 132): string {
		const harmonics = [2, 3, 5].map((k) => ({
			k,
			amp: wobble * (0.4 + rand() * 0.8),
			phase: rand() * Math.PI * 2
		}));

		let d = '';
		for (let i = 0; i < points; i++) {
			const t = (i / points) * Math.PI * 2;
			let r = r0;
			for (const h of harmonics) r += r0 * h.amp * Math.sin(h.k * t + h.phase);
			const x = CX + Math.cos(t) * r;
			const y = CY + Math.sin(t) * r;
			d += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)} `;
		}
		return `${d}Z`;
	}

	let art = $derived.by(() => {
		const rand = makeRandom(seed * 7919 + 13);
		const shells: Shell[] = [];
		const bundles: Bundle[] = [];
		const rays: Ray[] = [];

		// Epidermis, then the cortex line the bast bundles sit inside.
		shells.push({ d: organicRing(178, 0.012, rand), w: 1.3 });
		shells.push({ d: organicRing(160, 0.014, rand), w: 0.7 });

		// The bast ring: bundles of fibre, unevenly sized, tangentially set.
		const count = 38;
		for (let i = 0; i < count; i++) {
			const t = (i / count) * Math.PI * 2 + (rand() - 0.5) * 0.06;
			const r = 169 - rand() * 12;
			bundles.push({
				x: CX + Math.cos(t) * r,
				y: CY + Math.sin(t) * r,
				rx: 3.2 + rand() * 2.8,
				ry: 2.2 + rand() * 1.9,
				rot: (t * 180) / Math.PI
			});
		}

		// Woody growth rings, thinning toward the pith.
		const span = 134 - 58;
		for (let i = 0; i < rings; i++) {
			const r = 134 - (span * i) / Math.max(1, rings - 1);
			shells.push({ d: organicRing(r, 0.02 + rand() * 0.016, rand), w: 0.55 });
		}

		// Medullary rays, cut through the wood from pith to cambium.
		const rayCount = 20;
		for (let i = 0; i < rayCount; i++) {
			const t = (i / rayCount) * Math.PI * 2 + rand() * 0.05;
			const inner = 48 + rand() * 6;
			const outer = 130 + rand() * 8;
			rays.push({
				x1: CX + Math.cos(t) * inner,
				y1: CY + Math.sin(t) * inner,
				x2: CX + Math.cos(t) * outer,
				y2: CY + Math.sin(t) * outer
			});
		}

		// The pith is hollow — two lines, not a disc.
		shells.push({ d: organicRing(44, 0.05, rand), w: 0.9 });
		shells.push({ d: organicRing(25, 0.07, rand), w: 0.5 });

		return { shells, bundles, rays };
	});
</script>

<svg
	class="pointer-events-none absolute inset-0 size-full {klass}"
	viewBox="0 0 400 400"
	preserveAspectRatio="xMidYMid meet"
	aria-hidden="true"
	focusable="false"
	style:opacity
>
	{#each art.rays as r, i (i)}
		<line
			x1={r.x1.toFixed(2)}
			y1={r.y1.toFixed(2)}
			x2={r.x2.toFixed(2)}
			y2={r.y2.toFixed(2)}
			stroke="currentColor"
			stroke-width="0.4"
		/>
	{/each}

	{#each art.shells as s, i (i)}
		<path d={s.d} fill="none" stroke="currentColor" stroke-width={s.w} stroke-linejoin="round" />
	{/each}

	{#each art.bundles as b, i (i)}
		<ellipse
			cx={b.x.toFixed(2)}
			cy={b.y.toFixed(2)}
			rx={b.rx.toFixed(2)}
			ry={b.ry.toFixed(2)}
			transform="rotate({b.rot.toFixed(2)} {b.x.toFixed(2)} {b.y.toFixed(2)})"
			fill="currentColor"
		/>
	{/each}
</svg>
