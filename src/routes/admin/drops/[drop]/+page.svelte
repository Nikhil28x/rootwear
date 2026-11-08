<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		ArrowDown,
		ArrowUp,
		Check,
		ChevronRight,
		Copy,
		ExternalLink,
		Image,
		Link,
		Plus
	} from '@lucide/svelte';
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
	import { goLiveChecks, storefrontStatus } from '$lib/components/admin/storefront';
	import { CircleAlert, CircleCheck, Eye, EyeOff, Rocket } from '@lucide/svelte';

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
	let liveCount = $derived(drop.products.filter((p) => p.status === 'active').length);
	let hasLive = $derived(liveCount > 0);
	let input = $derived({
		state: drop.state,
		published: drop.published,
		preorderMode: drop.preorderMode,
		liveProducts: liveCount,
		stock: drop.totals.stock
	});
	let shop = $derived(storefrontStatus(input));
	let checks = $derived(goLiveChecks(input));
	let ready = $derived(checks.every((c) => c.ok));
	let doneCount = $derived(checks.filter((c) => c.ok).length);
	let sold = $derived(drop.totals.sold);
	let claimed = $derived(
		drop.editionSize > 0
			? Math.min(100, Math.round(((sold + drop.totals.reserved) / drop.editionSize) * 100))
			: 0
	);

	/** Hiding a drop that is on sale takes it away from buyers mid-sale. */
	function confirmHide(e: MouseEvent) {
		if (drop.published && shop.open && !confirm('Hide this drop? Visitors will lose access to it.')) {
			e.preventDefault();
		}
	}

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
			<Chip label={shop.label} tone={shop.tone} />
			<Chip label={status.label} tone={status.tone} dot={false} title="Drop state" />
		{/snippet}
		{#snippet actions()}
			{#if drop.published}
				<a class="q-btn q-btn-secondary" href="/drops/{drop.slug}" target="_blank" rel="noopener"
					><ExternalLink /> View on site</a
				>
			{:else if data.previewUrl}
				<a class="q-btn q-btn-secondary" href={data.previewUrl} target="_blank" rel="noopener"
					><Eye /> Preview</a
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

	<!-- ───────── Storefront: what visitors see, and what is left to do ───────── -->
	<section class="q-card overflow-hidden" aria-labelledby="shop-h">
		<div class="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
			<div class="flex flex-col gap-4 p-5 lg:border-r lg:border-q-border">
				<div class="flex items-start gap-3">
					<span
						class="flex size-10 flex-none items-center justify-center rounded-full {shop.visible
							? 'bg-q-muted text-q-text'
							: 'bg-q-muted text-q-tertiary'}"
					>
						{#if shop.visible}<Eye size={18} strokeWidth={1.5} />{:else}<EyeOff
								size={18}
								strokeWidth={1.5}
							/>{/if}
					</span>
					<div class="flex min-w-0 flex-col gap-1">
						<h2 id="shop-h" class="text-[16px] leading-[24px] font-semibold text-q-text">
							{shop.label}
						</h2>
						<p class="text-[14px] leading-[20px] text-q-secondary">{shop.headline}</p>
						{#if shop.hint}
							<p class="text-[13px] leading-[18px] font-medium text-q-text">{shop.hint}</p>
						{/if}
					</div>
				</div>

				<dl class="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
					{#each [{ k: 'Live pieces', v: `${liveCount} / ${drop.products.length}` }, { k: 'In stock', v: drop.totals.stock }, { k: 'Reserved', v: drop.totals.reserved }, { k: 'Sold', v: drop.totals.sold }] as stat (stat.k)}
						<div>
							<dt class="text-[12px] text-q-tertiary">{stat.k}</dt>
							<dd class="text-[18px] font-semibold text-q-text tabular-nums">{stat.v}</dd>
						</div>
					{/each}
				</dl>

				<div class="flex flex-col gap-1.5">
					<div class="flex items-center justify-between text-[12px] text-q-secondary">
						<span>Edition of {drop.editionSize}</span>
						<span class="tabular-nums">{sold + drop.totals.reserved} claimed · {claimed}%</span>
					</div>
					<div
						class="h-1.5 overflow-hidden rounded-full bg-q-muted"
						role="progressbar"
						aria-label="Edition claimed"
						aria-valuemin="0"
						aria-valuemax="100"
						aria-valuenow={claimed}
					>
						<div class="h-full rounded-full bg-q-text" style:width="{claimed}%"></div>
					</div>
				</div>
			</div>

			<div class="flex flex-col gap-3 border-t border-q-border p-5 lg:border-t-0">
				<div class="flex items-center justify-between gap-3">
					<h3 class="text-[14px] font-semibold text-q-text">
						{ready ? 'Ready — everything is in place' : 'Before visitors can order'}
					</h3>
					<span class="text-[12px] text-q-tertiary tabular-nums">{doneCount} of {checks.length}</span>
				</div>
				<ul class="flex flex-col gap-2.5">
					{#each checks as check (check.key)}
						<li class="flex items-start gap-2.5">
							{#if check.ok}
								<CircleCheck size={18} strokeWidth={1.75} class="mt-0.5 flex-none text-q-success" />
							{:else}
								<CircleAlert size={18} strokeWidth={1.75} class="mt-0.5 flex-none text-q-warning" />
							{/if}
							<div class="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-3 gap-y-1">
								<div class="flex min-w-0 flex-col">
									<p class="text-[14px] leading-[20px] {check.ok ? 'text-q-secondary' : 'font-medium text-q-text'}">
										{check.label}
									</p>
									{#if !check.ok}<p class="text-[13px] leading-[18px] text-q-secondary">{check.fix}</p>{/if}
								</div>
								{#if !check.ok && data.canEdit}
									{#if check.action === 'publish' && hasLive}
										<form method="POST" action="?/publish" use:enhance={submitter(toaster)}>
											<input type="hidden" name="published" value="true" />
											<button type="submit" class="q-btn q-btn-primary q-btn-sm"
												><Rocket /> Publish now</button
											>
										</form>
									{:else if check.action === 'state' && drop.legalTransitions.includes('LIVE')}
										<form method="POST" action="?/transition" use:enhance={submitter(toaster)}>
											<input type="hidden" name="to" value="LIVE" />
											<button type="submit" class="q-btn q-btn-secondary q-btn-sm">Move to Live</button>
										</form>
									{:else if check.action === 'products'}
										<a
											class="q-btn q-btn-secondary q-btn-sm"
											href="/admin/drops/{drop.slug}/products/{drop.products[0]?.id ?? 'new'}"
											>{drop.products.length ? 'Open product' : 'Add product'}</a
										>
									{/if}
								{/if}
							</div>
						</li>
					{/each}
				</ul>
			</div>
		</div>
	</section>

	<div class="grid grid-cols-1 gap-10 xl:grid-cols-[minmax(0,1fr)_360px]">
		<div class="flex min-w-0 flex-col gap-10">
			<Section
				title="Products"
				description="Open a product to change its price, sizes, stock or photos. The site shows them in this order; drafts stay off it."
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
					<ul class="q-card q-divide overflow-hidden">
						{#each drop.products as product, index (product.id)}
							{@const status = PRODUCT_STATUS[product.status]}
							<li class="q-list-row flex items-center gap-4 p-3 pr-4">
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
											class="q-row-link truncate text-[14px]">{product.name}</a
										>
										<Chip label={status.label} tone={status.tone} />
										{#if !product.priceVisible}<Chip label="Price hidden" />{/if}
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
								<span
									class="flex flex-none items-center gap-1 text-[13px] font-medium text-q-secondary"
									aria-hidden="true"
								>
									{data.canEdit ? 'Edit' : 'View'}
									<ChevronRight size={16} strokeWidth={1.5} class="text-q-tertiary" />
								</span>
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
			<Section title="Visibility and sale">
				<div class="q-card q-divide">
					<div class="flex items-start justify-between gap-3 p-4">
						<div class="flex flex-col gap-0.5">
							<p class="text-[14px] font-medium text-q-text">
								{drop.published ? 'Shown in the shop' : 'Hidden from the shop'}
							</p>
							<p class="text-[13px] leading-[18px] text-q-secondary">
								{drop.published
									? 'In the shop and the archive.'
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
									onclick={confirmHide}
								>
									{#if drop.published}<EyeOff /> Hide{:else}<Rocket /> Publish{/if}
								</button>
							</form>
						{/if}
					</div>
					<div class="flex flex-col gap-3 p-4">
						<div class="flex flex-col gap-0.5">
							<p class="text-[14px] font-medium text-q-text">When the sale is open, visitors can</p>
							<p class="text-[13px] leading-[18px] text-q-secondary">
								This sets the button on every product page in this drop.
							</p>
						</div>
						<form
							method="POST"
							action="?/preorderMode"
							class="grid grid-cols-2 gap-1 rounded-[10px] bg-q-muted p-1"
							role="group"
							aria-label="Sale mode"
							use:enhance={submitter(toaster)}
						>
							{#each [{ on: true, label: 'Pre-order', note: 'Signup, no payment' }, { on: false, label: 'Buy now', note: 'Cart and checkout' }] as mode (mode.label)}
								{@const active = drop.preorderMode === mode.on}
								<button
									type="submit"
									name="preorderMode"
									value={mode.on ? 'true' : 'false'}
									aria-pressed={active}
									disabled={!data.canEdit || active}
									class="flex flex-col items-start gap-0.5 rounded-[8px] px-3 py-2 text-left transition-colors disabled:opacity-100 {active
										? 'bg-q-surface shadow-sm'
										: 'hover:bg-q-surface/60'}"
								>
									<span class="flex items-center gap-1.5 text-[14px] font-medium text-q-text"
										>{mode.label}{#if active}<Check size={14} />{/if}</span
									>
									<span class="text-[12px] text-q-secondary">{mode.note}</span>
								</button>
							{/each}
						</form>
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
