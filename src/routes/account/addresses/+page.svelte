<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import Button from '$lib/components/ui/Button.svelte';
	import Eyebrow from '$lib/components/ui/Eyebrow.svelte';
	import AddressForm from '$lib/components/account/AddressForm.svelte';
	import Callout from '$lib/components/account/Callout.svelte';
	import Empty from '$lib/components/account/Empty.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// The server is the only validator; this page renders what it said. On a
	// failed submit the server echoes the typing back, so nothing is lost with
	// JavaScript off either.
	let values = $derived(form?.values ?? data.values);
	let errors = $derived(form?.errors ?? {});
	let failure = $derived(form?.failure ?? '');

	let saved = $derived(page.url.searchParams.get('saved') === '1');
	let deleted = $derived(page.url.searchParams.get('deleted') === '1');
</script>

<svelte:head>
	<title>Addresses — Rootwear</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<Eyebrow tone="strong" class="text-forest/70">Account</Eyebrow>
<h1
	class="display mt-6 text-[clamp(2.8rem,6.4vw,5.4rem)] leading-[0.86] tracking-[-0.055em] text-forest"
>
	Addresses.
</h1>
<p class="mt-8 max-w-[56ch] text-[16px] leading-[1.85] text-forest/70">
	Where we send things. We ship within India only, so every address here carries an Indian pincode
	and a mobile number the courier can actually call.
</p>

{#if failure}
	<div class="mt-10 max-w-[64ch]"><Callout kind="error">{failure}</Callout></div>
{/if}

{#if saved && !failure}
	<div class="mt-10 max-w-[64ch]"><Callout kind="success">Saved.</Callout></div>
{/if}

{#if deleted}
	<div class="mt-10 max-w-[64ch]"><Callout kind="success">That address is deleted.</Callout></div>
{/if}

{#if !data.linked}
	<div class="mt-10 max-w-[64ch]">
		<Callout>
			This account is not linked to a customer record yet, so there is nowhere to save an address.
			It links itself the first time you order.
		</Callout>
	</div>
{/if}

{#if data.mode === 'new' || data.mode === 'edit'}
	<div class="mt-14 max-w-[46rem]">
		{#key `${data.mode}-${data.editing?.id ?? 'new'}`}
			<AddressForm
				title={data.mode === 'edit' ? 'Edit this address' : 'Add an address'}
				note={data.mode === 'edit'
					? 'Changing this does not change any order already placed — those keep the address they were shipped to.'
					: 'Your first saved address becomes the default automatically.'}
				action={data.mode === 'edit' ? `?edit=${data.editing?.id ?? ''}&/update` : '?new=1&/create'}
				submitLabel={data.mode === 'edit' ? 'Save changes' : 'Save address'}
				cancelHref="/account/addresses"
				recordId={data.mode === 'edit' ? (data.editing?.id ?? '') : ''}
				{values}
				{errors}
			/>
		{/key}
	</div>
{:else if data.mode === 'delete' && data.editing}
	<section
		class="mt-14 max-w-[46rem] border border-alert px-6 py-8 sm:px-9"
		aria-labelledby="delete-title"
	>
		<h2
			id="delete-title"
			class="display text-[clamp(1.7rem,3vw,2.4rem)] leading-[1.05] text-forest"
		>
			Delete this address?
		</h2>
		<address class="mt-6 text-[15px] leading-[1.9] text-forest/80 not-italic">
			{data.editing.name}<br />
			{data.editing.line1}<br />
			{#if data.editing.line2}{data.editing.line2}<br />{/if}
			{data.editing.city}, {data.editing.state}
			{data.editing.pincode}
		</address>
		<p class="mt-6 max-w-[48ch] text-[15px] leading-[1.8] text-forest/70">
			Orders already placed keep the address they were shipped to. This only removes it from the
			list you choose from at checkout.
		</p>
		<form
			method="POST"
			action="?delete={data.editing.id}&/delete"
			class="mt-8 flex flex-wrap items-center gap-6"
			use:enhance
		>
			<input type="hidden" name="id" value={data.editing.id} />
			<Button type="submit" variant="solid" surface="light">Delete it</Button>
			<a
				href="/account/addresses"
				class="text-[11px] tracking-[0.2em] text-forest/75 uppercase underline-offset-4 hover:text-forest hover:underline font-medium"
			>
				Keep it
			</a>
		</form>
	</section>
{:else if data.addresses.length === 0}
	<div class="mt-14 max-w-[52rem]">
		<Empty
			title="No saved addresses."
			actionHref="/account/addresses?new=1"
			actionLabel="Add an address"
		>
			<p>
				Saving one is optional. Checkout asks for an address either way, and anything you enter
				there can be saved afterwards.
			</p>
		</Empty>
	</div>
{:else}
	<div class="mt-12">
		<Button href="/account/addresses?new=1" surface="light">Add an address</Button>
	</div>
{/if}

{#if data.addresses.length > 0}
	<ul class="mt-12 grid list-none gap-px p-0 sm:grid-cols-2">
		{#each data.addresses as address (address.id)}
			<li class="border border-forest/20 px-6 py-7">
				<div class="flex flex-wrap items-start justify-between gap-3">
					<p class="text-[11px] tracking-[0.28em] text-forest/65 uppercase font-medium">{address.label}</p>
					{#if address.isDefault}
						<p
							class="border border-gold px-2.5 py-1 text-[11px] leading-none tracking-[0.18em] text-forest uppercase font-medium"
						>
							Default
						</p>
					{/if}
				</div>

				<address class="mt-5 text-[15px] leading-[1.9] text-forest/80 not-italic">
					{address.name}<br />
					{address.line1}<br />
					{#if address.line2}{address.line2}<br />{/if}
					{address.city}, {address.state}
					{address.pincode}<br />
					{address.country} · {address.phone}
				</address>

				<div class="mt-7 flex flex-wrap items-center gap-5 border-t border-forest/15 pt-5">
					<a
						href="/account/addresses?edit={address.id}"
						class="text-[11px] tracking-[0.2em] text-forest uppercase underline-offset-4 hover:underline font-medium"
					>
						Edit
					</a>

					{#if !address.isDefault}
						<form method="POST" action="?/setDefault" use:enhance>
							<input type="hidden" name="id" value={address.id} />
							<button
								type="submit"
								class="text-[11px] tracking-[0.2em] text-forest/75 uppercase underline-offset-4 hover:text-forest hover:underline font-medium"
							>
								Make default
								<span class="sr-only">for {address.label}, {address.line1}</span>
							</button>
						</form>
					{/if}

					<a
						href="/account/addresses?delete={address.id}"
						class="text-[11px] tracking-[0.2em] text-forest/75 uppercase underline-offset-4 hover:text-forest hover:underline font-medium"
					>
						Delete
						<span class="sr-only">{address.label}, {address.line1}</span>
					</a>
				</div>
			</li>
		{/each}
	</ul>

	<p class="mt-10 max-w-[62ch] text-[13px] leading-[1.9] text-forest/70">
		Exactly one address is the default. Making another the default moves it across rather than
		leaving you with two, and deleting the default promotes the one you touched most recently.
	</p>
{/if}
