<script lang="ts">
	import { enhance } from '$app/forms';
	import { Copy, Gift, Plus, Sparkles, UserPlus } from '@lucide/svelte';
	import Chip from '$lib/components/admin/ui/Chip.svelte';
	import Drawer from '$lib/components/admin/ui/Drawer.svelte';
	import EmptyState from '$lib/components/admin/ui/EmptyState.svelte';
	import Field from '$lib/components/admin/ui/Field.svelte';
	import PageHeader from '$lib/components/admin/ui/PageHeader.svelte';
	import StatTile from '$lib/components/admin/StatTile.svelte';
	import Notice from '$lib/components/admin/Notice.svelte';
	import { submitter } from '$lib/components/admin/enhance';
	import { getToaster } from '$lib/components/admin/toast.svelte';
	import { shortDate } from '$lib/components/admin/tone';
	import { formatInr, paise } from '$lib/money';

	let { data, form } = $props();
	const toaster = getToaster();
	let adding = $state(false);
	let gifting = $state<string | null>(null);
	let withCoupon = $state(true);

	const STATUS = {
		planned: { label: 'To send', tone: 'warning' },
		sent: { label: 'Sent, waiting for a post', tone: 'info' },
		posted: { label: 'Posted', tone: 'success' },
		no_post: { label: 'No post', tone: 'neutral' }
	} as const;

	let totals = $derived({
		sent: data.people.flatMap((p) => p.seedings).filter((s) => s.status !== 'planned').length,
		posted: data.people.flatMap((p) => p.seedings).filter((s) => s.status === 'posted').length,
		orders: data.people.reduce((n, p) => n + p.results.orders, 0),
		revenue: data.people.reduce((n, p) => n + Number(p.results.revenue), 0)
	});
	let giftingTo = $derived(data.people.find((p) => p.id === gifting) ?? null);

	async function copy(text: string) {
		await navigator.clipboard.writeText(text);
		toaster.success('Copied.');
	}
</script>

<svelte:head><title>Seeding · Rootwear admin</title></svelte:head>

