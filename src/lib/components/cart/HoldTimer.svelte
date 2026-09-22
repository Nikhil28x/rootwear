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

	let tone = $derived(surface === 'light' ? 'text-forest/70' : 'text-stone-400');
	let strong = $derived(surface === 'light' ? 'text-forest' : 'text-stone-100');
</script>

<p class="text-[10px] tracking-[0.28em] uppercase {tone} {klass}">
	{#if expired}
		<!-- Announced, not merely greyed: the hold lapsing changes what is for
		     sale, so it is worth a screen reader's attention. -->
		<span aria-live="polite">Hold lapsed — re-checking with the server</span>
	{:else}
		<span>Held for</span>
		<!-- aria-live is deliberately off on the ticking figure: a value that
		     changes every second would be read aloud every second. -->
		<span role="timer" aria-live="off" class="ml-2 tabular-nums {strong}">{clock}</span>
	{/if}
</p>
