<script lang="ts">
	/**
	 * Revenue per day, one series. Bars with 4px rounded tops on a recessive
	 * grid; hover or focus a day for its figures; the same numbers are in a
	 * table for screen readers. Colour is the chart series 1 of the admin
	 * palette (validated against both surfaces).
	 */
	import { formatInr, paise } from '$lib/money';

	let { days }: { days: readonly { day: string; revenue: number; orders: number }[] } = $props();

	const W = 640;
	const H = 180;
	const PAD_B = 22;
	const PAD_T = 8;
	let max = $derived(Math.max(1, ...days.map((d) => d.revenue)));
	let step = $derived(W / Math.max(1, days.length));
	let barW = $derived(Math.max(4, step - 6));
	let active = $state<number | null>(null);
	const label = (day: string) =>
		new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
			new Date(`${day}T00:00:00Z`)
		);
	const y = (v: number) => PAD_T + (1 - v / max) * (H - PAD_T - PAD_B);
</script>

<figure class="relative m-0">
	<svg
		viewBox="0 0 {W} {H}"
		class="w-full overflow-visible"
		role="img"
		aria-label="Revenue per day for the last {days.length} days"
	>
		{#each [0, 0.5, 1] as f (f)}
			<line x1="0" x2={W} y1={y(max * f)} y2={y(max * f)} class="grid" />
		{/each}
		{#each days as d, i (d.day)}
			{@const h = (H - PAD_T - PAD_B) * (d.revenue / max)}
			{@const x = i * step + (step - barW) / 2}
			<g
				role="button"
				tabindex="0"
				aria-label="{label(d.day)}: {formatInr(paise(d.revenue))}, {d.orders} orders"
				onmouseenter={() => (active = i)}
				onmouseleave={() => (active = null)}
				onfocus={() => (active = i)}
				onblur={() => (active = null)}
			>
				<rect x={i * step} y="0" width={step} height={H - PAD_B} fill="transparent" />
				{#if d.revenue > 0}
					<path
						class="bar"
						class:dim={active !== null && active !== i}
						d="M{x},{H - PAD_B} v{-Math.max(0, h - 4)} q0,-4 4,-4 h{barW - 8} q4,0 4,4 v{Math.max(
							0,
							h - 4
						)} z"
					/>
				{:else}
					<line x1={x} x2={x + barW} y1={H - PAD_B - 0.5} y2={H - PAD_B - 0.5} class="zero" />
				{/if}
				{#if i % 2 === days.length % 2 || days.length <= 8}
					<text x={i * step + step / 2} y={H - 6} text-anchor="middle" class="tick"
						>{label(d.day)}</text
					>
				{/if}
			</g>
		{/each}
	</svg>
	{#if active !== null}
		{@const d = days[active]}
		<div
			class="tip pointer-events-none absolute top-0 rounded-[10px] bg-q-inverse px-3 py-2 text-[13px] text-q-on-inverse"
			style="left: clamp(0px, calc({((active + 0.5) / days.length) *
				100}% - 70px), calc(100% - 140px))"
		>
			<p class="font-medium">{formatInr(paise(d.revenue))}</p>
			<p class="opacity-80">{d.orders} order{d.orders === 1 ? '' : 's'} · {label(d.day)}</p>
		</div>
	{/if}
	<table class="sr-only">
		<caption>Revenue per day</caption>
		<thead><tr><th>Day</th><th>Revenue</th><th>Orders</th></tr></thead>
		<tbody
			>{#each days as d (d.day)}<tr
					><td>{label(d.day)}</td><td>{formatInr(paise(d.revenue))}</td><td>{d.orders}</td></tr
				>{/each}</tbody
		>
	</table>
</figure>

<style>
	.bar {
		fill: #6d7cdf;
		transition: opacity 150ms ease-out;
	}
	.bar.dim {
		opacity: 0.45;
	}
	.grid {
		stroke: var(--color-q-border);
		stroke-width: 1;
	}
	.zero {
		stroke: var(--color-q-border-strong);
		stroke-width: 1;
	}
	.tick {
		font-size: 11px;
		fill: var(--color-q-tertiary);
	}
	g:focus-visible {
		outline: none;
	}
	g:focus-visible .bar {
		stroke: var(--color-q-accent-ring);
		stroke-width: 2;
	}
	.tip {
		width: 140px;
		box-shadow: var(--q-shadow-popover);
	}
	:global(.admin-theme[data-theme='dark']) .bar {
		fill: #7888ea;
	}
	@media (prefers-color-scheme: dark) {
		:global(.admin-theme:not([data-theme='light'])) .bar {
			fill: #7888ea;
		}
	}
</style>
