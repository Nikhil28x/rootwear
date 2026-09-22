<script lang="ts">
	import SectionHead from '$lib/components/admin/SectionHead.svelte';
	import TableShell from '$lib/components/admin/TableShell.svelte';
	import StatePill from '$lib/components/admin/StatePill.svelte';
	import Notice from '$lib/components/admin/Notice.svelte';
	import { dropTone, humanise, istInputValue, shortDate, shortDateTime } from '$lib/components/admin/tone';
	import { DROP_STATE_DESCRIPTION } from '$lib/domain/drop-state';
	import { FIT_DISCLAIMER } from '$lib/drop/sizes';
	import { LAUNCH_TIME_CONFIRMED } from '$lib/drop/schedule';

	let { data, form } = $props();

	let drop = $derived(data.drop);
	let totalStock = $derived(drop.variants.reduce((n, v) => n + v.stockCount, 0));
	let totalReserved = $derived(drop.variants.reduce((n, v) => n + v.reservedCount, 0));

	/** Warn before the transition, not after: this edge would make a second live drop. */
	let liveEdges = $derived(new Set(['LIVE', 'PARTIAL', 'RE_DROP']));

	/**
	 * §07 — the tease run, derived rather than stored: one stage per day,
	 * counted back from the launch instant. Listed out so the operator sees the
	 * dates the customer will see, not an abstract stage count.
	 */
	let stages = $derived(
		Array.from({ length: data.schedule.stageCount }, (_, i) => ({
			index: i + 1,
			at: data.schedule.teaseStart + i * data.schedule.stageDurationMs
		}))
	);

	let launched = $derived(drop.launchInstant <= data.now);
</script>

<svelte:head>
	<title>Drop {String(drop.number).padStart(2, '0')} — Rootwear operations</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<p class="text-[11px] tracking-[0.24em] text-stone-400 uppercase font-medium">
	<a class="underline underline-offset-4 hover:text-stone-200" href="/admin/drops">Drops</a>
	<span aria-hidden="true"> / </span>{drop.slug}
</p>

<div class="mt-6">
	<SectionHead
		level={1}
		eyebrow="Drop {String(drop.number).padStart(2, '0')}"
		title={drop.name}
		note={DROP_STATE_DESCRIPTION[drop.state]}
	/>
</div>

<div class="mt-6 flex flex-wrap items-center gap-4">
	<StatePill label={humanise(drop.state)} tone={dropTone(drop.state)} />
	<StatePill
		label={drop.published ? 'Live on site' : 'Hidden from site'}
		tone={drop.published ? 'outline' : 'quiet'}
	/>
	<p class="text-[13px] text-stone-400 tabular-nums">
		Launch {shortDateTime(drop.launchInstant)} IST · edition of {drop.editionSize} · {totalStock} in
		stock · {totalReserved} reserved
	</p>
	<a
		class="text-[13px] tracking-[0.16em] text-stone-400 uppercase underline underline-offset-4 hover:text-cream font-medium"
		href="/drops/{drop.slug}"
	>
		View on site →
	</a>
</div>

