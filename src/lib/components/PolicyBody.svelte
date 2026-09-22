<script lang="ts">
	import type { PolicyBlock } from '$lib/server/content/types';
	import { SUPPORT_EMAIL, INSTAGRAM_HANDLE, INSTAGRAM_URL } from '$lib/content/business';

	/**
	 * §03 template 10 — the block renderer. THIS is "unlimited pages on one
	 * template": a policy page is ordered data, and every typographic decision
	 * lives here rather than in the content.
	 *
	 * A page therefore cannot inject markup, cannot invent a heading level and
	 * cannot drift from the house type scale. The page supplies the <h1>; every
	 * heading block below is an <h2>, so the outline stays legal whatever the
	 * content does.
	 *
	 * `surface` says what the body sits ON — white for the policy pages,
	 * forest-black for search and the error page. One renderer, both grounds.
	 */
	let {
		blocks,
		surface = 'light',
		label = ''
	}: { blocks: readonly PolicyBlock[]; surface?: 'light' | 'dark'; label?: string } = $props();

	/**
	 * A table needs a name a screen reader can announce, and the content model
	 * has no caption field — so each table borrows the heading it sits under,
	 * falling back to the page's own title. Computed once, as a $derived, so a
	 * new `blocks` prop cannot leave a stale caption behind.
	 */
	let captions = $derived.by(() => {
		const out: string[] = [];
		let heading = label;
		for (const block of blocks) {
			if (block.type === 'heading') heading = block.text;
			out.push(heading);
		}
		return out;
	});

	let tone = $derived(
		surface === 'light'
			? {
					body: 'text-forest/75',
					heading: 'text-forest',
					rule: 'border-forest/15',
					callout: 'border-gold bg-forest/[0.035] text-forest',
					tableHead: 'text-forest/70',
					tableRule: 'border-forest/15',
					link: 'text-forest underline decoration-gold decoration-1 underline-offset-[5px] transition hover:decoration-forest'
				}
			: {
					body: 'text-stone-300',
					heading: 'text-stone-100',
					rule: 'border-white/12',
					callout: 'border-gold bg-white/[0.03] text-stone-200',
					tableHead: 'text-stone-400',
					tableRule: 'border-white/12',
					link: 'text-stone-100 underline decoration-gold decoration-1 underline-offset-[5px] transition hover:decoration-stone-100'
				}
	);
</script>

<div class="flex flex-col gap-8">
	{#each blocks as block, i (i)}
		{#if block.type === 'heading'}
			<h2
				class="display mt-8 text-[clamp(1.6rem,2.6vw,2.4rem)] leading-[1.05] tracking-[-0.02em] {tone.heading} first:mt-0"
			>
				{block.text}
			</h2>
		{:else if block.type === 'paragraph'}
			<p class="max-w-[62ch] text-[16px] leading-[1.85] {tone.body}">{block.text}</p>
		{:else if block.type === 'list'}
			<ul class="flex max-w-[62ch] flex-col gap-3">
				{#each block.items as item, j (j)}
					<li class="relative pl-7 text-[16px] leading-[1.75] {tone.body}">
						<span class="absolute top-[0.85em] left-0 block h-px w-4 bg-gold" aria-hidden="true"
						></span>
						{item}
					</li>
				{/each}
			</ul>
		{:else if block.type === 'callout'}
			<p class="max-w-[62ch] border-l-2 px-6 py-5 text-[16px] leading-[1.75] {tone.callout}">
				{block.text}
			</p>
		{:else if block.type === 'table'}
			<!-- A wide table scrolls inside its own container; the page never does. -->
			<div class="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
				<table class="w-full min-w-[34rem] border-collapse text-left text-[15px]">
					{#if captions[i]}
						<caption class="sr-only">{captions[i]}</caption>
					{/if}
					<thead>
						<tr class="border-b {tone.tableRule}">
							{#each block.head as cell, j (j)}
								<th
									scope="col"
									class="py-3 pr-6 text-[11px] font-normal tracking-[0.2em] uppercase {tone.tableHead}"
								>
									{cell}
								</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each block.rows as row, r (r)}
							<tr class="border-b {tone.tableRule}">
								{#each row as cell, c (c)}
									{#if c === 0}
										<th
											scope="row"
											class="py-4 pr-6 align-top text-[15px] font-normal tracking-[0.06em] {tone.heading}"
										>
											{cell}
										</th>
									{:else}
										<td class="py-4 pr-6 align-top tabular-nums {tone.body}">{cell}</td>
									{/if}
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else if block.type === 'contact'}
			<!--
				§11: email and Instagram DM are the two support channels, and both
				must appear wherever support is offered. Read from business.ts.
			-->
			<div class="mt-4 max-w-[62ch] border-t pt-8 {tone.rule}">
				<p class="text-[16px] leading-[1.75] {tone.body}">{block.text}</p>
				<p class="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[14px]">
					<a class={tone.link} href="mailto:{SUPPORT_EMAIL}">{SUPPORT_EMAIL}</a>
					<a class={tone.link} href={INSTAGRAM_URL} rel="noreferrer noopener">
						{INSTAGRAM_HANDLE} — DM
					</a>
					<a class={tone.link} href="/contact">Contact form</a>
				</p>
			</div>
		{/if}
	{/each}
</div>
