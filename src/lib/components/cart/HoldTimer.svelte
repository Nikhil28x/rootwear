<script lang="ts">
	/**
	 * §10 — the cart-reservation window, counted down honestly.
	 *
	 * TWO CLOCKS, and picking the wrong one is the bug this component exists to
	 * avoid. The expiry is a SERVER instant. The remaining time is fixed once,
	 * at render, as `expiresAt - serverNow`. Everything after that is measured
	 * with `performance.now()`, which is MONOTONIC: it cannot be moved by the
	 * visitor, by a timezone change, or by an NTP correction. Counting with
	 * `Date.now()` would let a device with its clock wound back hold stock
	 * indefinitely — the same class of bug §04 forbids for the drop countdown.
	 *
	 * And when it reaches zero the component does NOT decide anything. It calls
	 * `onexpire`, the page re-asks the server, and the server says what the cart
	 * is now. A client that decided its own hold had lapsed would be guessing.
	 */
	let {
		expiresAtMs,
		serverNowMs,
		onexpire,
		surface = 'light',
		class: klass = ''
	}: {
		expiresAtMs: number;
		serverNowMs: number;
		onexpire?: () => void;
		surface?: 'light' | 'dark';
		class?: string;
	} = $props();

	/**
	 * The window the SERVER granted, measured once from the instant the page
	 * was priced. Derived, not captured: a fresh load (or an `invalidateAll`
	 * after the hold lapses) hands down new props and the countdown restarts
	 * from the server's figure rather than the one it first saw.
	 */
	let windowMs = $derived(Math.max(0, expiresAtMs - serverNowMs));

	/** Monotonic time since this window started. Never a wall-clock reading. */
	let elapsedMs = $state(0);

	$effect(() => {
		const granted = windowMs;
		const origin = performance.now();
		elapsedMs = 0;

		if (granted <= 0) {
			onexpire?.();
			return;
		}

		const id = setInterval(() => {
			elapsedMs = performance.now() - origin;
			if (elapsedMs >= granted) {
				clearInterval(id);
				// Re-ask the server rather than deciding locally.
				onexpire?.();
			}
		}, 1000);

		return () => clearInterval(id);
	});

	let remainingMs = $derived(Math.max(0, windowMs - elapsedMs));

	let totalSeconds = $derived(Math.ceil(remainingMs / 1000));
	let minutes = $derived(Math.floor(totalSeconds / 60));
	let seconds = $derived(totalSeconds % 60);
	let clock = $derived(`${minutes}:${String(seconds).padStart(2, '0')}`);
	let expired = $derived(remainingMs <= 0);

	let tone = $derived(surface === 'light' ? 'hold--light' : 'hold--dark');
</script>

<p class="hold {tone} {klass}">
	{#if expired}
		<!-- Announced, not merely greyed: the hold lapsing changes what is for
		     sale, so it is worth a screen reader's attention. -->
		<span aria-live="polite">Reservation expired — updating your cart</span>
	{:else}
		<span class="hold__dot" aria-hidden="true"></span>
		<span>Reserved for</span>
		<!-- aria-live is deliberately off on the ticking figure: a value that
		     changes every second would be read aloud every second. -->
		<span role="timer" aria-live="off" class="hold__clock">{clock}</span>
	{/if}
</p>

<style>
	.hold {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 0;
		font-size: 13px;
	}
	.hold--light {
		color: rgb(11 15 11 / 0.62);
		--hold-strong: var(--color-forest-black);
	}
	.hold--dark {
		color: #a8a29e;
		--hold-strong: #f5f5f4;
	}
	.hold__dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--hold-strong);
		animation: hold-pulse 2.4s ease-in-out infinite;
	}
	@keyframes hold-pulse {
		50% {
			opacity: 0.25;
		}
	}
	.hold__clock {
		color: var(--hold-strong);
		font-variant-numeric: tabular-nums;
	}
	@media (prefers-reduced-motion: reduce) {
		.hold__dot {
			animation: none;
		}
	}
</style>
