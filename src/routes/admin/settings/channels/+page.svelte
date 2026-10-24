<script lang="ts">
	import { enhance } from '$app/forms';
	import { Mail, MessageCircle, Send } from '@lucide/svelte';
	import Chip from '$lib/components/admin/ui/Chip.svelte';
	import Section from '$lib/components/admin/ui/Section.svelte';
	import { submitter } from '$lib/components/admin/enhance';
	import { getToaster } from '$lib/components/admin/toast.svelte';

	let { data } = $props();
	const toaster = getToaster();

	const SETUP = {
		email: [
			['ZEPTOMAIL_TOKEN', 'Send Mail token from ZeptoMail → Mail Agents → SMTP/API'],
			['EMAIL_FROM', 'The verified sender, e.g. hi@rootwear.in'],
			['SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS', 'Only if not using ZeptoMail: your mailbox’s SMTP details']
		],
		whatsapp: [
			['WHATSAPP_PHONE_NUMBER_ID', 'Meta → WhatsApp → API Setup → Phone number ID'],
			['WHATSAPP_ACCESS_TOKEN', 'A permanent System User token with whatsapp_business_messaging'],
			['META_APP_SECRET', 'Meta app → Settings → Basic → App secret (verifies webhooks)'],
			['META_VERIFY_TOKEN', 'Any long random string; paste the same value into Meta’s webhook form'],
			['META_PAGE_ACCESS_TOKEN', 'For lead ads: a Page token with leads_retrieval, to read each submission']
		]
	} as const;
</script>

<svelte:head><title>Email & WhatsApp · Settings · Rootwear admin</title></svelte:head>

<div class="flex max-w-[880px] flex-col gap-10">
	{#each data.channels as channel (channel.channel)}
		<Section
			title={channel.channel === 'email' ? 'Email' : 'WhatsApp'}
			description={channel.channel === 'email'
				? 'Order updates, balance links, cart reminders and staff invitations.'
				: 'The same updates on WhatsApp, using templates Meta has approved.'}
		>
			{#snippet actions()}
				{#if channel.configured}
					<Chip label="Connected" tone="success" />
				{:else}
					<Chip label="Not connected" tone="warning" />
				{/if}
			{/snippet}

			<div class="q-card q-divide">
				<div class="flex items-start gap-3 p-4">
					<span class="mt-0.5 text-q-tertiary">
						{#if channel.channel === 'email'}<Mail size={20} strokeWidth={1.5} />{:else}<MessageCircle
								size={20}
								strokeWidth={1.5}
							/>{/if}
					</span>
					<div class="flex min-w-0 flex-1 flex-col gap-1">
						{#if channel.configured}
							<p class="text-[14px] text-q-text">{channel.provider}</p>
							<p class="text-[13px] break-words text-q-secondary">{channel.sender}</p>
						{:else}
							<p class="text-[14px] text-q-text">
								Messages are logged but not sent until this is connected.
							</p>
							<p class="text-[13px] text-q-secondary">
								Add these to the server environment, then redeploy:
							</p>
						{/if}
					</div>
				</div>

				{#if !channel.configured}
					<dl class="flex flex-col gap-3 p-4">
						{#each SETUP[channel.channel] as [name, help] (name)}
							<div class="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
								<dt class="q-mono w-full flex-none text-q-text sm:w-[280px]">{name}</dt>
								<dd class="text-[13px] leading-[18px] text-q-secondary">{help}</dd>
							</div>
						{/each}
					</dl>
				{/if}

				<form
					method="POST"
					action="?/test"
					class="flex flex-col gap-2 p-4 sm:flex-row sm:items-end"
					use:enhance={submitter(toaster)}
				>
					<input type="hidden" name="channel" value={channel.channel} />
					<div class="flex flex-1 flex-col gap-2">
						<label class="q-label" for="test-{channel.channel}">Send a test</label>
						<input
							id="test-{channel.channel}"
							name="to"
							class="q-input"
							type={channel.channel === 'email' ? 'email' : 'tel'}
							placeholder={channel.channel === 'email' ? 'you@example.com' : '98765 43210'}
							value={channel.channel === 'email' ? data.myEmail : ''}
							required
						/>
					</div>
					<button type="submit" class="q-btn q-btn-secondary"><Send /> Send test</button>
				</form>
			</div>
		</Section>
	{/each}

	<Section
		title="Meta webhook"
		description="Delivery receipts, incoming WhatsApp messages and lead ads arrive here."
	>
		{#snippet actions()}
			{#if data.webhookReady}
				<Chip label="Ready" tone="success" />
			{:else}
				<Chip label="Needs META_APP_SECRET and META_VERIFY_TOKEN" tone="warning" />
			{/if}
		{/snippet}
		<div class="q-card flex flex-col gap-3 p-4">
			<div class="flex flex-col gap-1">
				<p class="q-label">Callback URL</p>
				<code class="q-mono break-all text-q-body">{data.webhookUrl}</code>
			</div>
			<p class="q-help">
				In your Meta app, subscribe WhatsApp to <span class="q-mono">messages</span> and the Facebook
				Page to <span class="q-mono">leadgen</span>, using this URL and your META_VERIFY_TOKEN.
			</p>
		</div>
	</Section>

	<Section
		title="Retries"
		description="If a provider is down, messages wait in the queue. Schedule this address every two minutes with your CRON_SECRET as a bearer token."
	>
		<div class="q-card p-4">
			<code class="q-mono break-all text-q-body">{data.cronUrl}</code>
		</div>
	</Section>
</div>
