<script lang="ts">
	/** The house micro-type: uppercase, wide tracking, small. Used everywhere. */
	let {
		children,
		tone = 'muted',
		/**
		 * Only `gold` needs this: the brand gold is tuned for dark grounds and
		 * measures 2.34:1 on white, so a light surface needs the ink variant.
		 * `muted` and `strong` follow the surrounding ink and need no hint.
		 */
		surface = 'dark',
		class: klass = ''
	}: {
		children: import('svelte').Snippet;
		tone?: 'muted' | 'strong' | 'gold';
		surface?: 'dark' | 'light';
		class?: string;
	} = $props();

	/**
	 * `muted` follows whatever ink the surrounding surface set, rather than
	 * naming a shade. A fixed text-stone-400 read at 2.59:1 once the drop pages
	 * became white — the eyebrow has no idea what it is sitting on, so it
	 * should not be the thing deciding.
	 */
	let tones = $derived({
		muted: 'text-current/75',
		strong: 'text-current',
		gold: surface === 'light' ? 'text-gold-ink' : 'text-gold'
	});
</script>

<p class="text-[11px] tracking-[0.28em] uppercase {tones[tone]} {klass} font-medium">
	{@render children()}
</p>
