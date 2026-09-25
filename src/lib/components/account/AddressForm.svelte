<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import Button from '$lib/components/ui/Button.svelte';
	import Field from '$lib/components/ui/Field.svelte';
	import ErrorSummary from './ErrorSummary.svelte';
	import { INDIAN_STATES } from './address-shape';
	import type { AddressFieldErrors, RawAddress } from './address-shape';

	/**
	 * The one address form, used for both adding and editing.
	 *
	 * ONE INSTANCE AT A TIME, by design. ui/Field.svelte derives its input id
	 * from the field name (`f-pincode`), so rendering an edit form beside every
	 * saved address would put the same id on the page five times and break
	 * every label. The page therefore opens a single form through ?new / ?edit,
	 * which also means the whole screen works with JavaScript off.
	 *
	 * §10 is enforced on the server, not here: this form's `required` marks and
	 * `inputmode` hints are a convenience, and validateAddress() is what
	 * actually decides. The country is a hidden field rather than an
	 * unsubmitted constant so a tampered post is REFUSED visibly rather than
	 * silently coerced.
	 */
	let {
		action,
		values,
		errors = {},
		submitLabel,
		cancelHref,
		title,
		note = '',
		recordId = ''
	}: {
		action: string;
		values: RawAddress;
		errors?: AddressFieldErrors;
		submitLabel: string;
		cancelHref: string;
		title: string;
		note?: string;
		/** Set when editing. Travels in the BODY so the row being changed cannot
		 *  be swapped by editing the address bar. */
		recordId?: string;
	} = $props();

	// Seeded from what the server echoed back, so a failed submit never loses
	// the typing. With JavaScript off the page is re-rendered and these
	// initialisers put the words back in the boxes; with it on, the component
	// survives the round trip and the inputs never lost them.
	// `untrack` states the capture explicitly: these are the STARTING values of
	// the boxes, not a live mirror of the prop. Re-seeding them from the prop
	// mid-edit would overwrite what the customer is typing. The page keys this
	// component on which address is open, so switching rows remounts it with
	// the right starting values.
	const start = untrack(() => values);

	let label = $state(start.label);
	let name = $state(start.name);
	let line1 = $state(start.line1);
	let line2 = $state(start.line2);
	let city = $state(start.city);
	let stateName = $state(start.state);
	let pincode = $state(start.pincode);
	let phone = $state(start.phone);
	let submitting = $state(false);

	const stateOptions = INDIAN_STATES.map((value) => ({ value, label: value }));
</script>

<section
	aria-labelledby="address-form-title"
	class="border border-forest/20 px-6 py-8 sm:px-9 sm:py-10"
>
	<h2
		id="address-form-title"
		class="display text-[clamp(1.7rem,3vw,2.4rem)] leading-[1.05] text-forest"
	>
		{title}
	</h2>
	{#if note}
		<p class="mt-4 max-w-[52ch] text-[15px] leading-[1.8] text-forest/70">{note}</p>
	{/if}

	<div class="mt-8">
		<ErrorSummary {errors} />
	</div>

	<form
		method="POST"
		{action}
		class="mt-8 flex flex-col gap-7"
		use:enhance={() => {
			submitting = true;
			return async ({ update }) => {
				await update();
				submitting = false;
			};
		}}
	>
		<!-- §10: refused if tampered with, never quietly rewritten. -->
		<input type="hidden" name="country" value="IN" />
		{#if recordId}
			<input type="hidden" name="id" value={recordId} />
		{/if}

		<div class="grid gap-7 sm:grid-cols-2">
			<Field
				label="Label"
				name="label"
				bind:value={label}
				error={errors.label ?? ''}
				hint="Home, studio, parents."
				placeholder="Home"
			/>
			<Field
				label="Full name"
				name="name"
				required
				bind:value={name}
				error={errors.name ?? ''}
				autocomplete="name"
				hint="Who the courier should ask for."
			/>
		</div>

		<Field
			label="Flat, house number and street"
			name="line1"
			required
			bind:value={line1}
			error={errors.line1 ?? ''}
			autocomplete="address-line1"
		/>

		<Field
			label="Area, landmark (optional)"
			name="line2"
			bind:value={line2}
			error={errors.line2 ?? ''}
			autocomplete="address-line2"
		/>

		<div class="grid gap-7 sm:grid-cols-2">
			<Field
				label="City or town"
				name="city"
				required
				bind:value={city}
				error={errors.city ?? ''}
				autocomplete="address-level2"
			/>
			<Field
				label="State or union territory"
				name="state"
				required
				bind:value={stateName}
				error={errors.state ?? ''}
				options={stateOptions}
			/>
		</div>

		<div class="grid gap-7 sm:grid-cols-2">
			<Field
				label="Pincode"
				name="pincode"
				required
				bind:value={pincode}
				error={errors.pincode ?? ''}
				inputmode="numeric"
				autocomplete="postal-code"
				hint="Six digits."
			/>
			<Field
				label="Mobile number"
				name="phone"
				required
				bind:value={phone}
				error={errors.phone ?? ''}
				inputmode="tel"
				autocomplete="tel-national"
				hint="Ten digits. Used only for the delivery."
			/>
		</div>

		{#if errors.country}
			<p class="text-[13px] text-alert" role="alert">{errors.country}</p>
		{/if}

		<label class="flex cursor-pointer items-start gap-3 text-[15px] leading-relaxed text-forest/75">
			<input
				type="checkbox"
				name="isDefault"
				checked={start.isDefault}
				class="mt-1 h-4 w-4 shrink-0 appearance-none border border-forest/65 bg-transparent checked:border-forest checked:bg-forest focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-forest"
			/>
			<span>Use this as my default delivery address.</span>
		</label>

		<div class="flex flex-wrap items-center gap-6 pt-2">
			<Button type="submit" variant="solid" surface="light" disabled={submitting}>
				{submitting ? 'Saving…' : submitLabel}
			</Button>
			<a
				href={cancelHref}
				class="text-[11px] tracking-[0.2em] text-forest/75 uppercase underline-offset-4 hover:text-forest hover:underline font-medium"
			>
				Cancel
			</a>
		</div>
	</form>
</section>
