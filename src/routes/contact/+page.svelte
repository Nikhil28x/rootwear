<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import Field from '$lib/components/ui/Field.svelte';
	import '$lib/components/checkout/checkout.css';
	import {
		BUSINESS_NAME,
		BUSINESS_ADDRESS,
		SUPPORT_EMAIL,
		INSTAGRAM_HANDLE,
		INSTAGRAM_URL,
		displayValue,
		isPlaceholder
	} from '$lib/content/business';
	import { RETURNS_SHORT } from '$lib/content/returns';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	/**
	 * The server is the only validator; this component just renders what it
	 * said. With JavaScript off the page is re-rendered fresh and these
	 * initialisers put the visitor's words back in the boxes. With it on, the
	 * component survives the round trip and the inputs never lost them.
	 */
	const returned = untrack(() => (form && 'values' in form ? form.values : null));

	let name = $state(returned?.name ?? '');
	let email = $state(returned?.email ?? '');
	let subject = $state(returned?.subject ?? '');
	let message = $state(returned?.message ?? '');
	let submitting = $state(false);

	/** Set when the visitor asks to write a second message after a success. */
	let writeAnother = $state(false);

	let errors = $derived(form && 'errors' in form ? form.errors : undefined);
	let failure = $derived(form && 'failure' in form ? form.failure : '');
	let sent = $derived(form?.sent === true && !writeAnother);

	/** Errors are announced, not merely coloured — one list, at the top. */
	let errorList = $derived(
		Object.entries(errors ?? {}).filter(([, text]) => Boolean(text)) as Array<[string, string]>
	);

	/**
	 * Clears the success panel without waiting for a round trip. The control is
	 * an <a href="/contact"> underneath, so with JavaScript off the same click
	 * reloads the page and gets an empty form that way — never a dead button.
	 */
	function startAgain() {
		writeAnother = true;
		name = '';
		email = '';
		subject = '';
		message = '';
	}
</script>

<svelte:head>
	<title>Contact — Rootwear</title>
	<meta
		name="description"
		content="Get in touch with Rootwear by form, email or Instagram DM. We usually reply within two working days."
	/>
</svelte:head>

