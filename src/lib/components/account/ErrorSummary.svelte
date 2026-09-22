<script lang="ts">
	/**
	 * Every field error, once, at the top of the form.
	 *
	 * Errors must be ANNOUNCED, not merely coloured. Each entry is a real link
	 * to the control that failed, so a keyboard or screen-reader user reaches
	 * the wrong field in one step instead of walking the whole form — and the
	 * ids match ui/Field.svelte's `f-<name>` convention exactly.
	 */
	let {
		errors,
		title = 'That did not save.'
	}: { errors: Record<string, string | undefined>; title?: string } = $props();

	let entries = $derived(
		Object.entries(errors).filter((entry): entry is [string, string] => Boolean(entry[1]))
	);
</script>

{#if entries.length > 0}
	<div class="border-l-2 border-alert bg-alert/[0.06] px-5 py-4" role="alert" tabindex="-1">
		<p class="text-[10px] tracking-[0.28em] text-forest uppercase">{title}</p>
		<ul class="mt-3 flex list-none flex-col gap-1.5 p-0 text-sm leading-relaxed text-forest/80">
			{#each entries as [field, message] (field)}
				<li>
					<a class="underline underline-offset-4" href="#f-{field}">{message}</a>
				</li>
			{/each}
		</ul>
	</div>
{/if}
