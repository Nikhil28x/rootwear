<script lang="ts">
	/**
	 * The order summary as a card: open beside the form on a desktop, folded to
	 * one line (with the total) at the top of a phone's page. Presentation only.
	 */
	import { onMount, type Snippet } from 'svelte';

	let {
		total,
		label = 'Order summary',
		children
	}: {
		/** The server's formatted total, shown on the folded line. */
		total: string;
		label?: string;
		children: Snippet;
	} = $props();

	let open = $state(true);

	onMount(() => {
		const phone = window.matchMedia('(max-width: 960px)');
		const sync = () => (open = !phone.matches);
		sync();
		phone.addEventListener('change', sync);
		return () => phone.removeEventListener('change', sync);
	});
</script>

<details class="panel" bind:open>
	<summary class="panel__toggle">
		<span class="panel__label">
			<svg viewBox="0 0 12 8" aria-hidden="true"><path d="M1 1.5l5 5 5-5" /></svg>
			{open ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
		</span>
		<span class="panel__total">{total}</span>
	</summary>
	<div class="panel__body">{@render children()}</div>
</details>

<style>
	.panel {
		background: #efeeeb;
	}
	.panel__toggle {
		display: none;
	}
	.panel__body {
		display: flex;
		flex-direction: column;
		gap: 28px;
		padding: clamp(24px, 2.4vw, 36px);
	}
	@media (max-width: 960px) {
		.panel__toggle {
			display: flex;
			justify-content: space-between;
			align-items: center;
			gap: 16px;
			min-height: 56px;
			padding: 0 20px;
			list-style: none;
			cursor: pointer;
			font-size: 14px;
			color: var(--color-forest-black);
		}
		.panel__toggle::-webkit-details-marker {
			display: none;
		}
		.panel__label {
			display: inline-flex;
			align-items: center;
			gap: 10px;
			text-decoration: underline;
			text-underline-offset: 4px;
			text-decoration-color: rgb(11 15 11 / 0.3);
		}
		.panel__label svg {
			width: 12px;
			height: 8px;
			fill: none;
			stroke: currentColor;
			stroke-width: 1.3;
			transition: transform 0.25s;
		}
		.panel[open] .panel__label svg {
			transform: rotate(180deg);
		}
		.panel__total {
			font-family: var(--font-display);
			font-size: 1.4rem;
			letter-spacing: -0.01em;
			font-variant-numeric: tabular-nums;
		}
		.panel__body {
			padding: 4px 20px 24px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.panel__label svg {
			transition: none;
		}
	}
</style>
