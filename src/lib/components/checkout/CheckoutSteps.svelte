<script lang="ts">
	/**
	 * Where the visitor is in the checkout: Cart → Checkout → Payment.
	 * Steps already done link back while the order is still being built; once
	 * it is placed (Pay) nothing links back.
	 */
	type Step = 'cart' | 'checkout' | 'pay';

	let { current }: { current: Step } = $props();

	const STEPS: Array<{ id: Step; label: string; href: string | null }> = [
		{ id: 'cart', label: 'Cart', href: '/cart' },
		{ id: 'checkout', label: 'Checkout', href: '/checkout/information' },
		{ id: 'pay', label: 'Payment', href: null }
	];

	let index = $derived(STEPS.findIndex((step) => step.id === current));
</script>

<nav class="steps" aria-label="Checkout steps">
	<ol>
		{#each STEPS as step, i (step.id)}
			<li class:done={i < index} class:now={i === index}>
				<!-- Back to a done step, or on to checkout from the cart. -->
				{#if step.href && current !== 'pay' && (i < index || (current === 'cart' && i === index + 1))}
					<a href={step.href}>{step.label}</a>
				{:else}
					<span aria-current={i === index ? 'step' : undefined}>{step.label}</span>
				{/if}
			</li>
		{/each}
	</ol>
</nav>

<style>
	.steps ol {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 0;
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: 13px;
	}
	.steps li {
		display: flex;
		align-items: center;
		color: rgb(11 15 11 / 0.4);
	}
	.steps li + li::before {
		content: '';
		width: 18px;
		height: 1px;
		margin: 0 10px;
		background: rgb(11 15 11 / 0.22);
	}
	.steps li.done {
		color: rgb(11 15 11 / 0.62);
	}
	.steps li.now {
		color: var(--color-forest-black);
	}
	.steps a,
	.steps span {
		display: inline-flex;
		align-items: center;
		min-height: 32px;
	}
	.steps a {
		color: inherit;
		text-decoration: underline;
		text-decoration-color: rgb(11 15 11 / 0.25);
		text-underline-offset: 4px;
	}
	.steps a:hover {
		color: var(--color-forest-black);
		text-decoration-color: currentColor;
	}
	.steps .now span {
		text-decoration: underline;
		text-decoration-thickness: 1px;
		text-underline-offset: 6px;
	}
	@media (max-width: 380px) {
		.steps li + li::before {
			width: 10px;
			margin: 0 7px;
		}
	}
</style>
