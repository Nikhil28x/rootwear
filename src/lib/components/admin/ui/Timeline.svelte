<script lang="ts">
	import { shortDateTime } from '../tone';

	/** A record's history, newest first: what happened, when, and who did it. */
	type TimelineEvent = {
		readonly at: number;
		readonly title: string;
		readonly detail?: string | null;
		readonly actor?: string | null;
	};

	let { events, empty = 'Nothing has happened yet.' }: { events: readonly TimelineEvent[]; empty?: string } =
		$props();
</script>

{#if events.length === 0}
	<p class="text-[14px] text-q-secondary">{empty}</p>
{:else}
	<ol class="flex flex-col">
		{#each events as event, index (index)}
			<li class="relative flex gap-3 pb-5 last:pb-0">
				{#if index < events.length - 1}
					<span class="absolute top-4 bottom-0 left-[5px] w-px bg-q-border" aria-hidden="true"></span>
				{/if}
				<span class="mt-1.5 size-[11px] flex-none rounded-full border-2 border-q-border-strong bg-q-surface"
				></span>
				<div class="flex min-w-0 flex-col gap-0.5">
					<p class="text-[14px] leading-[20px] text-q-text">{event.title}</p>
					{#if event.detail}
						<p class="text-[13px] leading-[18px] break-words text-q-secondary">{event.detail}</p>
					{/if}
					<p class="text-[12px] leading-[16px] text-q-tertiary">
						{shortDateTime(event.at)}{#if event.actor} · {event.actor}{/if}
					</p>
				</div>
			</li>
		{/each}
	</ol>
{/if}
