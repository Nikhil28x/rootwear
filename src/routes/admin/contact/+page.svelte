<script lang="ts">
	import SectionHead from '$lib/components/admin/SectionHead.svelte';
	import StatePill from '$lib/components/admin/StatePill.svelte';
	import StatTile from '$lib/components/admin/StatTile.svelte';
	import Notice from '$lib/components/admin/Notice.svelte';
	import { contactTone, humanise, shortDateTime } from '$lib/components/admin/tone';
	import { SUPPORT_EMAIL } from '$lib/content/business';

	let { data, form } = $props();

	let openCount = $derived(data.submissions.filter((row) => row.status !== 'closed').length);
	let newCount = $derived(data.submissions.filter((row) => row.status === 'new').length);
</script>

<svelte:head>
	<title>Contact — Rootwear operations</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<SectionHead
	level={1}
	eyebrow="Support"
	title="Contact submissions"
	note="The third support channel, alongside email and Instagram DM. Everything sent through the form is stored here so nothing is lost in an inbox."
/>

<div class="mt-10 grid gap-px bg-white/10 sm:grid-cols-3">
	<StatTile
		label="Unanswered"
		value={String(newCount)}
		note="Nobody has picked these up yet."
		severity={newCount > 0 ? 'act' : 'none'}
	/>
	<StatTile label="Open" value={String(openCount)} note="New and in progress together." />
	<StatTile
		label="Filtered as spam"
		value={String(data.spam.length)}
		note="Kept, never deleted, and listed separately below in case one is genuine."
	/>
</div>

{#if form?.message}
	<!-- A refused status write drawn as a success is worse than no message at
	     all: the operator walks away believing the submission is closed. -->
	<div class="mt-8">
		<Notice kind={form.ok ? 'success' : 'error'}>{form.message}</Notice>
	</div>
{/if}

<form method="GET" class="mt-12 flex flex-wrap items-end gap-6 border-y border-white/10 py-6">
	<div class="flex min-w-[12rem] flex-col gap-2">
		<label for="f-status" class="text-[11px] tracking-[0.2em] text-stone-400 uppercase font-medium">Status</label>
		<select
			id="f-status"
			name="status"
			value={data.filter.status}
			class="w-full border-b border-white/25 bg-transparent px-0 py-2.5 text-[15px] text-stone-100 outline-none focus:border-white"
		>
			<option value="">Everything</option>
			{#each data.statuses as status (status)}
				<option value={status}>{humanise(status)}</option>
			{/each}
		</select>
	</div>
	<button
		type="submit"
		class="border border-white/35 px-7 py-3 text-[11px] tracking-[0.2em] text-stone-100 uppercase transition hover:bg-white hover:text-black font-medium"
	>
		Apply
	</button>
	<a
		href="/admin/contact"
		class="text-[11px] tracking-[0.2em] text-stone-400 uppercase underline underline-offset-4 hover:text-stone-200 font-medium"
	>
		Clear
	</a>
</form>

<section class="mt-12 flex flex-col gap-6">
	{#each data.submissions as row (row.id)}
		<article class="flex flex-col gap-5 border border-white/10 p-6">
			<div class="flex flex-wrap items-start justify-between gap-4">
				<div class="flex flex-col gap-2">
					<h2 class="text-base text-cream">{row.subject || 'No subject'}</h2>
					<p class="text-[13px] text-stone-400">
						{row.name} ·
						<a class="underline underline-offset-4 hover:text-stone-300" href="mailto:{row.email}">
							{row.email}
						</a>
						· <span class="tabular-nums">{shortDateTime(row.createdAt)} IST</span>
					</p>
				</div>
				<StatePill label={humanise(row.status)} tone={contactTone(row.status)} />
			</div>

			<p class="max-w-[62rem] text-[15px] leading-relaxed text-stone-300">{row.message}</p>

			<div class="flex flex-wrap items-center gap-3 border-t border-white/10 pt-5">
				{#each data.statuses as status (status)}
					{#if status !== row.status}
						<form method="POST" action="?/setStatus">
							<input type="hidden" name="id" value={row.id} />
							<input type="hidden" name="status" value={status} />
							<button
								type="submit"
								class="border border-white/25 px-4 py-2 text-[11px] tracking-[0.18em] text-stone-300 uppercase transition hover:bg-white hover:text-black font-medium"
							>
								Mark {humanise(status).toLowerCase()}
							</button>
						</form>
					{/if}
				{/each}
				<a
					class="ml-auto text-[11px] tracking-[0.18em] text-stone-400 uppercase underline underline-offset-4 hover:text-cream font-medium"
					href="mailto:{row.email}?subject={encodeURIComponent(`Re: ${row.subject || 'your message'}`)}"
				>
					Reply by email →
				</a>
			</div>
		</article>
	{:else}
		<Notice kind="info">
			Nothing here. Messages sent through the contact form land on this screen, and the address on
			the site is {SUPPORT_EMAIL}.
		</Notice>
	{/each}
</section>

{#if data.spam.length > 0}
	<section class="mt-16 flex flex-col gap-6 border-t border-white/10 pt-10">
		<SectionHead
			eyebrow="Quarantine"
			title="Filtered as spam"
			note="Held rather than discarded. The filter is a honeypot field, and a honeypot can be wrong."
		/>

		{#each data.spam as row (row.id)}
			<article class="flex flex-col gap-3 border border-white/10 px-6 py-5">
				<p class="text-[15px] text-stone-400">{row.subject || 'No subject'}</p>
				<p class="text-[13px] text-stone-400">
					{row.email} · <span class="tabular-nums">{shortDateTime(row.createdAt)}</span>
				</p>
				<p class="max-w-[62rem] text-[15px] leading-relaxed text-stone-400">{row.message}</p>
			</article>
		{/each}
	</section>
{/if}
