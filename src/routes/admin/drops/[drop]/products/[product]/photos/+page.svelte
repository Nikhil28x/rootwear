<script lang="ts">
	import { enhance, deserialize } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { ChevronLeft, ChevronRight, ImagePlus, Images, Trash2, Upload } from '@lucide/svelte';
	import EmptyState from '$lib/components/admin/ui/EmptyState.svelte';
	import Field from '$lib/components/admin/ui/Field.svelte';
	import Section from '$lib/components/admin/ui/Section.svelte';
	import Notice from '$lib/components/admin/Notice.svelte';
	import { submitter } from '$lib/components/admin/enhance';
	import { getToaster } from '$lib/components/admin/toast.svelte';

	let { data, form } = $props();
	const toaster = getToaster();

	let product = $derived(data.product);
	let chosen = $state<FileList | null>(null);
	const ROLES = [
		{ value: 'lead', label: 'Lead — archive, cart and first in the gallery' },
		{ value: 'detail', label: 'Detail — second in the gallery' },
		{ value: 'fabric', label: 'Hero cut-out — transparent PNG over the name' },
		{ value: 'worn', label: 'Worn — the full-width photo' }
	];

	/** The product page has a place for each role; these are the empty ones. */
	let missing = $derived(
		[
			!product.images.some((i) => i.role === 'lead') && 'a lead photo',
			!product.images.some((i) => i.role === 'fabric') && 'a hero cut-out (transparent PNG)',
			!product.images.some((i) => i.role === 'worn') && 'a worn photo'
		].filter(Boolean) as string[]
	);

	async function restore(image: unknown) {
		const body = new FormData();
		body.set('image', JSON.stringify(image));
		const response = await fetch('?/restore', {
			method: 'POST',
			body,
			headers: { 'x-sveltekit-action': 'true' }
		});
		const result = deserialize(await response.text());
		if (result.type === 'success') toaster.success('Photo restored.');
		else toaster.error('Could not restore that photo.');
		await invalidateAll();
	}
</script>

<svelte:head><title>Photos · {product.name} · Rootwear admin</title></svelte:head>

