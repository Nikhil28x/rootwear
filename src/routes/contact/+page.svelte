<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import Field from '$lib/components/ui/Field.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Eyebrow from '$lib/components/ui/Eyebrow.svelte';
	import HempMotif from '$lib/components/art/HempMotif.svelte';
	import RootSystem from '$lib/components/art/RootSystem.svelte';
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

	/**
	 * The error and outstanding-item accents. @theme in layout.css defines the
	 * four BRAND colours and no state colours, so these two are written the
	 * only way they can be — and they are written ONCE, matching the values the
	 * design system already ships in ui/Field.svelte and SiteFooter.svelte.
	 * A --color-error / --color-outstanding token would retire them.
	 */
	const ERROR_ACCENT = 'text-alert';
	const ERROR_RULE = 'border-alert bg-alert/[0.06]';
	const OUTSTANDING_ACCENT = 'text-alert-light';
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
		content="Write to Rootwear by form, email or Instagram DM. Every message is read and answered by a person."
	/>
</svelte:head>

<main class="relative isolate overflow-hidden bg-cream text-forest">
	<div class="pointer-events-none absolute inset-0 -z-10 select-none" aria-hidden="true">
		<div class="absolute -top-28 -right-32 h-[36rem] w-[36rem] text-forest">
			<HempMotif opacity={0.05} seed={6} />
		</div>
		<div class="absolute -bottom-24 -left-28 hidden h-[26rem] w-[46rem] text-forest sm:block">
			<RootSystem opacity={0.06} depth={6} />
		</div>
	</div>

	<div class="mx-auto max-w-[1600px] px-5 py-24 sm:px-10 sm:py-32 lg:px-14">
		<div class="grid gap-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-24">
			<div class="max-w-[46rem]">
				<Eyebrow tone="strong" class="text-forest/50">Contact</Eyebrow>
				<h1
					class="display mt-6 text-[clamp(3rem,7vw,7rem)] leading-[0.82] tracking-[-0.055em] text-forest"
				>
					Reach out<br />to us.
				</h1>
				<p class="mt-8 max-w-[52ch] text-[15px] leading-[1.85] text-forest/70">
					There is no ticket queue and no autoresponder. A message sent here is read by the person
					who packed your parcel, usually within two working days.
				</p>

				{#if sent}
					<!-- A real success state, on the page, with what happens next. -->
					<section
						class="mt-14 border-l-2 border-gold bg-forest/[0.035] px-7 py-9"
						aria-live="polite"
						aria-labelledby="sent-title"
					>
						<h2
							id="sent-title"
							class="display text-[clamp(1.8rem,3vw,2.6rem)] leading-[1.05] text-forest"
						>
							That has reached us.
						</h2>
						<p class="mt-5 max-w-[46ch] text-[15px] leading-[1.8] text-forest/75">
							{#if form && 'name' in form && form.name}
								Thank you, {form.name}.
							{/if}
							We will reply to
							<span class="text-forest">{form && 'email' in form ? form.email : ''}</span>
							— usually within two working days, and always from {SUPPORT_EMAIL}. If it is urgent,
							the Instagram DM is faster.
						</p>
						<div class="mt-8 flex flex-wrap gap-4">
							<Button surface="light" variant="outline" href="/contact" onclick={startAgain}>
								Write another
							</Button>
							<Button surface="light" variant="quiet" href="/policies">Read the policies</Button>
						</div>
					</section>
				{:else}
					<form
						class="relative mt-14 flex flex-col gap-10"
						method="POST"
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
							<div class="border-l-2 px-6 py-5 {ERROR_RULE}" role="alert" tabindex="-1">
								<p class="text-[10px] tracking-[0.2em] uppercase {ERROR_ACCENT}">
									{failure ? 'Not sent' : 'Check these first'}
								</p>
								{#if failure}
									<p class="mt-3 text-[14px] leading-[1.75] text-forest/80">{failure}</p>
								{:else}
									<ul class="mt-3 flex flex-col gap-1.5 text-[14px] leading-[1.6] text-forest/80">
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
						<div class="absolute top-0 left-[-9999px] h-px w-px overflow-hidden" aria-hidden="true">
							<label for="contact-website">Website</label>
							<input
								id="contact-website"
								name="website"
								type="text"
								tabindex="-1"
								autocomplete="off"
							/>
						</div>

						<div class="grid gap-10 sm:grid-cols-2">
							<Field
								label="Your name"
								name="name"
								bind:value={name}
								required
								autocomplete="name"
								placeholder="Aarti Menon"
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
								placeholder="you@example.com"
								hint="The address we will reply to."
								error={errors?.email ?? ''}
								surface="light"
							/>
						</div>

						<Field
							label="Subject"
							name="subject"
							bind:value={subject}
							required
							options={data.subjects}
							hint="This decides who picks it up."
							error={errors?.subject ?? ''}
							surface="light"
						/>

						<Field
							label="Message"
							name="message"
							bind:value={message}
							required
							rows={8}
							placeholder="Order number first, if you have one."
							hint="For a damaged piece, attach photographs by email instead — this form takes text only."
							error={errors?.message ?? ''}
							surface="light"
						/>

						<div class="flex flex-wrap items-center gap-6">
							<Button type="submit" variant="solid" surface="light" disabled={submitting}>
								{submitting ? 'Sending…' : 'Send it'}
							</Button>
							<p class="text-[11px] leading-relaxed text-forest/50">
								We use what you write here only to answer you. Nothing else.
							</p>
						</div>
					</form>
				{/if}
			</div>

			<!--
				§11: email and Instagram DM both appear here, read from
				$lib/content/business so the footer and this page cannot drift.
			-->
			<aside class="lg:sticky lg:top-28 lg:self-start">
				<div class="border-t border-forest/15 pt-8">
					<p class="text-[10px] tracking-[0.2em] text-forest/55 uppercase">Direct</p>
					<ul class="mt-5 flex flex-col gap-4 text-[14px]">
						<li>
							<a
								class="text-forest underline decoration-gold decoration-1 underline-offset-[5px] transition hover:decoration-forest"
								href="mailto:{SUPPORT_EMAIL}">{SUPPORT_EMAIL}</a
							>
							<span class="mt-1 block text-[12px] leading-relaxed text-forest/55">
								Best for anything with an order number or a photograph attached.
							</span>
						</li>
						<li>
							<a
								class="text-forest underline decoration-gold decoration-1 underline-offset-[5px] transition hover:decoration-forest"
								href={INSTAGRAM_URL}
								rel="noreferrer noopener">{INSTAGRAM_HANDLE} — DM</a
							>
							<span class="mt-1 block text-[12px] leading-relaxed text-forest/55">
								Fastest for a quick question about a drop or a size.
							</span>
						</li>
					</ul>
				</div>

				<div class="mt-10 border-t border-forest/15 pt-8">
					<p class="text-[10px] tracking-[0.2em] text-forest/55 uppercase">Before you write</p>
					<ul class="mt-5 flex flex-col gap-3 text-[13px] leading-relaxed">
						<li>
							<a class="text-forest/70 transition hover:text-forest" href="/policies/track-order">
								Tracking an order →
							</a>
						</li>
						<li>
							<a class="text-forest/70 transition hover:text-forest" href="/policies/size-guide">
								Choosing a size →
							</a>
						</li>
						<li>
							<a class="text-forest/70 transition hover:text-forest" href="/policies/returns">
								{RETURNS_SHORT} →
							</a>
						</li>
						<li>
							<a class="text-forest/70 transition hover:text-forest" href="/policies/faq">
								The questions we are asked most →
							</a>
						</li>
					</ul>
				</div>

				<div class="mt-10 border-t border-forest/15 pt-8">
					<p class="text-[10px] tracking-[0.2em] text-forest/55 uppercase">{BUSINESS_NAME}</p>
					<address
						class="mt-4 text-[13px] leading-relaxed not-italic {isPlaceholder(BUSINESS_ADDRESS)
							? OUTSTANDING_ACCENT
							: 'text-forest/70'}"
					>
						{displayValue(BUSINESS_ADDRESS)}
					</address>
					<p class="mt-4 text-[12px] leading-relaxed text-forest/55">
						Post reaches us, but slowly. Email or DM is quicker for anything about an order.
					</p>
				</div>
			</aside>
		</div>
	</div>
</main>
