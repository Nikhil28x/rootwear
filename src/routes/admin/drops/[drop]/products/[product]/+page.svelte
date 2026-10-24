<script lang="ts">
	import { enhance } from '$app/forms';
	import { Plus, Trash2 } from '@lucide/svelte';
	import Field from '$lib/components/admin/ui/Field.svelte';
	import Section from '$lib/components/admin/ui/Section.svelte';
	import Notice from '$lib/components/admin/Notice.svelte';
	import ProductFields from '$lib/components/admin/ProductFields.svelte';
	import { submitter } from '$lib/components/admin/enhance';
	import { getToaster } from '$lib/components/admin/toast.svelte';
	import { shortDate } from '$lib/components/admin/tone';
	import { formatInr, type Paise } from '$lib/money';
	import { SIZE_CHART } from '$lib/drop/sizes';

	let { data, form } = $props();
	const toaster = getToaster();

	let product = $derived(data.product);
	let chosen = $state<string[]>([]);
	$effect.pre(() => {
		chosen = [...data.product.sizes];
	});
	let sizesChanged = $derived([...chosen].sort().join() !== [...product.sizes].sort().join());

	const rupees = (value: Paise) => String(Number(value) / 100);

	let values = $derived({
		name: product.name,
		summary: product.summary,
		fabric: product.fabric,
		gsm: String(product.gsm),
		fit: product.fit,
		fitNote: product.fitNote ?? '',
		care: product.care.join('\n'),
		modelHeightCm: product.modelHeightCm ? String(product.modelHeightCm) : '',
		modelWornSize: product.modelWornSize ?? '',
		styleCode: product.styleCode,
		launchPrice: rupees(product.launchPrice),
		prelaunchPrice: rupees(product.prelaunchPrice),
		hsnCode: product.hsnCode,
		gstRate: String(product.gstRate)
	});

	function chartValue(size: string, field: 'chestCm' | 'lengthCm'): string {
		const own = product.sizeChart.find((row) => row.size === size);
		if (own) return String(own[field]);
		const fallback = SIZE_CHART[size];
		return fallback ? String(fallback[field]) : '';
	}

	let newColour = $state({ name: '', code: '', swatch: '#1f382a' });
</script>

<svelte:head><title>{product.name} · Rootwear admin</title></svelte:head>

