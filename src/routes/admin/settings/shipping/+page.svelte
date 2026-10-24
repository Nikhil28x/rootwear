<script lang="ts">
	import { enhance } from '$app/forms';
	import { Plus, Trash2 } from '@lucide/svelte';
	import Section from '$lib/components/admin/ui/Section.svelte';
	import Field from '$lib/components/admin/ui/Field.svelte';
	import Notice from '$lib/components/admin/Notice.svelte';
	import { submitter } from '$lib/components/admin/enhance';
	import { getToaster } from '$lib/components/admin/toast.svelte';
	import { formatInr } from '$lib/money';

	let { data, form } = $props();
	const toaster = getToaster();
	const r = (p: number) => (p ? String(p / 100) : '');
</script>

<svelte:head><title>Shipping · Settings · Rootwear admin</title></svelte:head>

<div class="flex max-w-[880px] flex-col gap-10">
	{#if form && 'error' in form && form.error}<Notice kind="error">{form.error}</Notice>{/if}

	<Section title="Rates" description="Charged by order value. The first active rate whose range fits the order applies. No rates means free shipping everywhere.">
		<div class="q-card q-divide">
			{#each data.rates as rate (rate.id)}
				<form method="POST" action="?/rate" class="flex flex-wrap items-end gap-2 p-3" use:enhance={submitter(toaster)}>
					<input type="hidden" name="id" value={rate.id} />
					<label class="flex flex-col gap-1.5"><span class="q-label">Name</span><input name="name" class="q-input q-input-sm w-36" value={rate.name} /></label>
					<label class="flex flex-col gap-1.5"><span class="q-label">From ₹</span><input name="min" inputmode="decimal" class="q-input q-input-sm w-24" value={r(Number(rate.min))} placeholder="0" /></label>
					<label class="flex flex-col gap-1.5"><span class="q-label">Up to ₹</span><input name="max" inputmode="decimal" class="q-input q-input-sm w-24" value={rate.max === null ? '' : r(Number(rate.max))} placeholder="and above" /></label>
					<label class="flex flex-col gap-1.5"><span class="q-label">Charge ₹</span><input name="rate" inputmode="decimal" class="q-input q-input-sm w-24" value={r(Number(rate.rate))} placeholder="0 = free" /></label>
					<label class="flex h-7 items-center gap-2 text-[13px]"><input type="checkbox" class="q-check" name="active" checked={rate.active} /> Active</label>
					<button type="submit" class="q-btn q-btn-secondary q-btn-sm">Save</button>
					<button type="submit" formaction="?/deleteRate" class="q-btn q-btn-ghost q-btn-sm q-btn-icon" aria-label="Remove {rate.name}"><Trash2 /></button>
					<span class="ml-auto self-center text-[13px] text-q-secondary">{Number(rate.rate) ? formatInr(rate.rate) : 'Free'}</span>
				</form>
			{/each}
			<form method="POST" action="?/rate" class="flex flex-wrap items-end gap-2 bg-q-muted/50 p-3" use:enhance={submitter(toaster, { reset: true })}>
				<label class="flex flex-col gap-1.5"><span class="q-label">Name</span><input name="name" class="q-input q-input-sm w-36" placeholder="Standard" required /></label>
				<label class="flex flex-col gap-1.5"><span class="q-label">From ₹</span><input name="min" inputmode="decimal" class="q-input q-input-sm w-24" placeholder="0" /></label>
				<label class="flex flex-col gap-1.5"><span class="q-label">Up to ₹</span><input name="max" inputmode="decimal" class="q-input q-input-sm w-24" placeholder="and above" /></label>
				<label class="flex flex-col gap-1.5"><span class="q-label">Charge ₹</span><input name="rate" inputmode="decimal" class="q-input q-input-sm w-24" placeholder="0 = free" /></label>
				<input type="hidden" name="active" value="on" />
				<button type="submit" class="q-btn q-btn-secondary q-btn-sm"><Plus /> Add rate</button>
			</form>
		</div>
	</Section>

	<Section title="Pincodes you do not deliver to" description="Checkout refuses these, with your reason.">
		<form method="POST" action="?/block" class="flex flex-wrap items-end gap-2" use:enhance={submitter(toaster, { reset: true })}>
			<Field label="Pincodes" id="px-codes" help="One or several, separated by commas.">
				{#snippet children({ describedBy })}<input id="px-codes" name="pincode" class="q-input q-mono w-56" required aria-describedby={describedBy} />{/snippet}
			</Field>
			<Field label="Reason" id="px-reason" class="min-w-[220px] flex-1">
				{#snippet children({ describedBy })}<input id="px-reason" name="reason" class="q-input" placeholder="Our courier does not reach this area" required aria-describedby={describedBy} />{/snippet}
			</Field>
			<button type="submit" class="q-btn q-btn-secondary mb-[26px]">Block</button>
		</form>
		{#if data.exclusions.length}
			<ul class="flex flex-wrap gap-2">
				{#each data.exclusions as ex (ex.pincode)}
					<li>
						<form method="POST" action="?/unblock" class="flex items-center gap-1 rounded-full bg-q-muted py-1 pr-1 pl-3 text-[13px]" use:enhance={submitter(toaster)} title={ex.reason}>
							<input type="hidden" name="pincode" value={ex.pincode} />
							<span class="q-mono">{ex.pincode}</span>
							<button type="submit" class="flex size-6 items-center justify-center rounded-full hover:bg-q-pressed" aria-label="Unblock {ex.pincode}">×</button>
						</form>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="text-[14px] text-q-secondary">Every pincode in India is open.</p>
		{/if}
	</Section>
</div>

