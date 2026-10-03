<script module lang="ts">
	/**
	 * Razorpay's hosted checkout script, loaded once per page and only when a
	 * payment is actually about to be taken. A failed load clears the cache so
	 * the next click retries instead of replaying the failure.
	 */
	const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';
	let loader: Promise<void> | null = null;

	function loadCheckout(): Promise<void> {
		loader ??= new Promise<void>((resolve, reject) => {
			const script = document.createElement('script');
			script.src = CHECKOUT_SRC;
			script.async = true;
			script.onload = () => resolve();
			script.onerror = () => {
				loader = null;
				script.remove();
				reject(new Error('checkout.js failed to load'));
			};
			document.head.append(script);
		});
		return loader;
	}

	type RazorpaySuccess = {
		razorpay_payment_id: string;
		razorpay_order_id: string;
		razorpay_signature: string;
	};

	type RazorpayInstance = {
		open(): void;
		on(event: 'payment.failed', handler: (response: { error?: { description?: string } }) => void): void;
	};

	declare global {
		interface Window {
			Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
		}
	}
</script>

<script lang="ts">
	/**
	 * RW-096 — the browser handoff to Razorpay Checkout.
	 *
	 * This component only OPENS the payment. It never decides the payment
	 * succeeded: §04 makes the webhook the source of truth, so `onPaid` merely
	 * tells the page to keep polling with a calmer message. The amount and the
	 * order id both come from the gateway order the server created — nothing
	 * here is a figure the browser chose.
	 */
	import { onMount } from 'svelte';
	import { deserialize } from '$app/forms';
	import Button from '$lib/components/ui/Button.svelte';
	import { formatInr, type Paise } from '$lib/money';
	import { BUSINESS_NAME, SUPPORT_EMAIL } from '$lib/content/business';

	let {
		keyId,
		gatewayOrderId,
		amount,
		description,
		email,
		name = undefined,
		contact = undefined,
		label,
		autoOpen = false,
		verifyAction,
		fields = {},
		onPaid
	}: {
		keyId: string;
		gatewayOrderId: string;
		amount: Paise;
		description: string;
		email: string;
		name?: string;
		/** A 10-digit Indian mobile; Razorpay asks for one if it is missing. */
		contact?: string;
		label?: string;
		/** Open the modal as soon as the page mounts, for a customer who just clicked pay. */
		autoOpen?: boolean;
		/** The page's form action that checks razorpay_signature, e.g. '?/verifyPayment'. */
		verifyAction: string;
		/** Extra fields that action needs, such as the order's public token. */
		fields?: Record<string, string>;
		onPaid?: () => void;
	} = $props();

	let busy = $state(false);
	let problem = $state('');

	/**
	 * Hands the modal's three fields to the server, which checks the HMAC with
	 * the KEY SECRET. A failed check says so; it does not undo a payment the
	 * gateway took, so the webhook still settles a genuine one.
	 */
	async function verify(response: RazorpaySuccess) {
		const body = new FormData();
		for (const [name, value] of Object.entries({ ...fields, ...response })) body.set(name, value);

		try {
			const result = deserialize(
				await (
					await fetch(verifyAction, {
						method: 'POST',
						body,
						headers: { 'x-sveltekit-action': 'true' }
					})
				).text()
			);
			if (result.type === 'success') {
				onPaid?.();
				return;
			}
			problem =
				result.type === 'failure' && typeof result.data?.problem === 'string'
					? result.data.problem
					: "We couldn't confirm your payment.";
		} catch {
			problem = "We couldn't confirm your payment.";
		}
		problem += ` Need help? Email ${SUPPORT_EMAIL}.`;
	}

	async function open() {
		problem = '';
		busy = true;
		try {
			await loadCheckout();
			if (!window.Razorpay) throw new Error('Razorpay global missing');

			const checkout = new window.Razorpay({
				key: keyId,
				order_id: gatewayOrderId,
				amount,
				currency: 'INR',
				name: BUSINESS_NAME,
				description,
				prefill: { email, name, contact: contact ? `+91${contact}` : undefined },
				theme: { color: '#1f382a' },
				handler: async (response: RazorpaySuccess) => {
					await verify(response);
					busy = false;
				},
				modal: {
					ondismiss: () => {
						busy = false;
					}
				}
			});

			checkout.on('payment.failed', (response) => {
				// Razorpay keeps the modal open for a retry; this is the message
				// left behind if the customer closes it after the failure.
				problem =
					response.error?.description ??
					"Your payment didn't go through. You haven't been charged.";
			});

			checkout.open();
		} catch (cause) {
			console.error('[checkout] could not open Razorpay', cause);
			busy = false;
			problem =
				"We couldn't open the payment window. Check your connection and try again.";
		}
	}

	onMount(() => {
		if (autoOpen) void open();
	});
</script>

<div class="mt-6">
	<Button surface="light" variant="solid" type="button" disabled={busy} onclick={open}>
		{label ?? `Pay ${formatInr(amount)}`}
	</Button>

	{#if problem}
		<p
			role="alert"
			class="mt-4 border-l-2 border-alert bg-alert/[0.06] px-6 py-5 text-[15px] leading-relaxed text-alert"
		>
			{problem}
		</p>
	{/if}
</div>