{#if form && 'error' in form}<Notice kind="error">{form.error}</Notice>{/if}

<div class="grid gap-10 xl:grid-cols-[minmax(0,1fr)_400px]">
	<div class="flex min-w-0 flex-col gap-10">
		<Section title="The piece">
			<form
				method="POST"
				action="?/details"
				class="flex max-w-[640px] flex-col gap-4"
				use:enhance={submitter(toaster)}
			>
				<fieldset disabled={!data.canEdit} class="flex flex-col gap-4">
					<ProductFields {values} sizes={data.sizeOptions} section="details" />
				</fieldset>
				{#if data.canEdit}<div>
						<button type="submit" class="q-btn q-btn-primary">Save details</button>
					</div>{/if}
			</form>
		</Section>

		<Section
			title="Size guide"
			description="Garment measurements in centimetres, shown on the product page. Blank rows use Drop 01’s figures where they exist."
		>
			<form
				method="POST"
				action="?/sizeChart"
				class="flex max-w-[480px] flex-col gap-4"
				use:enhance={submitter(toaster)}
			>
				<div class="q-table-wrap">
					<table class="q-table">
						<thead
							><tr
								><th scope="col">Size</th><th scope="col">Chest (cm)</th><th scope="col"
									>Length (cm)</th
								></tr
							></thead
						>
						<tbody>
							{#each product.sizes as size (size)}
								<tr>
									<td class="font-medium text-q-text">{size}</td>
									<td
										><input
											aria-label="{size} chest"
											name="chest_{size}"
											inputmode="decimal"
											class="q-input q-input-sm w-24 tabular-nums"
											value={chartValue(size, 'chestCm')}
											disabled={!data.canEdit}
										/></td
									>
									<td
										><input
											aria-label="{size} length"
											name="length_{size}"
											inputmode="decimal"
											class="q-input q-input-sm w-24 tabular-nums"
											value={chartValue(size, 'lengthCm')}
											disabled={!data.canEdit}
										/></td
									>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				{#if data.canEdit && product.sizes.length}<div>
						<button type="submit" class="q-btn q-btn-secondary">Save size guide</button>
					</div>{/if}
			</form>
		</Section>
	</div>

	<aside class="flex flex-col gap-10">
		<Section title="Price and tax">
			<form
				method="POST"
				action="?/price"
				class="flex flex-col gap-4"
				use:enhance={submitter(toaster)}
			>
				<fieldset disabled={!data.canEdit} class="flex flex-col gap-4">
					<ProductFields {values} sizes={data.sizeOptions} section="price" />
				</fieldset>
				{#if data.canEdit}<div>
						<button type="submit" class="q-btn q-btn-secondary">Save price</button>
					</div>{/if}
			</form>
			{#if data.priceHistory.length}
				<details class="text-[13px]">
					<summary class="cursor-pointer text-q-secondary">Price history</summary>
					<ul class="mt-2 flex flex-col gap-1 text-q-body">
						{#each data.priceHistory as point, i (i)}
							<li class="flex justify-between gap-4">
								<span>{point.kind === 'launch' ? 'Launch' : 'Pre-launch'} {point.price}</span>
								<span class="text-q-tertiary">{shortDate(point.at)}</span>
							</li>
						{/each}
					</ul>
				</details>
			{/if}
		</Section>

		<Section
			title="Sizes"
			description="Removing a size deletes it only if nobody has bought, reserved or carted it."
		>
			<form
				method="POST"
				action="?/sizes"
				class="flex flex-col gap-3"
				use:enhance={submitter(toaster)}
			>
				<fieldset class="flex flex-wrap gap-2" disabled={!data.canEdit}>
					<legend class="sr-only">Sizes</legend>
					{#each data.sizeOptions as size (size.code)}
						<label
							class="flex h-9 cursor-pointer items-center gap-2 rounded-[10px] border px-3 text-[14px] {chosen.includes(
								size.code
							)
								? 'border-q-accent bg-q-accent-tint text-q-text'
								: 'border-q-border-strong text-q-body'}"
						>
							<input
								type="checkbox"
								class="q-check"
								name="sizes"
								value={size.code}
								bind:group={chosen}
							/>
							{size.label}
						</label>
					{/each}
				</fieldset>
				{#if data.canEdit}<div>
						<button type="submit" class="q-btn q-btn-secondary" disabled={!sizesChanged}
							>Save sizes</button
						>
					</div>{/if}
			</form>
			{#if data.canEdit}
				<details>
					<summary class="cursor-pointer text-[13px] text-q-secondary"
						>A size that is not listed</summary
					>
					<form
						method="POST"
						action="?/addSize"
						class="mt-3 flex items-end gap-2"
						use:enhance={submitter(toaster, { reset: true })}
					>
						<Field label="Code" id="s-code">
							{#snippet children({ describedBy })}<input
									id="s-code"
									name="code"
									class="q-input q-mono w-24 uppercase"
									maxlength="5"
									placeholder="6XL"
									aria-describedby={describedBy}
									required
								/>{/snippet}
						</Field>
						<Field label="Label" id="s-label" optional>
							{#snippet children({ describedBy })}<input
									id="s-label"
									name="label"
									class="q-input"
									aria-describedby={describedBy}
								/>{/snippet}
						</Field>
						<button type="submit" class="q-btn q-btn-secondary">Add size</button>
					</form>
				</details>
			{/if}
		</Section>

		<Section
			title="Colours"
			description={product.colourways.length
				? 'Each colour comes in every size.'
				: 'One colour for now. Add colours to sell it in more than one.'}
		>
			<div class="flex flex-col gap-3">
				{#each product.colourways as colour (colour.id)}
					<div class="flex items-end gap-2">
						<form
							method="POST"
							action="?/editColour"
							class="flex flex-1 items-end gap-2"
							use:enhance={submitter(toaster)}
						>
							<input type="hidden" name="colourwayId" value={colour.id} />
							<label class="flex flex-col gap-2"
								><span class="sr-only">Swatch</span>
								<input
									type="color"
									name="swatch"
									value={colour.swatch ?? '#888888'}
									class="h-9 w-11 cursor-pointer rounded-[10px] border border-q-border-input bg-q-surface p-1"
									disabled={!data.canEdit}
								/>
							</label>
							<label class="flex flex-1 flex-col gap-2"
								><span class="sr-only">Name</span>
								<input name="name" value={colour.name} class="q-input" disabled={!data.canEdit} />
							</label>
							<span class="q-mono flex h-9 items-center text-q-tertiary">{colour.code}</span>
							{#if data.canEdit}<button type="submit" class="q-btn q-btn-secondary q-btn-sm"
									>Save</button
								>{/if}
						</form>
						{#if data.canEdit}
							<form method="POST" action="?/removeColour" use:enhance={submitter(toaster)}>
								<input type="hidden" name="colourwayId" value={colour.id} />
								<button
									type="submit"
									class="q-btn q-btn-ghost q-btn-icon"
									aria-label="Remove {colour.name}"><Trash2 /></button
								>
							</form>
						{/if}
					</div>
				{/each}
				{#if data.canEdit}
					<form
						method="POST"
						action="?/addColour"
						class="flex items-end gap-2 rounded-[10px] bg-q-muted p-3"
						use:enhance={submitter(toaster, {
							onSuccess: () => (newColour = { name: '', code: '', swatch: '#1f382a' })
						})}
					>
						<label class="flex flex-col gap-2"
							><span class="sr-only">Swatch</span>
							<input
								type="color"
								name="swatch"
								bind:value={newColour.swatch}
								class="h-9 w-11 cursor-pointer rounded-[10px] border border-q-border-input bg-q-surface p-1"
							/>
						</label>
						<label class="flex flex-1 flex-col gap-2"
							><span class="q-label">New colour</span>
							<input
								name="name"
								class="q-input"
								bind:value={newColour.name}
								oninput={() =>
									(newColour.code = newColour.name
										.replace(/[^A-Za-z]/g, '')
										.slice(0, 3)
										.toUpperCase())}
								placeholder="Forest"
								required
							/>
						</label>
						<label class="flex flex-col gap-2"
							><span class="q-label">Code</span>
							<input
								name="code"
								class="q-input q-mono w-20 uppercase"
								maxlength="4"
								bind:value={newColour.code}
								required
							/>
						</label>
						<button type="submit" class="q-btn q-btn-secondary"><Plus /> Add</button>
					</form>
					{#if product.colourways.length === 0 && product.variants.length}
						<p class="q-help">The first colour takes over the current sizes and their stock.</p>
					{/if}
				{/if}
			</div>
		</Section>
	</aside>
</div>
