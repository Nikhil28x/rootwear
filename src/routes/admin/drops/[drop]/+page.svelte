<script lang="ts">
	import { enhance } from '$app/forms';
	import { ArrowDown, ArrowUp, Check, Copy, ExternalLink, Image, Link, Plus } from '@lucide/svelte';
	import Chip from '$lib/components/admin/ui/Chip.svelte';
	import EmptyState from '$lib/components/admin/ui/EmptyState.svelte';
	import Field from '$lib/components/admin/ui/Field.svelte';
	import PageHeader from '$lib/components/admin/ui/PageHeader.svelte';
	import Section from '$lib/components/admin/ui/Section.svelte';
	import Timeline from '$lib/components/admin/ui/Timeline.svelte';
	import Notice from '$lib/components/admin/Notice.svelte';
	import { submitter } from '$lib/components/admin/enhance';
	import { getToaster } from '$lib/components/admin/toast.svelte';
	import {
		DROP_STATE,
		PRODUCT_STATUS,
		dropNumber,
		dropState
	} from '$lib/components/admin/drop-labels';
	import { istInputValue, relativeDays, shortDateTime } from '$lib/components/admin/tone';
	import { DROP_STATE_DESCRIPTION } from '$lib/domain/drop-state';

	let { data, form } = $props();
	const toaster = getToaster();

	let drop = $derived(data.drop);
	let status = $derived(dropState(drop.state));
	let launchValue = $state('');
	let nextState = $state('');
	let copied = $state(false);
	$effect.pre(() => {
		launchValue = istInputValue(data.drop.launchInstant);
		nextState = '';
	});

	let launchMoved = $derived(launchValue !== istInputValue(drop.launchInstant));
	let launchPassed = $derived(drop.launchInstant <= data.now);
	let goingLive = $derived(['LIVE', 'RE_DROP', 'PARTIAL'].includes(nextState));
	let hasLive = $derived(drop.products.some((p) => p.status === 'active'));

	async function copyPreview() {
		if (!data.previewUrl) return;
		await navigator.clipboard.writeText(data.previewUrl);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}
</script>

<svelte:head><title>Drop {dropNumber(drop.number)} {drop.name} · Rootwear admin</title></svelte:head
>

