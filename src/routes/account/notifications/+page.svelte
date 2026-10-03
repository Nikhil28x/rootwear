<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import Eyebrow from '$lib/components/ui/Eyebrow.svelte';
	import Callout from '$lib/components/account/Callout.svelte';
	import Empty from '$lib/components/account/Empty.svelte';
	import RecordState from '$lib/components/account/RecordState.svelte';
	import { shortDate } from '$lib/components/account/state-labels';
	import { FIT_DISCLAIMER } from '$lib/drop/sizes';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let updated = $derived(page.url.searchParams.get('updated') === '1');

	const QUEUE_LABEL = {
		waiting: 'On the waitlist',
		offered: 'Offered to you',
		converted: 'Purchased',
		expired: 'Offer expired',
		withdrawn: 'Left'
	} as const;

	const QUEUE_TONE = {
		waiting: 'settled',
		offered: 'attention',
		converted: 'settled',
		expired: 'closed',
		withdrawn: 'closed'
	} as const;

	let nothing = $derived(data.notifications.length === 0 && data.waitlist.length === 0);
</script>

<svelte:head>
	<title>Notifications — Rootwear</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<Eyebrow tone="strong" class="text-forest/70">Account</Eyebrow>
<h1
	class="display mt-6 text-[clamp(2.8rem,6.4vw,5.4rem)] leading-[0.86] tracking-[-0.055em] text-forest"
>
	Notifications.
</h1>
<p class="mt-8 max-w-[58ch] text-[16px] leading-[1.85] text-forest/70">
	Restock alerts and waitlists. We'll email <span class="text-forest">{data.email}</span>.
</p>

{#if form?.failure}
	<div class="mt-10 max-w-[64ch]"><Callout kind="error">{form.failure}</Callout></div>
{/if}

{#if updated && !form?.failure}
	<div class="mt-10 max-w-[64ch]"><Callout kind="success">Updated.</Callout></div>
{/if}

{#if nothing}
	<div class="mt-14 max-w-[52rem]">
		<Empty title="No alerts yet." actionHref="/drops" actionLabel="See the current drop">
			<p>
				When a size sells out, ask to be notified if it comes back. Your alerts and waitlist spots
				appear here.
			</p>
		</Empty>
	</div>
{:else}
	<!-- §09: the fit disclaimer accompanies every screen that shows a size. -->
	<p class="mt-12 max-w-[54ch] text-[13px] leading-relaxed text-forest/70">{FIT_DISCLAIMER}</p>

	<section class="mt-10" aria-labelledby="notify-title">
		<h2 id="notify-title" class="text-[11px] tracking-[0.28em] text-forest/65 uppercase font-medium">
			Back-in-stock alerts
		</h2>

		{#if data.notifications.length === 0}
			<p class="mt-6 max-w-[54ch] text-[15px] leading-[1.8] text-forest/75">
				No restock alerts.
			</p>
		{:else}
			<ul class="mt-6 flex list-none flex-col gap-px border-t border-forest/15 p-0">
				{#each data.notifications as row (row.id)}
					<li
						class="flex flex-wrap items-start justify-between gap-5 border-b border-forest/15 py-6"
					>
						<div class="min-w-0">
							<p class="text-[15px] text-forest">
								{row.productName ?? 'A piece'}
								{#if row.size}<span class="text-forest/75"> · size {row.size}</span>{/if}
							</p>
							<p class="mt-1.5 text-[13px] text-forest/70">
								{#if row.dropName}{row.dropName} ·
								{/if}{row.sku ?? ''}
							</p>
							<p class="mt-2 text-[13px] text-forest/70">
								Signed up {shortDate(row.consentedAt)}.
								{#if row.notifiedAt !== null}
									Emailed {shortDate(row.notifiedAt)}.
								{/if}
							</p>
						</div>

						<div class="flex shrink-0 items-center gap-5">
							{#if row.dropSlug}
								<a
									class="text-[11px] tracking-[0.2em] text-forest/75 uppercase underline-offset-4 hover:text-forest hover:underline font-medium"
									href="/drops/{row.dropSlug}"
								>
									View drop
								</a>
							{/if}
							<form method="POST" action="?/unsubscribe" use:enhance>
								<input type="hidden" name="id" value={row.id} />
								<button
									type="submit"
									class="text-[11px] tracking-[0.2em] text-forest uppercase underline-offset-4 hover:underline font-medium"
								>
									Unsubscribe
									<span class="sr-only">
										from {row.productName ?? 'this piece'}{row.size ? `, size ${row.size}` : ''}
									</span>
								</button>
							</form>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section class="mt-16" aria-labelledby="waitlist-title">
		<h2 id="waitlist-title" class="text-[11px] tracking-[0.28em] text-forest/65 uppercase font-medium">
			Waitlist
		</h2>
		<p class="mt-4 max-w-[56ch] text-[15px] leading-[1.8] text-forest/75">
			Joining is free. If a reserved piece becomes available, we'll offer it to you in turn.
		</p>

		{#if data.waitlist.length === 0}
			<p class="mt-6 max-w-[54ch] text-[15px] leading-[1.8] text-forest/75">
				You're not on any waitlists.
			</p>
		{:else}
			<ul class="mt-6 flex list-none flex-col gap-px border-t border-forest/15 p-0">
				{#each data.waitlist as entry (entry.id)}
					<li
						class="flex flex-wrap items-start justify-between gap-5 border-b border-forest/15 py-6"
					>
						<div class="flex min-w-0 items-start gap-6">
							<p class="display shrink-0 text-[1.8rem] leading-none text-forest">
								{String(entry.position).padStart(2, '0')}
								<span class="sr-only">place on the waitlist</span>
							</p>
							<div class="min-w-0">
								<p class="text-[15px] text-forest">
									{entry.productName ?? 'A piece'}
									{#if entry.size}<span class="text-forest/75"> · size {entry.size}</span>{/if}
								</p>
								<p class="mt-1.5 text-[13px] text-forest/70">
									{#if entry.dropName}{entry.dropName} ·
									{/if}Joined {shortDate(entry.joinedAt)}
								</p>
								{#if entry.offeredAt !== null}
									<p class="mt-2 text-[13px] text-forest/75">
										Offered to you on {shortDate(entry.offeredAt)}.
									</p>
								{/if}
							</div>
						</div>

						<div class="flex shrink-0 items-center gap-5">
							<RecordState label={QUEUE_LABEL[entry.state]} tone={QUEUE_TONE[entry.state]} />
							{#if entry.state === 'waiting' || entry.state === 'offered'}
								<form method="POST" action="?/withdraw" use:enhance>
									<input type="hidden" name="id" value={entry.id} />
									<button
										type="submit"
										class="text-[11px] tracking-[0.2em] text-forest uppercase underline-offset-4 hover:underline font-medium"
									>
										Leave waitlist
										<span class="sr-only">
											for {entry.productName ?? 'this piece'}{entry.size
												? `, size ${entry.size}`
												: ''}
										</span>
									</button>
								</form>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
{/if}
