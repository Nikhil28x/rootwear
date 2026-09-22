<script lang="ts">
	/**
	 * §09 — the size guide: REAL measurements in cm, chest and length, per size,
	 * plus the oversized note. "Oversized" without numbers is what causes the
	 * returns, and §11's returns policy is defects-only, so a fit mistake has
	 * nowhere to go but support.
	 *
	 * The figures come from SIZE_CHART, never retyped here: the guide, the
	 * product page and the eventual print spec have to agree to the centimetre.
	 */
	import { SIZES, SIZE_CHART, SIZE_CHART_IS_PROVISIONAL, FIT_DISCLAIMER } from '$lib/drop/sizes';

	let {
		modelHeightCm = 0,
		modelWornSize = '',
		surface = 'dark'
	}: { modelHeightCm?: number; modelWornSize?: string; surface?: 'dark' | 'light' } = $props();

	let muted = $derived(surface === 'light' ? 'text-forest/70' : 'text-stone-400');
	let faint = $derived(surface === 'light' ? 'text-forest/50' : 'text-stone-500');
	let rule = $derived(surface === 'light' ? 'border-forest/15' : 'border-white/12');
</script>

<div class="flex flex-col gap-5">
	<!-- Wide content scrolls inside its own container; the page never does. -->
	<div class="overflow-x-auto">
		<table class="w-full min-w-[26rem] border-collapse text-left">
			<caption class="sr-only">Chest and length in centimetres, by size</caption>
			<thead>
				<tr class="border-b {rule} text-[10px] tracking-[0.28em] uppercase {faint}">
					<th scope="col" class="py-3 pr-4 font-normal">Size</th>
					<th scope="col" class="py-3 pr-4 font-normal">Chest (cm)</th>
					<th scope="col" class="py-3 font-normal">Length (cm)</th>
				</tr>
			</thead>
			<tbody>
				{#each SIZES as size (size)}
					<tr class="border-b {rule}">
						<th scope="row" class="py-3 pr-4 text-xs font-normal tracking-[0.18em] uppercase">
							{size}
						</th>
						<td class="py-3 pr-4 text-sm tabular-nums {muted}">{SIZE_CHART[size].chestCm}</td>
						<td class="py-3 text-sm tabular-nums {muted}">{SIZE_CHART[size].lengthCm}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<p class="text-sm leading-relaxed {muted}">{FIT_DISCLAIMER}</p>

	{#if modelHeightCm > 0 && modelWornSize}
		<p class="text-sm leading-relaxed {muted}">
			The model is {modelHeightCm} cm and wears a {modelWornSize}.
		</p>
	{/if}

	{#if SIZE_CHART_IS_PROVISIONAL}
		<p class="text-[10px] tracking-[0.2em] uppercase {faint}">
			Measurements provisional until the garment spec is signed off.
		</p>
	{/if}
</div>