<div class="flex flex-col gap-8">
	<PageHeader
		title="Drop {dropNumber(drop.number)} — {drop.name}"
		description="/drops/{drop.slug}"
		back={{ href: '/admin/drops', label: 'Drops' }}
	>
		{#snippet meta()}
			<Chip label={status.label} tone={status.tone} />
			{#if drop.published}<Chip label="Published" tone="success" />{:else}<Chip
					label="Hidden"
				/>{/if}
		{/snippet}
		{#snippet actions()}
			{#if drop.published}
				<a class="q-btn q-btn-secondary" href="/drops/{drop.slug}" target="_blank" rel="noopener"
					><ExternalLink /> View on site</a
				>
			{/if}
			{#if data.canEdit}
				<a class="q-btn q-btn-primary" href="/admin/drops/{drop.slug}/products/new"
					><Plus /> Add product</a
				>
			{/if}
		{/snippet}
	</PageHeader>

	{#if form?.error}<Notice kind="error">{form.error}</Notice>{/if}
	{#if data.created}
		<Notice kind="success"
			>Drop created. Add its first product, then preview it before publishing.</Notice
		>
	{/if}

	<div class="grid gap-10 xl:grid-cols-[minmax(0,1fr)_360px]">
		<div class="flex min-w-0 flex-col gap-10">
			<Section
				title="Products"
				description="Pieces in this drop, in the order the site shows them. Drafts stay off the site."
			>
				{#if drop.products.length === 0}
					<div class="q-card">
						<EmptyState
							icon={Image}
							title="No products yet"
							body="Add the first piece: its name, price, sizes and photos."
							compact
						>
							{#snippet action()}
								{#if data.canEdit}<a
										class="q-btn q-btn-primary"
										href="/admin/drops/{drop.slug}/products/new"><Plus /> Add product</a
									>{/if}
							{/snippet}
						</EmptyState>
					</div>
				{:else}
					<ul class="q-card q-divide">
						{#each drop.products as product, index (product.id)}
							{@const status = PRODUCT_STATUS[product.status]}
							<li class="flex items-center gap-4 p-3 pr-4">
								{#if product.image}
									<img
										src={product.image}
										alt=""
										class="size-14 flex-none rounded-[10px] bg-q-muted object-cover"
									/>
								{:else}
									<span
										class="flex size-14 flex-none items-center justify-center rounded-[10px] bg-q-muted text-q-tertiary"
										><Image size={20} strokeWidth={1.5} /></span
									>
								{/if}
								<div class="flex min-w-0 flex-1 flex-col gap-1">
									<div class="flex flex-wrap items-center gap-2">
										<a
											href="/admin/drops/{drop.slug}/products/{product.id}"
											class="truncate text-[14px] font-medium text-q-text hover:underline"
											>{product.name}</a
										>
										<Chip label={status.label} tone={status.tone} />
									</div>
									<p class="text-[13px] text-q-secondary">
										{[
											product.price,
											product.prelaunchPrice && `${product.prelaunchPrice} before launch`,
											product.sizes.join(', ') || 'No sizes',
											product.colours.length &&
												`${product.colours.length} colour${product.colours.length === 1 ? '' : 's'}`
										]
											.filter(Boolean)
											.join(' · ')}
									</p>
								</div>
								<div class="hidden text-right text-[13px] text-q-secondary tabular-nums sm:block">
									<p><span class="text-q-text">{product.totals.stock}</span> in stock</p>
									<p>{product.totals.sold} sold · {product.totals.reserved} reserved</p>
								</div>
								{#if data.canEdit && drop.products.length > 1}
									<form
										method="POST"
										action="?/moveProduct"
										class="flex flex-col"
										use:enhance={submitter(toaster)}
									>
										<input type="hidden" name="productId" value={product.id} />
										<button
											type="submit"
											name="direction"
											value="up"
											class="q-btn q-btn-ghost q-btn-sm q-btn-icon"
											aria-label="Move {product.name} up"
											disabled={index === 0}><ArrowUp /></button
										>
										<button
											type="submit"
											name="direction"
											value="down"
											class="q-btn q-btn-ghost q-btn-sm q-btn-icon"
											aria-label="Move {product.name} down"
											disabled={index === drop.products.length - 1}><ArrowDown /></button
										>
									</form>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}
			</Section>

			<Section title="Details">
				<form
					method="POST"
					action="?/details"
					class="flex max-w-[640px] flex-col gap-4"
					use:enhance={submitter(toaster)}
				>
					<fieldset disabled={!data.canEdit} class="flex flex-col gap-4">
						<div class="grid gap-4 sm:grid-cols-[1fr_160px]">
							<Field label="Name" id="d-name">
								{#snippet children({ describedBy })}
									<input
										id="d-name"
										name="name"
										class="q-input"
										value={drop.name}
										aria-describedby={describedBy}
									/>
								{/snippet}
							</Field>
							<Field label="Edition size" id="d-edition" help="Pieces in total.">
								{#snippet children({ describedBy })}
									<input
										id="d-edition"
										name="editionSize"
										type="number"
										min="1"
										class="q-input"
										value={drop.editionSize}
										aria-describedby={describedBy}
									/>
								{/snippet}
							</Field>
						</div>
						<Field label="Story" id="d-story">
							{#snippet children({ describedBy })}
								<textarea
									id="d-story"
									name="story"
									class="q-textarea min-h-[140px]"
									aria-describedby={describedBy}>{drop.story}</textarea
								>
							{/snippet}
						</Field>
					</fieldset>
					{#if data.canEdit}<div>
							<button type="submit" class="q-btn q-btn-secondary">Save details</button>
						</div>{/if}
				</form>
			</Section>
		</div>

		<aside class="flex flex-col gap-10">
			<Section title="On the site">
				<div class="q-card q-divide">
					<div class="flex items-start justify-between gap-3 p-4">
						<div class="flex flex-col gap-0.5">
							<p class="text-[14px] font-medium text-q-text">
								{drop.published ? 'Published' : 'Hidden'}
							</p>
							<p class="text-[13px] leading-[18px] text-q-secondary">
								{drop.published
									? 'In the archive and open to buy when its state allows.'
									: hasLive
										? 'Only you and people with the preview link can see it.'
										: 'Make a product live before publishing.'}
							</p>
						</div>
						{#if data.canEdit}
							<form method="POST" action="?/publish" use:enhance={submitter(toaster)}>
								<input type="hidden" name="published" value={drop.published ? 'false' : 'true'} />
								<button
									type="submit"
									class="q-btn q-btn-sm {drop.published ? 'q-btn-secondary' : 'q-btn-primary'}"
									disabled={!drop.published && !hasLive}
								>
									{drop.published ? 'Hide' : 'Publish'}
								</button>
							</form>
						{/if}
					</div>
					<div class="flex items-start justify-between gap-3 p-4">
						<div class="flex flex-col gap-0.5">
							<p class="text-[14px] font-medium text-q-text">
								Pre-order mode {drop.preorderMode ? 'on' : 'off'}
							</p>
							<p class="text-[13px] leading-[18px] text-q-secondary">
								{drop.preorderMode
									? 'The button reads Pre-order and takes signups, not payment.'
									: 'The button reads Buy now and sells through the cart.'}
							</p>
						</div>
						{#if data.canEdit}
							<form method="POST" action="?/preorderMode" use:enhance={submitter(toaster)}>
								<input
									type="hidden"
									name="preorderMode"
									value={drop.preorderMode ? 'false' : 'true'}
								/>
								<button type="submit" class="q-btn q-btn-secondary q-btn-sm"
									>Turn {drop.preorderMode ? 'off' : 'on'}</button
								>
							</form>
						{/if}
					</div>
					{#if !drop.published}
						<div class="flex flex-col gap-3 p-4">
							<div class="flex flex-col gap-0.5">
								<p class="text-[14px] font-medium text-q-text">Preview link</p>
								<p class="text-[13px] leading-[18px] text-q-secondary">
									Anyone with this link sees the drop as the public will, before it is published.
								</p>
							</div>
							{#if data.previewUrl}
								<div class="flex items-center gap-2">
									<code
										class="q-mono min-w-0 flex-1 truncate rounded-[8px] bg-q-muted px-2 py-1.5 text-[12px]"
										>{data.previewUrl}</code
									>
									<button type="button" class="q-btn q-btn-secondary q-btn-sm" onclick={copyPreview}
										>{#if copied}<Check /> Copied{:else}<Copy /> Copy{/if}</button
									>
								</div>
								<a
									class="q-link w-fit text-[13px]"
									href={data.previewUrl}
									target="_blank"
									rel="noopener">Open preview</a
								>
							{/if}
							{#if data.canEdit}
								<form method="POST" action="?/preview" use:enhance={submitter(toaster)}>
									<button type="submit" class="q-btn q-btn-secondary q-btn-sm"
										><Link /> {data.previewUrl ? 'Make a new link' : 'Make a preview link'}</button
									>
								</form>
							{/if}
						</div>
					{/if}
				</div>
			</Section>

			<Section title="State" description={DROP_STATE_DESCRIPTION[drop.state]}>
				{#if data.canEdit && drop.legalTransitions.length}
					<form
						method="POST"
						action="?/transition"
						class="flex flex-col gap-3"
						use:enhance={submitter(toaster)}
					>
						<div class="flex gap-2">
							<label for="d-state" class="sr-only">Move to</label>
							<select id="d-state" name="to" class="q-select" bind:value={nextState} required>
								<option value="" disabled>Move to…</option>
								{#each drop.legalTransitions as next (next)}
									<option value={next}>{DROP_STATE[next]?.label ?? next}</option>
								{/each}
							</select>
							<button type="submit" class="q-btn q-btn-secondary" disabled={!nextState}>Move</button
							>
						</div>
						{#if nextState}
							<p class="q-help">
								{DROP_STATE_DESCRIPTION[nextState as keyof typeof DROP_STATE_DESCRIPTION]}
							</p>
						{/if}
						{#if goingLive && data.othersLive.length}
							<Notice kind="warning"
								>{data.othersLive.join(' and ')} is already on sale. The homepage shows the newest published
								drop.</Notice
							>
						{/if}
					</form>
				{/if}
			</Section>

			<Section
				title="Launch"
				description="The countdown and the daily tease stages run from this one time."
			>
				<form
					method="POST"
					action="?/launchInstant"
					class="flex flex-col gap-3"
					use:enhance={submitter(toaster)}
				>
					<fieldset disabled={!data.canEdit} class="flex gap-2">
						<label for="d-launch" class="sr-only">Launch, IST</label>
						<input
							id="d-launch"
							name="launchInstant"
							type="datetime-local"
							class="q-input"
							bind:value={launchValue}
						/>
						{#if data.canEdit}<button
								type="submit"
								class="q-btn q-btn-secondary"
								disabled={!launchMoved}>Save</button
							>{/if}
					</fieldset>
					<p class="q-help">
						{shortDateTime(drop.launchInstant)} IST · {relativeDays(drop.launchInstant, data.now)}.
						Tease starts {shortDateTime(data.schedule.teaseStart)} ({data.schedule.stageCount} daily stages).
					</p>
					{#if launchMoved && launchPassed}
						<Notice kind="warning"
							>This drop has already launched. Moving the time changes the date customers see on it.</Notice
						>
					{/if}
				</form>
			</Section>

			<Section title="History">
				<Timeline events={data.history} empty="No changes recorded yet." />
			</Section>
		</aside>
	</div>
</div>
