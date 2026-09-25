<script lang="ts">
	/**
	 * A labelled control for the demand forms.
	 *
	 * $lib/components/ui/Field.svelte derives its element id from the field
	 * NAME. That is right for a page with one form, and wrong here: §06 puts a
	 * notify-me on EVERY sold-out size, so one page renders several forms that
	 * each post a field called `email`. Sharing the name would mean sharing the
	 * id, which breaks every label-to-input association on the page.
	 *
	 * So this takes an explicit `id` and keeps the posted `name` stable. Same
	 * visual language as Field — underline rule, house micro-type label, errors
	 * described by aria-describedby and announced rather than merely coloured.
	 */
	let {
		id,
		name,
		label,
		type = 'text',
		value = '',
		required = false,
		error = '',
		hint = '',
		placeholder = '',
		autocomplete = undefined,
		inputmode = undefined,
		rows = 0,
		options = [],
		surface = 'dark'
	}: {
		id: string;
		name: string;
		label: string;
		type?: string;
		value?: string;
		required?: boolean;
		error?: string;
		hint?: string;
		placeholder?: string;
		autocomplete?: import('svelte/elements').FullAutoFill;
		inputmode?: 'text' | 'numeric' | 'tel' | 'email' | 'search';
		rows?: number;
		options?: ReadonlyArray<{ value: string; label: string }>;
		surface?: 'light' | 'dark';
	} = $props();

	let describedBy = $derived(
		[error ? `${id}-error` : '', hint ? `${id}-hint` : ''].filter(Boolean).join(' ') || undefined
	);

	let shell = $derived(
		surface === 'light'
			? 'border-forest/25 text-forest placeholder:text-forest/60 focus:border-forest'
			: 'border-white/25 text-stone-100 placeholder:text-stone-400 focus:border-white'
	);

	let control = $derived(
		`w-full border-b ${shell} bg-transparent px-0 py-3 text-[15px] outline-none transition-colors ` +
			(error ? 'border-b-2 border-gold' : '')
	);

	let labelTone = $derived(surface === 'light' ? 'text-forest/75' : 'text-stone-400');
	let hintTone = $derived(surface === 'light' ? 'text-forest/70' : 'text-stone-400');
	/** No error colour exists in the palette; a rule plus the words carries it. */
	let alertTone = $derived(
		surface === 'light'
			? 'border-l-2 border-gold pl-3 text-forest'
			: 'border-l-2 border-gold pl-3 text-stone-100'
	);
</script>

<div class="flex flex-col gap-2">
	<label for={id} class="text-[11px] tracking-[0.2em] uppercase {labelTone} font-medium">
		{label}{#if required}<span aria-hidden="true" class="text-gold"> *</span>{/if}
	</label>

	{#if options.length > 0}
		<select
			{id}
			{name}
			{required}
			class={control}
			aria-describedby={describedBy}
			aria-invalid={error ? 'true' : undefined}
		>
			<option value="" selected={value === ''}>Select…</option>
			{#each options as option (option.value)}
				<option value={option.value} selected={option.value === value}>{option.label}</option>
			{/each}
		</select>
	{:else if rows > 0}
		<textarea
			{id}
			{name}
			{rows}
			{required}
			{placeholder}
			class="{control} resize-y"
			aria-describedby={describedBy}
			aria-invalid={error ? 'true' : undefined}>{value}</textarea
		>
	{:else}
		<input
			{id}
			{name}
			{type}
			{required}
			{placeholder}
			{autocomplete}
			{inputmode}
			{value}
			class={control}
			aria-describedby={describedBy}
			aria-invalid={error ? 'true' : undefined}
		/>
	{/if}

	{#if hint && !error}
		<p id="{id}-hint" class="text-[13px] {hintTone}">{hint}</p>
	{/if}
	{#if error}
		<p id="{id}-error" class="text-[13px] {alertTone}">{error}</p>
	{/if}
</div>
