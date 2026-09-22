<script lang="ts">
	/**
	 * A labelled form control. The repo had zero form inputs before this, so
	 * every checkout, contact and account field renders through here — which is
	 * what keeps error wording, required marking and focus treatment consistent.
	 *
	 * Errors are described by `aria-describedby` and announced, not merely
	 * coloured: colour alone is not an error message.
	 */
	let {
		label,
		name,
		type = 'text',
		value = $bindable(''),
		required = false,
		error = '',
		hint = '',
		placeholder = '',
		autocomplete = undefined,
		inputmode = undefined,
		rows = 0,
		options = [],
		surface = 'light',
		...rest
	}: {
		label: string;
		name: string;
		type?: string;
		value?: string;
		required?: boolean;
		error?: string;
		hint?: string;
		placeholder?: string;
		autocomplete?: import('svelte/elements').FullAutoFill;
		inputmode?: 'text' | 'numeric' | 'tel' | 'email' | 'search';
		rows?: number;
		options?: Array<{ value: string; label: string }>;
		surface?: 'light' | 'dark';
		[key: string]: unknown;
	} = $props();

	let id = $derived(`f-${name}`);
	let describedBy = $derived(
		[error ? `${id}-error` : '', hint ? `${id}-hint` : ''].filter(Boolean).join(' ') || undefined
	);

	let shell = $derived(
		surface === 'light'
			? 'border-forest/25 bg-transparent text-forest placeholder:text-forest/60 focus:border-forest'
			: 'border-white/25 bg-transparent text-stone-100 placeholder:text-stone-400 focus:border-white'
	);

	let control = $derived(
		`w-full border-b ${shell} px-0 py-2.5 text-[15px] outline-none transition-colors ` +
			(error ? 'border-b-2 border-alert' : '')
	);
</script>

<div class="flex flex-col gap-2">
	<label
		for={id}
		class="text-[11px] tracking-[0.2em] uppercase {surface === 'light'
			? 'text-forest/75'
			: 'text-stone-400'} font-medium"
	>
		{label}{#if required}<span aria-hidden="true" class="text-gold"> *</span>{/if}
	</label>

	{#if options.length > 0}
		<select {id} {name} bind:value {required} class={control} aria-describedby={describedBy} {...rest}>
			<option value="" disabled>Select…</option>
			{#each options as option (option.value)}
				<option value={option.value}>{option.label}</option>
			{/each}
		</select>
	{:else if rows > 0}
		<textarea
			{id}
			{name}
			{rows}
			{required}
			{placeholder}
			bind:value
			class="{control} resize-y"
			aria-describedby={describedBy}
			{...rest}
		></textarea>
	{:else}
		<input
			{id}
			{name}
			{type}
			{required}
			{placeholder}
			{autocomplete}
			{inputmode}
			bind:value
			class={control}
			aria-describedby={describedBy}
			aria-invalid={error ? 'true' : undefined}
			{...rest}
		/>
	{/if}

	{#if hint && !error}
		<p id="{id}-hint" class="text-[13px] {surface === 'light' ? 'text-forest/70' : 'text-stone-400'}">
			{hint}
		</p>
	{/if}
	{#if error}
		<p id="{id}-error" class="text-[13px] text-alert">{error}</p>
	{/if}
</div>
