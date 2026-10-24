<script lang="ts">
	import { enhance } from '$app/forms';
	import Chip from '$lib/components/admin/ui/Chip.svelte';
	import Field from '$lib/components/admin/ui/Field.svelte';
	import PageHeader from '$lib/components/admin/ui/PageHeader.svelte';
	import Section from '$lib/components/admin/ui/Section.svelte';
	import Notice from '$lib/components/admin/Notice.svelte';
	import { submitter } from '$lib/components/admin/enhance';
	import { getToaster } from '$lib/components/admin/toast.svelte';
	import { timeAgo } from '$lib/components/admin/tone';

	let { data, form } = $props();
	const toaster = getToaster();

	let template = $derived(data.template);
	let subject = $state('');
	let body = $state('');
	let params = $state('');
	let active = $state(true);
	let bodyField: HTMLTextAreaElement | undefined = $state();

	$effect.pre(() => {
		subject = data.template.subject ?? '';
		body = data.template.body;
		params = data.template.waParams.join(', ');
		active = data.template.active;
	});

	const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

	function fill(text: string): string {
		return text.replace(PLACEHOLDER, (_, name: string) => data.samples[name] ?? `{{${name}}}`);
	}

	let used = $derived([...new Set([...body.matchAll(PLACEHOLDER)].map((m) => m[1]))]);
	let unknown = $derived(used.filter((name) => !(name in data.samples)));
	let available = $derived(Object.keys(data.samples).filter((name) => !used.includes(name)));

	/** Inserts {{name}} at the cursor, so nobody has to type braces. */
	function insert(name: string) {
		const field = bodyField;
		const token = `{{${name}}}`;
		if (!field) {
			body += token;
			return;
		}
		const start = field.selectionStart ?? body.length;
		const end = field.selectionEnd ?? body.length;
		body = body.slice(0, start) + token + body.slice(end);
		requestAnimationFrame(() => {
			field.focus();
			field.setSelectionRange(start + token.length, start + token.length);
		});
	}
</script>

<svelte:head><title>{template.name} · Templates · Rootwear admin</title></svelte:head>

<div class="flex flex-col gap-6">
	<PageHeader
		title="{template.name} — {template.channel === 'email' ? 'Email' : 'WhatsApp'}"
		description={template.description}
		back={{ href: '/admin/messages/templates', label: 'Templates' }}
	>
		{#snippet meta()}
			<Chip label={template.purpose === 'marketing' ? 'Marketing' : 'Transactional'} dot={false} />
		{/snippet}
	</PageHeader>

	{#if form?.error}<Notice kind="error">{form.error}</Notice>{/if}
	{#if template.purpose === 'marketing'}
		<Notice kind="info">
			Marketing messages only go to people who agreed to hear from Rootwear on this channel.
		</Notice>
	{/if}

	<div class="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
		<form
			method="POST"
			action="?/save"
			class="flex flex-col gap-5"
			use:enhance={submitter(toaster)}
		>
			<fieldset disabled={!data.canEdit} class="flex flex-col gap-5">
				{#if template.channel === 'email'}
					<Field label="Subject" id="tpl-subject">
						{#snippet children({ describedBy })}
							<input
								id="tpl-subject"
								name="subject"
								class="q-input"
								bind:value={subject}
								aria-describedby={describedBy}
							/>
						{/snippet}
					</Field>
				{/if}

				<Field
					label="Message"
					id="tpl-body"
					help={template.channel === 'email'
						? 'Plain text. Leave a blank line between paragraphs. Links become clickable.'
						: 'This is the preview. Meta sends the copy you had approved, filled with the parameters below.'}
				>
					{#snippet children({ describedBy })}
						<textarea
							id="tpl-body"
							name="body"
							class="q-textarea min-h-[220px]"
							bind:value={body}
							bind:this={bodyField}
							aria-describedby={describedBy}></textarea>
					{/snippet}
				</Field>

				{#if available.length}
					<div class="flex flex-col gap-2">
						<p class="q-help">Insert a value:</p>
						<div class="flex flex-wrap gap-1.5">
							{#each available as name (name)}
								<button
									type="button"
									class="q-btn q-btn-secondary q-btn-sm q-mono"
									onclick={() => insert(name)}
								>
									{name}
								</button>
							{/each}
						</div>
					</div>
				{/if}

				{#if template.channel === 'whatsapp'}
					<div class="grid gap-5 sm:grid-cols-[1fr_120px]">
						<Field
							label="Approved template name"
							id="tpl-wa-name"
							help="Exactly as it appears in Meta’s template manager."
						>
							{#snippet children({ describedBy })}
								<input
									id="tpl-wa-name"
									name="waTemplateName"
									class="q-input q-mono"
									value={template.waTemplateName ?? ''}
									aria-describedby={describedBy}
								/>
							{/snippet}
						</Field>
						<Field label="Language" id="tpl-wa-lang">
							{#snippet children({ describedBy })}
								<input
									id="tpl-wa-lang"
									name="waLanguage"
									class="q-input q-mono"
									value={template.waLanguage}
									aria-describedby={describedBy}
								/>
							{/snippet}
						</Field>
					</div>
					<Field
						label="Parameters, in order"
						id="tpl-wa-params"
						help={'Which value fills {{1}}, {{2}} and so on in Meta’s copy, separated by commas.'}
					>
						{#snippet children({ describedBy })}
							<input
								id="tpl-wa-params"
								name="waParams"
								class="q-input q-mono"
								bind:value={params}
								aria-describedby={describedBy}
							/>
						{/snippet}
					</Field>
				{/if}

				<label class="flex items-start gap-3 rounded-[10px] border border-q-border p-3">
					<input type="checkbox" class="q-check mt-0.5" name="active" bind:checked={active} />
					<span class="flex flex-col gap-0.5">
						<span class="text-[14px] font-medium text-q-text">Send this message</span>
						<span class="text-[13px] leading-[18px] text-q-secondary">
							Untick to stop it going out. Each one is still logged as not sent.
						</span>
					</span>
				</label>
			</fieldset>

			{#if data.canEdit}
				<div class="flex items-center gap-3">
					<button type="submit" class="q-btn q-btn-primary">Save template</button>
					<p class="q-help">
						Edited {timeAgo(template.updatedAt)}{template.updatedBy
							? ` by ${template.updatedBy}`
							: ''}
					</p>
				</div>
			{/if}
		</form>

		<Section
			title="Preview"
			description="With sample values. Real messages use the customer’s details."
		>
			{#if unknown.length}
				<Notice kind="warning">
					No value is known for {unknown.map((n) => `{{${n}}}`).join(', ')}. It will be blank when
					sent.
				</Notice>
			{/if}
			{#if template.channel === 'email'}
				<div class="q-card overflow-hidden">
					<div class="border-b border-q-border px-4 py-3">
						<p class="text-[12px] text-q-tertiary">Subject</p>
						<p class="text-[14px] font-medium text-q-text">{fill(subject)}</p>
					</div>
					<div class="px-4 py-4 text-[14px] leading-[22px] whitespace-pre-wrap text-q-body">
						{fill(body)}
					</div>
				</div>
			{:else}
				<div class="rounded-[14px] bg-q-muted p-4">
					<div
						class="max-w-[320px] rounded-[14px] rounded-tl-[4px] bg-q-surface px-3 py-2 text-[14px] leading-[20px] whitespace-pre-wrap text-q-body shadow-[var(--q-shadow-active)]"
					>
						{fill(body)}
					</div>
				</div>
			{/if}
		</Section>
	</div>
</div>
