<script lang="ts">
	import Field from '$lib/components/admin/ui/Field.svelte';

	/**
	 * The product's own fields, shared by "new" and "edit" so the two can
	 * never ask for different things. Values are strings as typed; prices are
	 * rupees here and become paise on the server.
	 */
	let {
		values,
		sizes,
		section = 'all'
	}: {
		values: Record<string, string>;
		sizes: readonly { code: string; label: string }[];
		section?: 'all' | 'details' | 'price';
	} = $props();
</script>

{#if section !== 'price'}
	<div class="grid gap-4 sm:grid-cols-[1fr_140px]">
		<Field label="Name" id="p-name" help="As shown on the site, e.g. Pineapple Haze Tee.">
			{#snippet children({ describedBy })}
				<input
					id="p-name"
					name="name"
					class="q-input"
					value={values.name ?? ''}
					required
					aria-describedby={describedBy}
				/>
			{/snippet}
		</Field>
		<Field label="Style code" id="p-style" help="In the SKU.">
			{#snippet children({ describedBy })}
				<input
					id="p-style"
					name="styleCode"
					class="q-input q-mono uppercase"
					value={values.styleCode ?? 'TEE'}
					maxlength="5"
					pattern="[A-Za-z]{'{'}2,5{'}'}"
					required
					aria-describedby={describedBy}
				/>
			{/snippet}
		</Field>
	</div>
	<Field
		label="Summary"
		id="p-summary"
		optional
		help="One or two lines for search results and link previews."
	>
		{#snippet children({ describedBy })}
			<textarea
				id="p-summary"
				name="summary"
				class="q-textarea min-h-[72px]"
				aria-describedby={describedBy}>{values.summary ?? ''}</textarea
			>
		{/snippet}
	</Field>
	<div class="grid gap-4 sm:grid-cols-[1fr_120px]">
		<Field
			label="Fabric"
			id="p-fabric"
			help="Percentages that add up to 100 draw the fibre bar on the page."
		>
			{#snippet children({ describedBy })}
				<input
					id="p-fabric"
					name="fabric"
					class="q-input"
					value={values.fabric ?? ''}
					placeholder="30% hemp / 70% cotton"
					required
					aria-describedby={describedBy}
				/>
			{/snippet}
		</Field>
		<Field label="GSM" id="p-gsm">
			{#snippet children({ describedBy })}
				<input
					id="p-gsm"
					name="gsm"
					type="number"
					min="1"
					class="q-input"
					value={values.gsm ?? ''}
					required
					aria-describedby={describedBy}
				/>
			{/snippet}
		</Field>
	</div>
	<Field label="Fit" id="p-fit">
		{#snippet children({ describedBy })}
			<input
				id="p-fit"
				name="fit"
				class="q-input"
				value={values.fit ?? ''}
				placeholder="Oversized, dropped shoulder"
				aria-describedby={describedBy}
			/>
		{/snippet}
	</Field>
	<Field label="Care" id="p-care" optional help="One instruction per line.">
		{#snippet children({ describedBy })}
			<textarea
				id="p-care"
				name="care"
				class="q-textarea min-h-[96px]"
				aria-describedby={describedBy}>{values.care ?? ''}</textarea
			>
		{/snippet}
	</Field>
	<div class="grid gap-4 sm:grid-cols-2">
		<Field label="Model height (cm)" id="p-model-h" optional>
			{#snippet children({ describedBy })}
				<input
					id="p-model-h"
					name="modelHeightCm"
					type="number"
					min="100"
					max="230"
					class="q-input"
					value={values.modelHeightCm ?? ''}
					aria-describedby={describedBy}
				/>
			{/snippet}
		</Field>
		<Field label="Model wears" id="p-model-s" optional>
			{#snippet children({ describedBy })}
				<select id="p-model-s" name="modelWornSize" class="q-select" aria-describedby={describedBy}>
					<option value="">—</option>
					{#each sizes as size (size.code)}
						<option value={size.code} selected={values.modelWornSize === size.code}
							>{size.label}</option
						>
					{/each}
				</select>
			{/snippet}
		</Field>
	</div>
	<Field
		label="Fit note"
		id="p-fit-note"
		optional
		help="Shown next to the sizes, e.g. “Runs large; most people size down.”"
	>
		{#snippet children({ describedBy })}
			<input
				id="p-fit-note"
				name="fitNote"
				class="q-input"
				value={values.fitNote ?? ''}
				aria-describedby={describedBy}
			/>
		{/snippet}
	</Field>
{/if}

{#if section !== 'details'}
	<div class="grid gap-4 sm:grid-cols-2">
		<Field label="Launch price (₹)" id="p-launch" help="Including tax, as customers pay it.">
			{#snippet children({ describedBy })}
				<input
					id="p-launch"
					name="launchPrice"
					inputmode="decimal"
					class="q-input tabular-nums"
					value={values.launchPrice ?? ''}
					required
					aria-describedby={describedBy}
				/>
			{/snippet}
		</Field>
		<Field
			label="Pre-launch price (₹)"
			id="p-prelaunch"
			optional
			help="Locked in by reservations during the tease. Blank means the same."
		>
			{#snippet children({ describedBy })}
				<input
					id="p-prelaunch"
					name="prelaunchPrice"
					inputmode="decimal"
					class="q-input tabular-nums"
					value={values.prelaunchPrice ?? ''}
					aria-describedby={describedBy}
				/>
			{/snippet}
		</Field>
	</div>
	<div class="grid gap-4 sm:grid-cols-2">
		<Field label="HSN code" id="p-hsn" help="6109 for knitted T-shirts.">
			{#snippet children({ describedBy })}
				<input
					id="p-hsn"
					name="hsnCode"
					inputmode="numeric"
					class="q-input q-mono"
					value={values.hsnCode ?? '6109'}
					aria-describedby={describedBy}
				/>
			{/snippet}
		</Field>
		<Field label="GST rate (%)" id="p-gst" help="Printed on invoices once GST is switched on.">
			{#snippet children({ describedBy })}
				<input
					id="p-gst"
					name="gstRate"
					inputmode="decimal"
					class="q-input tabular-nums"
					value={values.gstRate ?? '5'}
					aria-describedby={describedBy}
				/>
			{/snippet}
		</Field>
	</div>
{/if}
