<script lang="ts">
	import { enhance } from '$app/forms';
	import { Pause, Play, Plus, Ticket } from '@lucide/svelte';
	import Chip from '$lib/components/admin/ui/Chip.svelte';
	import Drawer from '$lib/components/admin/ui/Drawer.svelte';
	import EmptyState from '$lib/components/admin/ui/EmptyState.svelte';
	import Field from '$lib/components/admin/ui/Field.svelte';
	import PageHeader from '$lib/components/admin/ui/PageHeader.svelte';
	import Notice from '$lib/components/admin/Notice.svelte';
	import { submitter } from '$lib/components/admin/enhance';
	import { getToaster } from '$lib/components/admin/toast.svelte';
	import { istInputValue, shortDate } from '$lib/components/admin/tone';
	import { formatInr, paise } from '$lib/money';

	let { data, form } = $props();
	const toaster = getToaster();

	type C = (typeof data.coupons)[number];
	let editing = $state<C | null>(null);
	let creating = $state(false);
	let kind = $state<'percent' | 'fixed'>('percent');
	let open = $derived(creating || editing !== null);
	$effect.pre(() => {
		kind = editing?.kind ?? 'percent';
	});

	const STATUS = {
		active: { label: 'Active', tone: 'success' },
		scheduled: { label: 'Scheduled', tone: 'info' },
		expired: { label: 'Expired', tone: 'neutral' },
		used_up: { label: 'Used up', tone: 'neutral' },
		paused: { label: 'Paused', tone: 'warning' }
	} as const;

	const rupees = (p: number) => String(p / 100);
	const offer = (c: C) =>
		`${c.kind === 'percent' ? `${c.value}% off` : `${formatInr(paise(c.value))} off`}${Number(c.minSubtotal) ? ` over ${formatInr(c.minSubtotal)}` : ''}${c.maxDiscount ? `, up to ${formatInr(c.maxDiscount)}` : ''}`;
	function close() {
		creating = false;
		editing = null;
	}
</script>

<svelte:head><title>Coupons · Rootwear admin</title></svelte:head>

