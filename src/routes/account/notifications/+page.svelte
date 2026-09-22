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
		waiting: 'In the queue',
		offered: 'Offered to you',
		converted: 'Taken up',
		expired: 'Offer lapsed',
		withdrawn: 'Given up'
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

<Eyebrow tone="strong" class="text-forest/50">Account</Eyebrow>
<h1
	class="display mt-6 text-[clamp(2.8rem,6.4vw,5.4rem)] leading-[0.86] tracking-[-0.055em] text-forest"
>
	Notifications.
</h1>
<p class="mt-8 max-w-[58ch] text-[15px] leading-[1.85] text-forest/70">
	What you have asked us to tell you about, and where you stand in any queue. We write to
	<span class="text-forest">{data.email}</span> and nowhere else, and only about the pieces listed here.
</p>

{#if form?.failure}
	<div class="mt-10 max-w-[64ch]"><Callout kind="error">{form.failure}</Callout></div>
{/if}

{#if updated && !form?.failure}
	<div class="mt-10 max-w-[64ch]"><Callout kind="success">That is updated.</Callout></div>
{/if}

{#if nothing}
	<div class="mt-14 max-w-[52rem]">
		<Empty title="Nothing signed up." actionHref="/drops" actionLabel="See the current drop">
			<p>
				When a size is gone you can ask to be told if it comes back, and join the queue for a
				reserved piece that lapses. Both appear here, and both can be given up in one click.
			</p>
		</Empty>
	</div>
{:else}
	<!-- §09: the fit disclaimer accompanies every screen that shows a size. -->
	<p class="mt-12 max-w-[54ch] text-xs leading-relaxed text-forest/55">{FIT_DISCLAIMER}</p>

	<section class="mt-10" aria-labelledby="notify-title">
		<h2 id="notify-title" class="text-[10px] tracking-[0.28em] text-forest/45 uppercase">
			Tell me when it is back
		</h2>

		{#if data.notifications.length === 0}
			<p class="mt-6 max-w-[54ch] text-sm leading-[1.8] text-forest/60">
				You have not asked to be told about any size.
			</p>
		{:else}
			<ul class="mt-6 flex list-none flex-col gap-px border-t border-forest/15 p-0">
				{#each data.notifications as row (row.id)}
					<li
						class="flex flex-wrap items-start justify-between gap-5 border-b border-forest/15 py-6"
					>
						<div class="min-w-0">
							<p class="text-sm text-forest">
								{row.productName ?? 'A piece'}
								{#if row.size}<span class="text-forest/60"> · size {row.size}</span>{/if}
							</p>
							<p class="mt-1.5 text-xs text-forest/50">
								{#if row.dropName}{row.dropName} ·
								{/if}{row.sku ?? ''}
							</p>
							<p class="mt-2 text-xs text-forest/55">
								You agreed to this on {shortDate(row.consentedAt)}.
								{#if row.notifiedAt !== null}
									We wrote to you on {shortDate(row.notifiedAt)}.
								{/if}
							</p>
						</div>

						<div class="flex shrink-0 items-center gap-5">
							{#if row.dropSlug}
								<a
									class="text-[10px] tracking-[0.2em] text-forest/60 uppercase underline-offset-4 hover:text-forest hover:underline"
									href="/drops/{row.dropSlug}"
								>
									Open drop
								</a>
							{/if}
							<form method="POST" action="?/unsubscribe" use:enhance>
								<input type="hidden" name="id" value={row.id} />
								<button
									type="submit"
									class="text-[10px] tracking-[0.2em] text-forest uppercase underline-offset-4 hover:underline"
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
			<p class="mt-6 max-w-[62ch] text-xs leading-[1.9] text-forest/50">
				Unsubscribing deletes the record of your consent rather than flagging it, so the address is
				genuinely off that list.
			</p>
		{/if}
	</section>

	<section class="mt-16" aria-labelledby="waitlist-title">
		<h2 id="waitlist-title" class="text-[10px] tracking-[0.28em] text-forest/45 uppercase">
			Waitlist
		</h2>
		<p class="mt-4 max-w-[56ch] text-sm leading-[1.8] text-forest/65">
			The queue is ordered, and no money is taken to join it. If a reserved piece is not paid for in
			time it is offered to the next person in line.
		</p>

		{#if data.waitlist.length === 0}
			<p class="mt-6 max-w-[54ch] text-sm leading-[1.8] text-forest/60">
				You are not in any queue.
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
								<span class="sr-only">place in the queue</span>
							</p>
							<div class="min-w-0">
								<p class="text-sm text-forest">
									{entry.productName ?? 'A piece'}
									{#if entry.size}<span class="text-forest/60"> · size {entry.size}</span>{/if}
								</p>
								<p class="mt-1.5 text-xs text-forest/50">
									{#if entry.dropName}{entry.dropName} ·
									{/if}Joined {shortDate(entry.joinedAt)}
								</p>
								{#if entry.offeredAt !== null}
									<p class="mt-2 text-xs text-forest/60">
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
										class="text-[10px] tracking-[0.2em] text-forest uppercase underline-offset-4 hover:underline"
									>
										Give up my place
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
