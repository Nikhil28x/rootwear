<script lang="ts">
	import type { Snippet } from 'svelte';
	import AccountNav from '$lib/components/account/AccountNav.svelte';
	import Callout from '$lib/components/account/Callout.svelte';
	import HempMotif from '$lib/components/art/HempMotif.svelte';
	import RootSystem from '$lib/components/art/RootSystem.svelte';
	import type { LayoutData } from './$types';

	/**
	 * The account chrome. Cream, because this is the one area of the site that
	 * is read rather than looked at — order numbers, amounts and addresses.
	 * The root layout already lists /account as a light route, so the shared
	 * header arrives in its cream treatment and this surface continues it.
	 *
	 * The sign-in page renders inside the same frame WITHOUT the navigation:
	 * a menu of pages you cannot open yet is noise on a form.
	 */
	let { data, children }: { data: LayoutData; children: Snippet } = $props();
</script>

<main class="relative isolate min-h-svh overflow-hidden bg-cream text-forest">
	<div
		class="pointer-events-none absolute inset-0 -z-10 text-forest select-none"
		aria-hidden="true"
	>
		<div class="absolute -top-32 -right-36 h-[34rem] w-[34rem]">
			<HempMotif opacity={0.04} seed={9} />
		</div>
		<div class="absolute -bottom-28 -left-32 hidden h-[24rem] w-[44rem] sm:block">
			<RootSystem opacity={0.05} depth={6} />
		</div>
	</div>

	<div class="mx-auto max-w-[1600px] px-5 py-24 sm:px-10 sm:py-32 lg:px-14">
		{#if data.fixtures}
			<!--
				A standing condition, not a response to an action, so it is a plain
				region rather than an alert. It exists because every record below is
				generated from fixtures: nobody reviewing this area should be able to
				mistake one for a real customer's order.
			-->
			<div class="mb-14 max-w-[70ch]">
				<Callout>
					These records come from the in-repo fixtures, not from a database. The screens are real;
					the orders, reservations and addresses on them are not.
				</Callout>
			</div>
		{/if}

		{#if data.signedIn}
			<div class="grid gap-14 lg:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] lg:gap-20">
				<AccountNav email={data.email} outstanding={data.outstandingCount ?? 0} />
				<div class="min-w-0">
					{@render children()}
				</div>
			</div>
		{:else}
			{@render children()}
		{/if}
	</div>
</main>