<div class="flex flex-col gap-6">
	<PageHeader title="Coupons" description="Discount codes, how often they were used and what they sold. Checked again by the database at every order.">
		{#snippet actions()}
			{#if data.coupons.length}<button type="button" class="q-btn q-btn-primary" onclick={() => (creating = true)}><Plus /> New coupon</button>{/if}
		{/snippet}
	</PageHeader>

	{#if form && 'error' in form && form.error && !open}<Notice kind="error">{form.error}</Notice>{/if}

	{#if data.coupons.length === 0}
		<div class="q-card">
			<EmptyState icon={Ticket} title="No coupons yet" body="Make a code for a launch, a creator or a friend. Limit it by date and number of uses.">
				{#snippet action()}<button type="button" class="q-btn q-btn-primary" onclick={() => (creating = true)}><Plus /> New coupon</button>{/snippet}
			</EmptyState>
		</div>
	{:else}
		<div class="q-table-wrap">
			<table class="q-table">
				<thead><tr><th scope="col">Code</th><th scope="col">Offer</th><th scope="col">Status</th><th scope="col">Valid</th><th scope="col" class="num">Used</th><th scope="col" class="num">Discount given</th><th scope="col" class="num">Orders worth</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
				<tbody>
					{#each data.coupons as c (c.id)}
						{@const st = STATUS[c.status]}
						<tr>
							<td>
								<button type="button" class="row-link q-mono" onclick={() => (editing = c)}>{c.code}</button>
								{#if c.description}<p class="text-[12px] text-q-tertiary">{c.description}</p>{/if}
							</td>
							<td>{offer(c)}</td>
							<td><Chip label={st.label} tone={st.tone} /></td>
							<td class="text-[13px] text-q-secondary">{shortDate(c.validFrom)} – {c.validUntil ? shortDate(c.validUntil) : 'no end'}</td>
							<td class="num">{c.used}{c.maxUses ? ` / ${c.maxUses}` : ''}</td>
							<td class="num">{formatInr(c.discountGiven)}</td>
							<td class="num font-medium text-q-text">{formatInr(c.revenue)}</td>
							<td>
								<form method="POST" action="?/toggle" use:enhance={submitter(toaster)}>
									<input type="hidden" name="id" value={c.id} />
									<input type="hidden" name="active" value={c.active ? 'false' : 'true'} />
									<button type="submit" class="q-btn q-btn-ghost q-btn-sm q-btn-icon" aria-label="{c.active ? 'Pause' : 'Resume'} {c.code}">{#if c.active}<Pause />{:else}<Play />{/if}</button>
								</form>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<Drawer {open} onclose={close} title={editing ? `Edit ${editing.code}` : 'New coupon'}>
	{#key editing?.id ?? 'new'}
		<form id="coupon-form" method="POST" action={editing ? '?/update' : '?/create'} class="flex flex-col gap-4" use:enhance={submitter(toaster, { onSuccess: close })}>
			{#if editing}<input type="hidden" name="id" value={editing.id} />{/if}
			{#if form && 'error' in form && form.error}<Notice kind="error">{form.error}</Notice>{/if}
			<Field label="Code" id="cp-code" help={editing?.used ? 'Used already, so the code cannot change.' : 'What customers type at checkout.'}>
				{#snippet children({ describedBy })}<input id="cp-code" name="code" class="q-input q-mono uppercase" value={editing?.code ?? data.suggestion} readonly={Boolean(editing?.used)} required aria-describedby={describedBy} />{/snippet}
			</Field>
			<div class="grid grid-cols-2 gap-4">
				<Field label="Type" id="cp-kind">
					{#snippet children({ describedBy })}
						<select id="cp-kind" name="kind" class="q-select" bind:value={kind} aria-describedby={describedBy}>
							<option value="percent">Percentage off</option>
							<option value="fixed">Rupees off</option>
						</select>
					{/snippet}
				</Field>
				<Field label={kind === 'percent' ? 'Percent' : 'Amount (₹)'} id="cp-value">
					{#snippet children({ describedBy })}<input id="cp-value" name="value" inputmode="decimal" class="q-input" value={editing ? (editing.kind === 'fixed' ? rupees(editing.value) : editing.value) : '10'} required aria-describedby={describedBy} />{/snippet}
				</Field>
			</div>
			<div class="grid grid-cols-2 gap-4">
				<Field label="Minimum order (₹)" id="cp-min" optional>
					{#snippet children({ describedBy })}<input id="cp-min" name="minSubtotal" inputmode="decimal" class="q-input" value={editing && Number(editing.minSubtotal) ? rupees(Number(editing.minSubtotal)) : ''} aria-describedby={describedBy} />{/snippet}
				</Field>
				{#if kind === 'percent'}
					<Field label="Most off (₹)" id="cp-max" optional>
						{#snippet children({ describedBy })}<input id="cp-max" name="maxDiscount" inputmode="decimal" class="q-input" value={editing?.maxDiscount ? rupees(Number(editing.maxDiscount)) : ''} aria-describedby={describedBy} />{/snippet}
					</Field>
				{/if}
			</div>
			<div class="grid grid-cols-2 gap-4">
				<Field label="Starts (IST)" id="cp-from" optional>
					{#snippet children({ describedBy })}<input id="cp-from" name="validFrom" type="datetime-local" class="q-input" value={editing ? istInputValue(editing.validFrom) : ''} aria-describedby={describedBy} />{/snippet}
				</Field>
				<Field label="Ends (IST)" id="cp-until" optional>
					{#snippet children({ describedBy })}<input id="cp-until" name="validUntil" type="datetime-local" class="q-input" value={editing?.validUntil ? istInputValue(editing.validUntil) : ''} aria-describedby={describedBy} />{/snippet}
				</Field>
			</div>
			<Field label="Total uses" id="cp-uses" optional help="Leave empty for unlimited.">
				{#snippet children({ describedBy })}<input id="cp-uses" name="maxUses" type="number" min="1" class="q-input w-32" value={editing?.maxUses ?? ''} aria-describedby={describedBy} />{/snippet}
			</Field>
			<Field label="What it’s for" id="cp-desc" optional>
				{#snippet children({ describedBy })}<input id="cp-desc" name="description" class="q-input" value={editing?.description ?? ''} placeholder="Aisha’s followers, Drop 02" aria-describedby={describedBy} />{/snippet}
			</Field>
		</form>
	{/key}
	{#snippet footer()}
		<button type="button" class="q-btn q-btn-secondary" onclick={close}>Cancel</button>
		<button type="submit" form="coupon-form" class="q-btn q-btn-primary">{editing ? 'Save coupon' : 'Create coupon'}</button>
	{/snippet}
</Drawer>
