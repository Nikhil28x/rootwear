<script lang="ts">
	/**
	 * Between pages: a thin bar runs across the top while the next page loads,
	 * and the current page dims a touch and breathes, so a slow link never
	 * feels like a dead click. It waits 150 ms before showing, so fast
	 * navigations (most of them) never flash it. Never blocks input.
	 */
	import { navigating } from '$app/state';

	const DELAY = 150;
	let shown = $state(false);

	$effect(() => {
		if (!navigating.to) {
			shown = false;
			return;
		}
		const timer = setTimeout(() => (shown = true), DELAY);
		return () => clearTimeout(timer);
	});
</script>

{#if shown}
	<div class="nav-loader" role="progressbar" aria-label="Loading the page" aria-busy="true">
		<span class="nav-loader__bar"></span>
	</div>
	<div class="nav-veil" aria-hidden="true"></div>
{/if}

<style>
	.nav-loader {
		position: fixed;
		inset: 0 0 auto 0;
		height: 2px;
		z-index: 1000;
		overflow: hidden;
		pointer-events: none;
		background: rgb(180 160 130 / 0.25);
	}
	.nav-loader__bar {
		position: absolute;
		inset: 0 auto 0 0;
		width: 40%;
		background: linear-gradient(90deg, transparent, #c8b48f 30%, #e6dccb 60%, transparent);
		animation: nav-run 1.1s cubic-bezier(0.45, 0, 0.25, 1) infinite;
	}
	@keyframes nav-run {
		from {
			transform: translateX(-100%);
		}
		to {
			transform: translateX(260%);
		}
	}
	/* The page waiting: a soft grey-out that breathes. */
	.nav-veil {
		position: fixed;
		inset: 0;
		z-index: 999;
		pointer-events: none;
		background: rgb(20 20 20 / 0.08);
		backdrop-filter: grayscale(0.35);
		-webkit-backdrop-filter: grayscale(0.35);
		animation:
			nav-veil-in 0.25s ease both,
			nav-breathe 1.6s ease-in-out 0.25s infinite;
	}
	@keyframes nav-veil-in {
		from {
			opacity: 0;
		}
	}
	@keyframes nav-breathe {
		50% {
			opacity: 0.55;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.nav-loader__bar {
			animation: none;
			width: 100%;
			opacity: 0.8;
		}
		.nav-veil {
			animation: nav-veil-in 0.25s ease both;
		}
	}
</style>