<div class="flex flex-col gap-6">
	<PageHeader
		title="Seeding"
		description="Pieces gifted to creators, whether they posted, and what their code and link sold."
	>
		{#snippet actions()}
			<button type="button" class="q-btn q-btn-primary" onclick={() => (adding = true)}
				><UserPlus /> Add creator</button
			>
		{/snippet}
	</PageHeader>

	{#if form && 'error' in form && form.error}<Notice kind="error">{form.error}</Notice>{/if}

	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<StatTile label="Pieces sent" value={String(totals.sent)} />
		<StatTile
			label="Posted"
			value={String(totals.posted)}
			note={totals.sent ? `${Math.round((totals.posted / totals.sent) * 100)}% of those sent` : ''}
		/>
		<StatTile
			label="Orders from creators"
			value={String(totals.orders)}
			note="By their code or their link"
		/>
		<StatTile label="Revenue from creators" value={formatInr(paise(totals.revenue))} />
	</div>

	{#if data.people.length === 0}
		<div class="q-card">
			<EmptyState
				icon={Sparkles}
				title="No creators yet"
				body="Add someone you want to send a piece to. Each gets a code and a tracked link so their sales are counted."
			/>
		</div>
	{:else}
		<div class="flex flex-col gap-4">
			{#each data.people as person (person.id)}
				<section class="q-card flex flex-col" aria-labelledby="inf-{person.id}">
					<header
						class="flex flex-wrap items-center justify-between gap-3 border-b border-q-border p-4"
					>
						<div>
							<h2 id="inf-{person.id}" class="text-[16px] leading-[24px] font-semibold text-q-text">
								{person.name}
							</h2>
							<p class="text-[13px] text-q-secondary">
								<a
									class="q-link"
									href={person.platform === 'instagram'
										? `https://instagram.com/${person.handle}`
										: '#'}
									target="_blank"
									rel="noopener">@{person.handle}</a
								>
								{#if person.followers}
									· {person.followers.toLocaleString('en-IN')} followers{/if}
							</p>
						</div>
						<div class="flex items-center gap-4 text-right text-[13px] tabular-nums">
							<p>
								<span class="block text-[16px] font-semibold text-q-text"
									>{person.results.orders}</span
								>orders
							</p>
							<p>
								<span class="block text-[16px] font-semibold text-q-text"
									>{formatInr(person.results.revenue)}</span
								>revenue
							</p>
							<button
								type="button"
								class="q-btn q-btn-secondary q-btn-sm"
								onclick={() => (gifting = person.id)}><Gift /> Send a piece</button
							>
						</div>
					</header>
					{#if person.seedings.length === 0}
						<p class="p-4 text-[14px] text-q-secondary">Nothing sent yet.</p>
					{:else}
						<ul class="q-divide">
							{#each person.seedings as s (s.id)}
								{@const st = STATUS[s.status]}
								<li class="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
									<div class="flex min-w-0 flex-col gap-1">
										<p class="text-[14px] text-q-text">{s.quantity} × {s.piece}</p>
										<div class="flex flex-wrap items-center gap-2 text-[13px] text-q-secondary">
											<Chip label={st.label} tone={st.tone} />
											{#if s.sentAt}<span
													>Sent {shortDate(s.sentAt)}{s.tracking
														? ` · ${s.courier ?? ''} ${s.tracking}`
														: ''}</span
												>{/if}
											{#if s.postUrl}<a
													class="q-link"
													href={s.postUrl}
													target="_blank"
													rel="noopener">See the post</a
												>{/if}
										</div>
										<div class="flex flex-wrap items-center gap-2 text-[13px]">
											{#if s.couponCode}<button
													type="button"
													class="q-btn q-btn-ghost q-btn-sm q-mono"
													onclick={() => copy(s.couponCode!)}><Copy /> {s.couponCode}</button
												>{/if}
											{#if s.link}<button
													type="button"
													class="q-btn q-btn-ghost q-btn-sm"
													onclick={() => copy(s.link!)}><Copy /> Their link</button
												>{/if}
										</div>
									</div>
									{#if s.status === 'planned'}
										<form
											method="POST"
											action="?/sent"
											class="flex flex-wrap items-end gap-2"
											use:enhance={submitter(toaster)}
										>
											<input type="hidden" name="id" value={s.id} />
											<input
												name="courier"
												class="q-input q-input-sm w-32"
												placeholder="Courier"
												aria-label="Courier"
											/>
											<input
												name="tracking"
												class="q-input q-input-sm w-36"
												placeholder="Tracking"
												aria-label="Tracking"
											/>
											<button type="submit" class="q-btn q-btn-secondary q-btn-sm">Mark sent</button
											>
										</form>
									{:else if s.status === 'sent'}
										<form
											method="POST"
											action="?/posted"
											class="flex flex-wrap items-end gap-2"
											use:enhance={submitter(toaster)}
										>
											<input type="hidden" name="id" value={s.id} />
											<input
												name="url"
												type="url"
												class="q-input q-input-sm w-56"
												placeholder="Link to their post"
												aria-label="Post link"
											/>
											<button type="submit" class="q-btn q-btn-secondary q-btn-sm">Posted</button>
											<button
												type="submit"
												name="outcome"
												value="no_post"
												class="q-btn q-btn-ghost q-btn-sm">Didn’t post</button
											>
										</form>
									{/if}
								</li>
							{/each}
						</ul>
					{/if}
				</section>
			{/each}
		</div>
	{/if}
</div>

<Drawer bind:open={adding} title="Add a creator">
	<form
		id="inf-add"
		method="POST"
		action="?/add"
		class="flex flex-col gap-4"
		use:enhance={submitter(toaster, { onSuccess: () => (adding = false) })}
	>
		<div class="grid grid-cols-2 gap-4">
			<Field label="Name" id="ia-name"
				>{#snippet children({ describedBy })}<input
						id="ia-name"
						name="name"
						class="q-input"
						required
						aria-describedby={describedBy}
					/>{/snippet}</Field
			>
			<Field label="Handle" id="ia-handle"
				>{#snippet children({ describedBy })}<input
						id="ia-handle"
						name="handle"
						class="q-input"
						placeholder="@handle"
						required
						aria-describedby={describedBy}
					/>{/snippet}</Field
			>
		</div>
		<div class="grid grid-cols-2 gap-4">
			<Field label="Platform" id="ia-platform">
				{#snippet children({ describedBy })}<select
						id="ia-platform"
						name="platform"
						class="q-select"
						aria-describedby={describedBy}
						><option value="instagram">Instagram</option><option value="youtube">YouTube</option
						><option value="other">Other</option></select
					>{/snippet}
			</Field>
			<Field label="Followers" id="ia-followers" optional
				>{#snippet children({ describedBy })}<input
						id="ia-followers"
						name="followers"
						inputmode="numeric"
						class="q-input"
						aria-describedby={describedBy}
					/>{/snippet}</Field
			>
		</div>
		<div class="grid grid-cols-2 gap-4">
			<Field label="Phone" id="ia-phone" optional
				>{#snippet children({ describedBy })}<input
						id="ia-phone"
						name="phone"
						class="q-input"
						aria-describedby={describedBy}
					/>{/snippet}</Field
			>
			<Field label="Email" id="ia-email" optional
				>{#snippet children({ describedBy })}<input
						id="ia-email"
						name="email"
						type="email"
						class="q-input"
						aria-describedby={describedBy}
					/>{/snippet}</Field
			>
		</div>
		<Field label="Shipping address" id="ia-address" optional
			>{#snippet children({ describedBy })}<textarea
					id="ia-address"
					name="address"
					class="q-textarea min-h-[72px]"
					aria-describedby={describedBy}></textarea>{/snippet}</Field
		>
		<Field label="Notes" id="ia-notes" optional
			>{#snippet children({ describedBy })}<input
					id="ia-notes"
					name="notes"
					class="q-input"
					placeholder="Size, style, what they post"
					aria-describedby={describedBy}
				/>{/snippet}</Field
		>
	</form>
	{#snippet footer()}
		<button type="button" class="q-btn q-btn-secondary" onclick={() => (adding = false)}
			>Cancel</button
		>
		<button type="submit" form="inf-add" class="q-btn q-btn-primary"><Plus /> Add creator</button>
	{/snippet}
</Drawer>

<Drawer
	open={gifting !== null}
	onclose={() => (gifting = null)}
	title="Send a piece to {giftingTo?.name ?? ''}"
	description="It leaves stock when you mark it sent."
>
	<form
		id="inf-plan"
		method="POST"
		action="?/plan"
		class="flex flex-col gap-4"
		use:enhance={submitter(toaster, { onSuccess: () => (gifting = null) })}
	>
		<input type="hidden" name="influencerId" value={gifting ?? ''} />
		<Field label="Piece" id="ip-variant">
			{#snippet children({ describedBy })}
				<select
					id="ip-variant"
					name="variantId"
					class="q-select"
					required
					aria-describedby={describedBy}
				>
					<option value="">Pick a size…</option>
					{#each data.pieces as p (p.id)}<option value={p.id} disabled={p.available === 0}
							>{p.label} ({p.available} free)</option
						>{/each}
				</select>
			{/snippet}
		</Field>
		<Field label="How many" id="ip-qty"
			>{#snippet children({ describedBy })}<input
					id="ip-qty"
					name="quantity"
					type="number"
					min="1"
					value="1"
					class="q-input w-24"
					aria-describedby={describedBy}
				/>{/snippet}</Field
		>
		<label class="flex items-start gap-3 rounded-[10px] border border-q-border p-3">
			<input type="checkbox" class="q-check mt-0.5" name="coupon" bind:checked={withCoupon} />
			<span class="flex flex-col gap-0.5">
				<span class="text-[14px] font-medium text-q-text"
					>Give them a discount code for their followers</span
				>
				<span class="text-[13px] text-q-secondary"
					>Made from their handle, e.g. {(giftingTo?.handle ?? 'handle')
						.replace(/[^a-z0-9]/g, '')
						.toUpperCase()}10. Every use is counted here.</span
				>
			</span>
		</label>
		{#if withCoupon}
			<Field label="Percent off" id="ip-pct"
				>{#snippet children({ describedBy })}<input
						id="ip-pct"
						name="percent"
						type="number"
						min="1"
						max="50"
						value="10"
						class="q-input w-24"
						aria-describedby={describedBy}
					/>{/snippet}</Field
			>
		{/if}
		<Field label="Note" id="ip-note" optional
			>{#snippet children({ describedBy })}<input
					id="ip-note"
					name="note"
					class="q-input"
					placeholder="For the Diwali reel"
					aria-describedby={describedBy}
				/>{/snippet}</Field
		>
	</form>
	{#snippet footer()}
		<button type="button" class="q-btn q-btn-secondary" onclick={() => (gifting = null)}
			>Cancel</button
		>
		<button type="submit" form="inf-plan" class="q-btn q-btn-primary"><Gift /> Plan gift</button>
	{/snippet}
</Drawer>
