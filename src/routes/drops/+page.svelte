<script lang="ts">
	import { DROP_STATE_DESCRIPTION } from '$lib/domain/drop-state';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const released = new Intl.DateTimeFormat('en-IN', {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		timeZone: 'Asia/Kolkata'
	});
</script>

<svelte:head>
	<title>Drops — Rootwear</title>
	<meta
		name="description"
		content="Every Rootwear drop, newest first. Each one stays up with its story intact."
	/>
</svelte:head>

<main class="mx-auto max-w-[1600px] px-5 py-24 sm:px-10 sm:py-32 lg:px-14">
	<header class="mb-16 flex flex-col gap-4">
		<p class="text-[10px] tracking-[0.28em] text-stone-400 uppercase">The archive</p>
		<h1 class="display text-[clamp(3rem,7vw,7rem)] leading-[0.82] tracking-[-0.055em]">
			Every growth<br />so far.
		</h1>
		<p class="max-w-md text-sm leading-relaxed text-stone-400">
			Nothing is ever taken down. A drop keeps its story, its imagery and its price, long after
			the last piece has gone.
		</p>
	</header>

	<ul class="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
		{#each data.archive as drop (drop.id)}
			{@const lead = drop.products[0]?.images.find((i) => i.role === 'lead')}
			<li class="group">
				<a class="flex flex-col gap-4" href="/drops/{drop.slug}">
					{#if lead}
						<img
							class="aspect-[4/5] w-full object-cover object-center transition duration-700 ease-out group-hover:scale-[1.035]"
							src={lead.url}
							alt={lead.alt}
							loading="lazy"
						/>
					{/if}
					<div class="flex items-baseline justify-between gap-4">
						<span class="text-xs tracking-[0.18em] uppercase"
							>Drop {String(drop.number).padStart(2, '0')}</span
						>
						<span class="text-[10px] tracking-[0.16em] text-stone-500 uppercase">
							{drop.archivedAt ? released.format(drop.archivedAt) : 'In growth'}
						</span>
					</div>
					<h2 class="display text-3xl leading-none">{drop.name}</h2>
					<p class="text-xs leading-relaxed text-stone-500">
						{DROP_STATE_DESCRIPTION[drop.state]}
					</p>
				</a>
			</li>
		{/each}
	</ul>
</main>
