<script lang="ts">
	/**
	 * Track an order. Order number + the email or phone it was placed with →
	 * the order's own page (status, delivery estimate, tracking).
	 */
	import { enhance } from '$app/forms';
	import { SUPPORT_EMAIL } from '$lib/content/business';

	let { form } = $props();
	let busy = $state(false);
</script>

<svelte:head>
	<title>Track an order — Rootwear</title>
	<meta name="description" content="Check where your Rootwear order is with your order number." />
</svelte:head>

<main class="track">
	<div class="track__inner">
		<h1 class="track__title">Track an order</h1>
		<p class="track__lede">
			Enter the order number from your confirmation email, and the email or phone you ordered
			with.
		</p>

		<form
			method="POST"
			class="track__form"
			use:enhance={() => {
				busy = true;
				return async ({ update }) => {
					await update({ reset: false });
					busy = false;
				};
			}}
		>
			<label class="track__field">
				<span>Order number</span>
				<input
					name="order"
					required
					autocomplete="off"
					autocapitalize="characters"
					spellcheck="false"
					placeholder="RW261108-ABCDE"
					maxlength="40"
					value={form?.orderNumber ?? ''}
				/>
			</label>
			<label class="track__field">
				<span>Email or phone</span>
				<input
					name="contact"
					required
					autocomplete="email"
					placeholder="you@example.com or 98765 43210"
					maxlength="254"
					value={form?.contact ?? ''}
				/>
			</label>

			{#if form?.error}<p class="track__error" role="alert">{form.error}</p>{/if}

			<button type="submit" class="track__submit" disabled={busy}>
				{busy ? 'Finding your order…' : 'Find my order'}
			</button>
		</form>

		<p class="track__help">
			Can't find your order number? Write to
			<a href="mailto:{SUPPORT_EMAIL}">{SUPPORT_EMAIL}</a> and we'll look it up for you.
		</p>
	</div>
</main>

<style>
	.track {
		min-height: 70svh;
		padding: clamp(48px, 9vw, 120px) clamp(20px, 4vw, 56px);
		background: #ffffff;
		color: #141414;
	}
	.track__inner {
		display: flex;
		flex-direction: column;
		gap: 22px;
		max-width: 520px;
		margin: 0 auto;
	}
	.track__title {
		margin: 0;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: clamp(2.4rem, 6vw, 3.6rem);
		line-height: 1;
		letter-spacing: -0.02em;
	}
	.track__lede,
	.track__help {
		margin: 0;
		font-size: 15px;
		line-height: 1.5;
		color: rgb(20 20 20 / 0.7);
	}
	.track__help a {
		color: inherit;
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.track__form {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 24px;
		background: #f6f1e7;
		border: 1px solid rgb(20 20 20 / 0.1);
	}
	.track__field {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 13px;
		color: rgb(20 20 20 / 0.75);
	}
	.track__field input {
		font: inherit;
		font-size: 16px;
		padding: 12px 14px;
		border: 1px solid rgb(20 20 20 / 0.22);
		background: #ffffff;
		color: #141414;
	}
	.track__field input:focus-visible {
		outline: 2px solid #141414;
		outline-offset: 1px;
	}
	.track__error {
		margin: 0;
		font-size: 14px;
		color: #8a2c1c;
	}
	.track__submit {
		font: inherit;
		font-size: 13px;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		padding: 15px 18px;
		border: 0;
		background: #141414;
		color: #f3efe6;
		cursor: pointer;
	}
	.track__submit:disabled {
		opacity: 0.6;
		cursor: progress;
	}
</style>
