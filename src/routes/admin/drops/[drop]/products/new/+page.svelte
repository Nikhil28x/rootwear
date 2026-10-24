<script lang="ts">
	import { enhance } from '$app/forms';
	import { Plus, X } from '@lucide/svelte';
	import PageHeader from '$lib/components/admin/ui/PageHeader.svelte';
	import Section from '$lib/components/admin/ui/Section.svelte';
	import Notice from '$lib/components/admin/Notice.svelte';
	import ProductFields from '$lib/components/admin/ProductFields.svelte';
	import { submitter } from '$lib/components/admin/enhance';
	import { getToaster } from '$lib/components/admin/toast.svelte';
	import { dropNumber } from '$lib/components/admin/drop-labels';

	let { data, form } = $props();
	const toaster = getToaster();

	const DEFAULT_SIZES = ['XS', 'S', 'M', 'L', 'XL'];
	let chosen = $state<string[]>([]);
	let colours = $state<{ name: string; code: string; swatch: string }[]>([]);
	$effect.pre(() => {
		chosen = form?.sizes ? [...form.sizes] : [...DEFAULT_SIZES];
		colours = form?.colourways
			? form.colourways.map((c) => ({ name: c.name, code: c.code, swatch: c.swatch ?? '#1f382a' }))
			: [];
	});

	function codeFor(name: string): string {
		return name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();
	}
</script>

<svelte:head><title>New product · Drop {dropNumber(data.drop.number)} · Rootwear admin</title></svelte:head>

<div class="flex max-w-[640px] flex-col gap-8">
	<PageHeader
		title="New product"
		description="It is saved as a draft. Add photos and stock, then make it live."
		back={{ href: `/admin/drops/${data.drop.slug}`, label: `Drop ${dropNumber(data.drop.number)} — ${data.drop.name}` }}
	/>

	{#if form?.error}<Notice kind="error">{form.error}</Notice>{/if}

	<form method="POST" class="flex flex-col gap-10" use:enhance={submitter(toaster)}>
		<Section title="The piece">
			<div class="flex flex-col gap-4">
				<ProductFields values={form?.values ?? { name: `${data.drop.name} Tee`, styleCode: 'TEE', gsm: '240' }} sizes={data.sizes} section="details" />
			</div>
		</Section>

		<Section title="Price and tax">
			<div class="flex flex-col gap-4">
				<ProductFields values={form?.values ?? {}} sizes={data.sizes} section="price" />
			</div>
		</Section>

		<Section title="Sizes" description="Every size it is cut in. Stock starts at 0; set it on the Stock tab.">
			<fieldset class="flex flex-wrap gap-2">
				<legend class="sr-only">Sizes</legend>
				{#each data.sizes as size (size.code)}
					<label class="flex h-9 cursor-pointer items-center gap-2 rounded-[10px] border px-3 text-[14px] {chosen.includes(size.code) ? 'border-q-accent bg-q-accent-tint text-q-text' : 'border-q-border-strong text-q-body'}">
						<input type="checkbox" class="q-check" name="sizes" value={size.code} bind:group={chosen} />
						{size.label}
					</label>
				{/each}
			</fieldset>
		</Section>

		<Section title="Colours" description="Optional. Leave empty for a single colour, as Drop 01 has.">
			<div class="flex flex-col gap-3">
				{#each colours as colour, i (i)}
					<div class="grid grid-cols-[44px_1fr_96px_36px] items-end gap-2">
						<label class="flex flex-col gap-2">
							<span class="sr-only">Swatch</span>
							<input type="color" name="colourSwatch" class="h-9 w-11 cursor-pointer rounded-[10px] border border-q-border-input bg-q-surface p-1" bind:value={colour.swatch} />
						</label>
						<label class="flex flex-col gap-2">
							<span class="q-label">Name</span>
							<input name="colourName" class="q-input" bind:value={colour.name} oninput={() => (colour.code = codeFor(colour.name))} placeholder="Forest" />
						</label>
						<label class="flex flex-col gap-2">
							<span class="q-label">Code</span>
							<input name="colourCode" class="q-input q-mono uppercase" bind:value={colour.code} maxlength="4" />
						</label>
						<button type="button" class="q-btn q-btn-ghost q-btn-icon" aria-label="Remove {colour.name || 'colour'}" onclick={() => colours.splice(i, 1)}><X /></button>
					</div>
				{/each}
				<button type="button" class="q-btn q-btn-secondary w-fit" onclick={() => colours.push({ name: '', code: '', swatch: '#1f382a' })}>
					<Plus /> Add colour
				</button>
			</div>
		</Section>

		<div class="flex gap-2">
			<button type="submit" class="q-btn q-btn-primary">Create draft</button>
			<a href="/admin/drops/{data.drop.slug}" class="q-btn q-btn-ghost">Cancel</a>
		</div>
	</form>
</div>
