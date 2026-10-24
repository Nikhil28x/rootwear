<script lang="ts">
	import { enhance } from '$app/forms';
	import Field from '$lib/components/admin/ui/Field.svelte';
	import Section from '$lib/components/admin/ui/Section.svelte';
	import Notice from '$lib/components/admin/Notice.svelte';
	import { submitter } from '$lib/components/admin/enhance';
	import { getToaster } from '$lib/components/admin/toast.svelte';

	let { data, form } = $props();
	const toaster = getToaster();

	let b = $derived(data.business);
	let errors = $derived((form && 'errors' in form ? form.errors : {}) as Record<string, string>);
	let gst = $state(false);
	$effect.pre(() => {
		gst = data.business.gstRegistered;
	});
</script>

<svelte:head><title>Business & GST · Settings · Rootwear admin</title></svelte:head>

<form method="POST" class="flex max-w-[640px] flex-col gap-10" use:enhance={submitter(toaster)}>
	{#if form && 'error' in form && form.error}<Notice kind="error">{form.error}</Notice>{/if}

	<Section title="The business" description="Printed on invoices, packing slips and labels.">
		<div class="flex flex-col gap-4">
			<div class="grid gap-4 sm:grid-cols-2">
				<Field label="Registered name" id="b-legal" error={errors.legalName}>
					{#snippet children({ describedBy, invalid })}<input
							id="b-legal"
							name="legalName"
							class="q-input"
							value={b.legalName}
							aria-describedby={describedBy}
							aria-invalid={invalid}
						/>{/snippet}
				</Field>
				<Field label="Brand name" id="b-trade">
					{#snippet children({ describedBy })}<input
							id="b-trade"
							name="tradeName"
							class="q-input"
							value={b.tradeName}
							aria-describedby={describedBy}
						/>{/snippet}
				</Field>
			</div>
			<Field label="Registered address" id="b-address" error={errors.address}>
				{#snippet children({ describedBy, invalid })}<textarea
						id="b-address"
						name="address"
						class="q-textarea min-h-[72px]"
						aria-describedby={describedBy}
						aria-invalid={invalid}>{b.address}</textarea
					>{/snippet}
			</Field>
			<div class="grid gap-4 sm:grid-cols-2">
				<Field
					label="State"
					id="b-state"
					error={errors.state}
					help="Decides CGST + SGST or IGST on each sale."
				>
					{#snippet children({ describedBy, invalid })}
						<select
							id="b-state"
							name="state"
							class="q-select"
							aria-describedby={describedBy}
							aria-invalid={invalid}
						>
							{#each data.states as s (s.code)}<option value={s.name} selected={s.name === b.state}
									>{s.name} ({s.code})</option
								>{/each}
						</select>
					{/snippet}
				</Field>
				<Field label="Entity type" id="b-entity">
					{#snippet children({ describedBy })}<input
							id="b-entity"
							name="entityType"
							class="q-input"
							value={b.entityType}
							aria-describedby={describedBy}
						/>{/snippet}
				</Field>
			</div>
			<div class="grid gap-4 sm:grid-cols-3">
				<Field label="Email" id="b-email">
					{#snippet children({ describedBy })}<input
							id="b-email"
							name="email"
							type="email"
							class="q-input"
							value={b.email}
							aria-describedby={describedBy}
						/>{/snippet}
				</Field>
				<Field label="Phone" id="b-phone" optional>
					{#snippet children({ describedBy })}<input
							id="b-phone"
							name="phone"
							class="q-input"
							value={b.phone}
							aria-describedby={describedBy}
						/>{/snippet}
				</Field>
				<Field label="Instagram" id="b-ig" optional>
					{#snippet children({ describedBy })}<input
							id="b-ig"
							name="instagram"
							class="q-input"
							value={b.instagram}
							aria-describedby={describedBy}
						/>{/snippet}
				</Field>
			</div>
		</div>
	</Section>

	<Section
		title="GST"
		description="Prices on the site always include tax. This only changes what invoices show."
	>
		<div class="flex flex-col gap-4">
			<label class="flex items-start gap-3 rounded-[10px] border border-q-border p-3">
				<input type="checkbox" class="q-check mt-0.5" name="gstRegistered" bind:checked={gst} />
				<span class="flex flex-col gap-0.5">
					<span class="text-[14px] font-medium text-q-text">Registered under GST</span>
					<span class="text-[13px] leading-[18px] text-q-secondary">
						On: new invoices are tax invoices with your GSTIN, HSN codes and the tax split. Off: a
						plain invoice that says no GST is charged. Invoices already issued never change.
					</span>
				</span>
			</label>
			<div class="grid gap-4 sm:grid-cols-2">
				<Field label="GSTIN" id="b-gstin" error={errors.gstin} optional={!gst}>
					{#snippet children({ describedBy, invalid })}<input
							id="b-gstin"
							name="gstin"
							class="q-input q-mono uppercase"
							maxlength="15"
							value={b.gstin}
							aria-describedby={describedBy}
							aria-invalid={invalid}
						/>{/snippet}
				</Field>
				<Field label="PAN" id="b-pan" error={errors.pan} optional>
					{#snippet children({ describedBy, invalid })}<input
							id="b-pan"
							name="pan"
							class="q-input q-mono uppercase"
							maxlength="10"
							value={b.pan}
							aria-describedby={describedBy}
							aria-invalid={invalid}
						/>{/snippet}
				</Field>
			</div>
		</div>
	</Section>

	<Section title="Invoices">
		<div class="flex flex-col gap-4">
			<div class="grid gap-4 sm:grid-cols-[160px_1fr]">
				<Field
					label="Number prefix"
					id="b-prefix"
					error={errors.invoicePrefix}
					help="RW → RW/26-27/0001"
				>
					{#snippet children({ describedBy, invalid })}<input
							id="b-prefix"
							name="invoicePrefix"
							class="q-input q-mono uppercase"
							value={b.invoicePrefix}
							aria-describedby={describedBy}
							aria-invalid={invalid}
						/>{/snippet}
				</Field>
				<Field
					label="Signed for by"
					id="b-sign"
					optional
					help="Name or title under the signature line."
				>
					{#snippet children({ describedBy })}<input
							id="b-sign"
							name="signatory"
							class="q-input"
							value={b.signatory}
							aria-describedby={describedBy}
						/>{/snippet}
				</Field>
			</div>
			<Field label="Footer line" id="b-footer" optional>
				{#snippet children({ describedBy })}<input
						id="b-footer"
						name="invoiceFooter"
						class="q-input"
						value={b.invoiceFooter}
						aria-describedby={describedBy}
					/>{/snippet}
			</Field>
		</div>
	</Section>

	<div><button type="submit" class="q-btn q-btn-primary">Save settings</button></div>
</form>
