<script lang="ts">
	/**
	 * How one size's cut is split: sold, reserved, still sellable. Three
	 * segments on one rule, so a whole size curve reads down a column without
	 * anyone doing arithmetic.
	 *
	 * The numbers are printed beside it as well — the bar is the second reading
	 * of the same fact, never the only one.
	 */
	let {
		sold,
		reserved,
		remaining,
		label = ''
	}: { sold: number; reserved: number; remaining: number; label?: string } = $props();

	let total = $derived(Math.max(1, sold + reserved + remaining));
	let pctSold = $derived((sold / total) * 100);
	let pctReserved = $derived((reserved / total) * 100);
	let pctRemaining = $derived((remaining / total) * 100);
</script>

<span
	class="flex h-2 w-full min-w-[7rem] overflow-hidden bg-white/10"
	role="img"
	aria-label={label || `${sold} sold, ${reserved} reserved, ${remaining} remaining`}
>
	<span class="block h-full bg-paper" style="width: {pctSold}%"></span>
	<span class="block h-full bg-gold" style="width: {pctReserved}%"></span>
	<span class="block h-full bg-white/15" style="width: {pctRemaining}%"></span>
</span>