<main class="co contact">
	<div class="co-grid co-grid--after">
		<header class="co-mast">
			<div class="co-mast__text">
				<h1 class="co-title">Contact</h1>
				<p class="co-sub">
					Questions about an order, sizing or a drop? We reply within two working days.
				</p>
			</div>
		</header>

		<div class="co-main">
			{#if sent}
				<!-- A real success state, on the page, with what happens next. -->
				<section class="contact-sent" aria-live="polite" aria-labelledby="sent-title">
					<h2 id="sent-title" class="contact-sent__title">Thanks — message sent.</h2>
					<p class="co-lede">
						{#if form && 'name' in form && form.name}
							Thank you, {form.name}.
						{/if}
						We'll reply to
						<strong>{form && 'email' in form ? form.email : ''}</strong>
						within two working days, from {SUPPORT_EMAIL}. For anything urgent, DM us on Instagram.
					</p>
					<div class="co-actions">
						<a class="cta" href="/contact" onclick={startAgain}>Write another</a>
						<a class="link" href="/policies">Help &amp; information</a>
					</div>
				</section>
			{:else}
				<form
					class="co-form"
					method="POST"
					autocomplete="on"
					use:enhance={() => {
						submitting = true;
						// A second success must show the panel again, so the
						// "write another" flag cannot outlive this submission.
						writeAnother = false;
						return async ({ update, result }) => {
							await update({ reset: result.type === 'success' });
							submitting = false;
						};
					}}
				>
					{#if errorList.length > 0 || failure}
						<div class="co-alert" role="alert" tabindex="-1">
							<strong>{failure ? 'Not sent' : 'Check these first'}</strong>
							{#if failure}
								<p>{failure}</p>
							{:else}
								<ul>
									{#each errorList as [key, text] (key)}
										<li>{text}</li>
									{/each}
								</ul>
							{/if}
						</div>
					{/if}

					<!--
						Honeypot. Positioned off-screen and hidden from the
						accessibility tree, so no person and no screen reader ever
						meets it; anything in it came from a bot.
					-->
					<div class="contact-trap" aria-hidden="true">
						<label for="contact-website">Website</label>
						<input id="contact-website" name="website" type="text" tabindex="-1" autocomplete="off" />
					</div>

					<fieldset>
						<legend>Your details</legend>
						<div class="co-form-pair">
							<Field
								label="Your name"
								name="name"
								bind:value={name}
								required
								autocomplete="name"
								error={errors?.name ?? ''}
								surface="light"
							/>
							<Field
								label="Email"
								name="email"
								type="email"
								bind:value={email}
								required
								autocomplete="email"
								inputmode="email"
								hint="The address we will reply to."
								error={errors?.email ?? ''}
								surface="light"
							/>
						</div>
					</fieldset>

					<fieldset>
						<legend>Your message</legend>
						<Field
							label="Subject"
							name="subject"
							bind:value={subject}
							required
							options={data.subjects}
							error={errors?.subject ?? ''}
							surface="light"
						/>
						<Field
							label="Message"
							name="message"
							bind:value={message}
							required
							rows={8}
							placeholder="Include your order number, if you have one."
							hint="For a damaged piece, please email us photos instead."
							error={errors?.message ?? ''}
							surface="light"
						/>
					</fieldset>

					<div class="co-actions">
						<button class="cta" type="submit" disabled={submitting}>
							{submitting ? 'Sending…' : 'Send message'}
						</button>
						<p class="co-fine">We only use your details to reply to you.</p>
					</div>
				</form>
			{/if}
		</div>

		<!--
			§11: email and Instagram DM both appear here, read from
			$lib/content/business so the footer and this page cannot drift.
		-->
		<aside class="co-aside" aria-label="Other ways to reach us">
			<div class="co-card">
				<section class="contact-block">
					<div class="co-head"><h2>Direct</h2></div>
					<ul class="contact-list">
						<li>
							<a class="link" href="mailto:{SUPPORT_EMAIL}">{SUPPORT_EMAIL}</a>
							<span class="co-fine">Best for orders, and for sending photos.</span>
						</li>
						<li>
							<a class="link" href={INSTAGRAM_URL} rel="noreferrer noopener"
								>{INSTAGRAM_HANDLE} — DM</a
							>
							<span class="co-fine">Fastest for quick questions about a drop or sizing.</span>
						</li>
					</ul>
				</section>

				<section class="contact-block">
					<div class="co-head"><h2>Before you write</h2></div>
					<ul class="contact-list contact-list--links">
						<li><a href="/policies/track-order">Tracking an order</a></li>
						<li><a href="/policies/size-guide">Choosing a size</a></li>
						<li><a href="/policies/returns">{RETURNS_SHORT}</a></li>
						<li><a href="/policies/faq">FAQ</a></li>
					</ul>
				</section>

				<section class="contact-block">
					<div class="co-head"><h2>{BUSINESS_NAME}</h2></div>
					<address class:contact-placeholder={isPlaceholder(BUSINESS_ADDRESS)}>
						{displayValue(BUSINESS_ADDRESS)}
					</address>
				</section>
			</div>
		</aside>
	</div>
</main>

<style>
	.contact-trap {
		position: absolute;
		left: -9999px;
		width: 1px;
		height: 1px;
		overflow: hidden;
	}
	.contact-sent {
		display: flex;
		flex-direction: column;
		gap: 20px;
		padding: clamp(24px, 3vw, 40px);
		background: var(--stone);
	}
	.contact-sent__title {
		margin: 0;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: clamp(2rem, 3.4vw, 2.8rem);
		line-height: 1.02;
		letter-spacing: -0.03em;
	}
	.contact-sent strong {
		font-weight: 500;
		color: var(--ink);
	}
	.contact-block {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.contact-list {
		display: flex;
		flex-direction: column;
		gap: 14px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.contact-list li {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 15px;
	}
	.contact-list--links {
		gap: 0;
	}
	.contact-list--links li {
		border-bottom: 1px solid var(--rule);
	}
	.contact-list--links a {
		display: flex;
		justify-content: space-between;
		padding: 10px 0;
		font-size: 14px;
		transition: padding 0.25s ease;
	}
	.contact-list--links a::after {
		content: '→';
		color: var(--soft);
	}
	.contact-list--links a:hover {
		padding-left: 6px;
	}
	.contact-placeholder {
		color: var(--alert);
	}
</style>
