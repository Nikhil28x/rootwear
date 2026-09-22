<script lang="ts">
	/** The house micro-type: uppercase, wide tracking, small. Used everywhere. */
	let {
		children,
		tone = 'muted',
		class: klass = ''
	}: {
		children: import('svelte').Snippet;
		tone?: 'muted' | 'strong' | 'gold';
		class?: string;
	} = $props();

	const tones = {
		muted: 'text-stone-400',
		strong: 'text-current',
		gold: 'text-gold'
	};
</script>

<p class="text-[11px] tracking-[0.28em] uppercase {tones[tone]} {klass} font-medium">
	{@render children()}
</p>