{#if form?.message}
	<div class="mt-8">
		<!-- The action says whether it succeeded. Reading that off the wording
		     would break the first time a message was reworded. -->
		<Notice kind={form.ok ? 'success' : 'error'}>{form.message}</Notice>
	</div>
{/if}

<!-- STATE ------------------------------------------------------------------ -->
<section class="mt-16 flex flex-col gap-6 border-t border-white/10 pt-10">
	<SectionHead
		eyebrow="Lifecycle"
		title="State"
		note="Seven states, with a fixed set of legal moves between them. Only the moves that are legal from here are offered, and the server checks again before it writes."
	/>

	{#if drop.legalTransitions.length === 0}
		<Notice kind="info">
			{humanise(drop.state)} is terminal. Nothing moves out of it, and nothing is ever deleted.
		</Notice>
	{:else}
		<form method="POST" action="?/transition" class="flex flex-wrap items-end gap-6">
			<input type="hidden" name="dropId" value={drop.id} />
			<input type="hidden" name="from" value={drop.state} />

			<div class="flex min-w-[16rem] flex-col gap-2">
				<label for="to-state" class="text-[11px] tracking-[0.2em] text-stone-400 uppercase font-medium">
					Move to
				</label>
				<select
					id="to-state"
					name="to"
					required
					class="w-full border-b border-white/25 bg-transparent px-0 py-2.5 text-[15px] text-stone-100 outline-none focus:border-white"
				>
					{#each drop.legalTransitions as next (next)}
						<option value={next}>{humanise(next)} — {DROP_STATE_DESCRIPTION[next]}</option>
					{/each}
				</select>
			</div>

			<button
				type="submit"
				class="border border-white/35 px-7 py-3 text-[11px] tracking-[0.2em] text-stone-100 uppercase transition hover:bg-white hover:text-black font-medium"
			>
				Move state
			</button>
		</form>

		{#if data.othersLive.length > 0 && drop.legalTransitions.some( (next) => liveEdges.has(next) )}
			<Notice kind="warning">
				{data.othersLive.join(', ')} {data.othersLive.length === 1 ? 'is' : 'are'} already on sale.
				Moving this drop to a selling state gives you two at once — the model allows it, but the
				storefront resolves a single live drop, so one of them will not be reachable from the front
				page.
			</Notice>
		{/if}
	{/if}
</section>

<!-- SCHEDULE --------------------------------------------------------------- -->
<section class="mt-16 flex flex-col gap-6 border-t border-white/10 pt-10">
	<SectionHead
		eyebrow="Timing"
		title="Launch instant"
		note="One figure sets the whole schedule. The tease counts back from it at one stage per day, the countdown on the drop page counts down to it, and the sell-out curve is measured from it. There is no separate stage calendar to keep in step."
	/>

	<form method="POST" action="?/launchInstant" class="flex flex-wrap items-end gap-6">
		<input type="hidden" name="dropId" value={drop.id} />

		<div class="flex min-w-[16rem] flex-col gap-2">
			<label for="launch-instant" class="text-[11px] tracking-[0.2em] text-stone-400 uppercase font-medium">
				Launch date and time (IST)
			</label>
			<input
				id="launch-instant"
				name="launchInstant"
				type="datetime-local"
				required
				value={istInputValue(drop.launchInstant)}
				aria-describedby="launch-hint"
				class="w-full border-b border-white/25 bg-transparent px-0 py-2.5 text-[15px] text-stone-100 tabular-nums outline-none focus:border-white"
			/>
			<p id="launch-hint" class="text-[13px] text-stone-400">
				Read as India Standard Time, whatever zone this browser is in.
			</p>
		</div>

		<button
			type="submit"
			class="border border-white/35 px-7 py-3 text-[11px] tracking-[0.2em] text-stone-100 uppercase transition hover:bg-white hover:text-black font-medium"
		>
			Save launch instant
		</button>
	</form>

	{#if launched}
		<Notice kind="warning">
			This drop launched on {shortDateTime(drop.launchInstant)} IST. Moving the instant now moves the
			line the sell-out curve is measured against, so the shape of everything already recorded will
			change. Correct a mistyped time by all means — just know that is what it does.
		</Notice>
	{/if}

	{#if !LAUNCH_TIME_CONFIRMED}
		<Notice kind="info">
			The exact time of day is still an open item awaiting a written answer. The time saved here is
			what the countdown will show, so it is a decision, not a placeholder.
		</Notice>
	{/if}

	<div class="flex flex-col gap-4">
		<p class="text-[11px] tracking-[0.28em] text-stone-400 uppercase font-medium">
			Tease schedule, derived
		</p>
		<ol class="flex flex-wrap gap-px bg-white/10">
			{#each stages as stage (stage.index)}
				<li class="flex min-w-[7rem] flex-1 flex-col gap-1.5 bg-forest/40 px-4 py-3">
					<span class="text-[11px] tracking-[0.2em] text-stone-400 uppercase font-medium">
						Stage {stage.index}
					</span>
					<span class="text-[13px] text-stone-200 tabular-nums">{shortDate(stage.at)}</span>
				</li>
			{/each}
			<li class="flex min-w-[7rem] flex-1 flex-col gap-1.5 bg-forest/40 px-4 py-3">
				<span class="text-[11px] tracking-[0.2em] text-gold uppercase font-medium">Launch</span>
				<span class="text-[13px] text-cream tabular-nums">{shortDateTime(drop.launchInstant)}</span>
			</li>
		</ol>
		<p class="text-[13px] leading-relaxed text-stone-400">
			{data.schedule.stageCount} stages, one a day, opening {shortDate(data.schedule.teaseStart)}. The
			run length follows the number of stage assets supplied — adding one lengthens the tease and
			moves its start, with no date to edit here.
		</p>
	</div>
</section>

<!-- PUBLICATION ------------------------------------------------------------ -->
<section class="mt-16 flex flex-col gap-6 border-t border-white/10 pt-10">
	<SectionHead
		eyebrow="Visibility"
		title="Publication"
		note="Separate from state. An unpublished drop is invisible to the public even while it teases internally — the row-level policy gates anon reads on publication, not on state."
	/>

	<form method="POST" action="?/publish" class="flex flex-wrap items-center gap-5">
		<input type="hidden" name="dropId" value={drop.id} />
		<input type="hidden" name="published" value={drop.published ? 'false' : 'true'} />
		<button
			type="submit"
			class="border px-7 py-3 text-[11px] tracking-[0.2em] uppercase transition {drop.published
				? 'border-white/35 text-stone-100 hover:bg-white hover:text-black'
				: 'border-gold text-gold hover:bg-gold hover:text-forest-black'} font-medium"
		>
			{drop.published ? 'Hide from the site' : 'Publish to the site'}
		</button>
		<span class="text-[13px] text-stone-400">
			{drop.published
				? 'Anyone can reach /drops/' + drop.slug + ' right now.'
				: 'Nobody outside this screen can reach this drop.'}
		</span>
	</form>
</section>

<!-- STOCK AND CAPS --------------------------------------------------------- -->
<section class="mt-16 flex flex-col gap-6 border-t border-white/10 pt-10">
	<SectionHead
		eyebrow="Inventory"
		title="Stock and caps by size"
		note="Stock is the physical count. The cap is the ceiling on how many of that size may be reserved during the tease — it is a policy figure, not a count, so it can sit above or below stock. Reserved is maintained by the allocation function alone and is never edited by hand."
	/>

	<TableShell caption="Stock and reservation caps" note={FIT_DISCLAIMER}>
		<thead>
			<tr class="text-[11px] tracking-[0.2em] text-stone-400 uppercase font-medium">
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-left">Size</th>
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-left">SKU</th>
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-right">Reserved</th>
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-right">Sellable</th>
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-left">Stock</th>
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-left">Reserve cap</th>
				<th scope="col" class="border-b border-white/10 px-4 py-3 text-right">Save</th>
			</tr>
		</thead>
		<tbody>
			{#each drop.variants as variant (variant.id)}
				{@const sellable = Math.max(0, variant.stockCount - variant.reservedCount)}
				<tr class="text-stone-200">
					<th scope="row" class="border-b border-white/5 px-4 py-3 text-left font-normal text-cream">
						{variant.size}
					</th>
					<td class="border-b border-white/5 px-4 py-3 text-[13px] text-stone-400">{variant.sku}</td>
					<td class="border-b border-white/5 px-4 py-3 text-right tabular-nums">
						{variant.reservedCount}
					</td>
					<td
						class="border-b border-white/5 px-4 py-3 text-right tabular-nums {sellable === 0
							? 'text-gold'
							: ''}"
					>
						{sellable}{#if sellable === 0}<span class="sr-only"> — sold out</span>{/if}
					</td>
					<td class="border-b border-white/5 px-4 py-3">
						<label class="sr-only" for="stock-{variant.id}">
							Stock count for size {variant.size}
						</label>
						<input
							id="stock-{variant.id}"
							form="save-{variant.id}"
							name="stockCount"
							type="number"
							min="0"
							step="1"
							value={variant.stockCount}
							class="w-20 border-b border-white/25 bg-transparent px-0 py-2 text-[15px] text-stone-100 tabular-nums outline-none focus:border-white"
						/>
					</td>
					<td class="border-b border-white/5 px-4 py-3">
						<label class="sr-only" for="cap-{variant.id}">
							Reservation cap for size {variant.size}
						</label>
						<input
							id="cap-{variant.id}"
							form="save-{variant.id}"
							name="reserveCap"
							type="number"
							min="0"
							step="1"
							value={variant.reserveCap}
							class="w-20 border-b border-white/25 bg-transparent px-0 py-2 text-[15px] text-stone-100 tabular-nums outline-none focus:border-white"
						/>
					</td>
					<td class="border-b border-white/5 px-4 py-3 text-right">
						<form method="POST" action="?/stock" id="save-{variant.id}">
							<input type="hidden" name="variantId" value={variant.id} />
							<button
								type="submit"
								class="border border-white/25 px-4 py-2 text-[11px] tracking-[0.18em] text-stone-200 uppercase transition hover:bg-white hover:text-black font-medium"
							>
								Save
							</button>
						</form>
					</td>
				</tr>
			{/each}
		</tbody>
	</TableShell>

	<p class="text-[13px] leading-relaxed text-stone-400">
		Sold-out sizes stay visible and greyed on the storefront rather than disappearing — the scarcity
		is the point, and a size that vanishes reads as a bug.
	</p>
</section>