<div class="flex flex-col gap-8">
	{#if form?.error}<Notice kind="error">{form.error}</Notice>{/if}
	{#if product.images.length && missing.length}
		<Notice kind="warning"
			>The product page also has a place for {missing.join(', ')}. It works without, but looks
			emptier.</Notice
		>
	{/if}

	{#if data.canEdit}
		<Section
			title="Add photos"
			description="JPG, PNG, WebP or AVIF, up to 10 MB each. Export at 1600–2400 px wide."
		>
			<form
				method="POST"
				action="?/upload"
				enctype="multipart/form-data"
				class="q-card flex flex-col gap-4 p-4"
				use:enhance={submitter(toaster, { reset: true, onSuccess: () => (chosen = null) })}
			>
				<label
					class="flex cursor-pointer flex-col items-center gap-2 rounded-[10px] border border-dashed border-q-border-strong px-6 py-8 text-center hover:bg-q-muted"
				>
					<Upload size={24} strokeWidth={1.5} class="text-q-tertiary" />
					<span class="text-[14px] font-medium text-q-text">
						{chosen?.length
							? `${chosen.length} photo${chosen.length === 1 ? '' : 's'} chosen`
							: 'Choose photos'}
					</span>
					<span class="text-[13px] text-q-secondary"
						>{chosen?.length
							? [...chosen].map((f) => f.name).join(', ')
							: 'or drop them here'}</span
					>
					<input
						type="file"
						name="files"
						accept="image/jpeg,image/png,image/webp,image/avif"
						multiple
						class="sr-only"
						bind:files={chosen}
						required
					/>
				</label>
				<div class="grid gap-4 sm:grid-cols-[1fr_200px_200px]">
					<Field
						label="Description"
						id="up-alt"
						optional
						help="What the photo shows, for screen readers. Each photo can be edited after."
					>
						{#snippet children({ describedBy })}
							<input
								id="up-alt"
								name="alt"
								class="q-input"
								placeholder="Back of the tee, worn"
								aria-describedby={describedBy}
							/>
						{/snippet}
					</Field>
					<Field label="Role" id="up-role">
						{#snippet children({ describedBy })}
							<select id="up-role" name="role" class="q-select" aria-describedby={describedBy}>
								{#each ROLES as r (r.value)}<option
										value={r.value}
										selected={r.value === (product.images.length ? 'detail' : 'lead')}
										>{r.label}</option
									>{/each}
							</select>
						{/snippet}
					</Field>
					{#if product.colourways.length}
						<Field label="Colour" id="up-colour">
							{#snippet children({ describedBy })}
								<select
									id="up-colour"
									name="colourwayId"
									class="q-select"
									aria-describedby={describedBy}
								>
									<option value="">All colours</option>
									{#each product.colourways as c (c.id)}<option value={c.id}>{c.name}</option
										>{/each}
								</select>
							{/snippet}
						</Field>
					{/if}
				</div>
				<div>
					<button type="submit" class="q-btn q-btn-primary" disabled={!chosen?.length}
						><ImagePlus /> Upload</button
					>
				</div>
			</form>
		</Section>
	{/if}

	<Section title="Photos" description="In the order the product page shows them.">
		{#if product.images.length === 0}
			<div class="q-card">
				<EmptyState
					icon={Images}
					title="No photos yet"
					body="Upload a lead photo first; it is the one people see in the archive and the cart."
					compact
				/>
			</div>
		{:else}
			<ul class="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
				{#each product.images as image, index (image.id)}
					<li class="q-card flex flex-col overflow-hidden">
						<div
							class="relative bg-q-muted"
							style="aspect-ratio: {image.width && image.height
								? `${image.width} / ${image.height}`
								: '4 / 5'}"
						>
							<img
								src={image.url}
								alt={image.alt}
								class="absolute inset-0 size-full object-contain"
								loading="lazy"
							/>
							<span
								class="absolute top-2 left-2 rounded-full bg-q-inverse px-2 py-0.5 text-[12px] text-q-on-inverse"
								>{index + 1}</span
							>
						</div>
						<form
							method="POST"
							action="?/update"
							class="flex flex-col gap-3 p-4"
							use:enhance={submitter(toaster, {
								onSuccess: (result) => {
									if (result?.removed) {
										toaster.push('Photo deleted.', {
											action: { label: 'Undo', run: () => restore(result.removed) }
										});
									}
								}
							})}
						>
							<input type="hidden" name="imageId" value={image.id} />
							<fieldset disabled={!data.canEdit} class="flex flex-col gap-3">
								<label class="flex flex-col gap-1.5"
									><span class="q-label">Description</span>
									<input name="alt" class="q-input" value={image.alt} required />
								</label>
								<div class="grid grid-cols-2 gap-2">
									<label class="flex flex-col gap-1.5"
										><span class="q-label">Role</span>
										<select name="role" class="q-select"
											>{#each ROLES as r (r.value)}<option
													value={r.value}
													selected={image.role === r.value}>{r.label.split(' — ')[0]}</option
												>{/each}</select
										>
									</label>
									{#if product.colourways.length}
										<label class="flex flex-col gap-1.5"
											><span class="q-label">Colour</span>
											<select name="colourwayId" class="q-select"
												><option value="">All</option>{#each product.colourways as c (c.id)}<option
														value={c.id}
														selected={image.colourwayId === c.id}>{c.name}</option
													>{/each}</select
											>
										</label>
									{/if}
								</div>
								<label class="flex flex-col gap-1.5"
									><span class="q-label"
										>Caption <span class="font-normal text-q-tertiary">(optional)</span></span
									>
									<input
										name="caption"
										class="q-input"
										value={image.caption ?? ''}
										placeholder="On the back"
									/>
								</label>
							</fieldset>
							{#if data.canEdit}
								<div class="flex items-center justify-between gap-2">
									<button type="submit" class="q-btn q-btn-secondary q-btn-sm">Save</button>
									<div class="flex gap-1">
										<button
											type="submit"
											formaction="?/move"
											name="direction"
											value="back"
											class="q-btn q-btn-ghost q-btn-sm q-btn-icon"
											aria-label="Move earlier"
											disabled={index === 0}><ChevronLeft /></button
										>
										<button
											type="submit"
											formaction="?/move"
											name="direction"
											value="forward"
											class="q-btn q-btn-ghost q-btn-sm q-btn-icon"
											aria-label="Move later"
											disabled={index === product.images.length - 1}><ChevronRight /></button
										>
										<button
											type="submit"
											formaction="?/remove"
											class="q-btn q-btn-danger-ghost q-btn-sm q-btn-icon"
											aria-label="Delete photo {index + 1}"><Trash2 /></button
										>
									</div>
								</div>
							{/if}
						</form>
					</li>
				{/each}
			</ul>
		{/if}
	</Section>
</div>
