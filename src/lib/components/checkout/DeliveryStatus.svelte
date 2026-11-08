<script lang="ts">
	/**
	 * Where the order is: one plain sentence ("arriving in about 2 days"), the
	 * delivery facts, a four-step progress line, and the courier's tracking.
	 */
	import type { DeliveryOutlook } from '$lib/checkout/delivery';

	let {
		outlook,
		courierName,
		trackingRef
	}: { outlook: DeliveryOutlook; courierName: string | null; trackingRef: string | null } = $props();

	const stepDate = new Intl.DateTimeFormat('en-IN', {
		day: 'numeric',
		month: 'short',
		timeZone: 'Asia/Kolkata'
	});
	let current = $derived(outlook.steps.filter((step) => step.done).length);
</script>

<section class="dlv" aria-labelledby="dlv-head">
	<h2 id="dlv-head" class="dlv__headline">{outlook.headline}</h2>
	{#if outlook.notes.length}
		<ul class="dlv__notes">
			{#each outlook.notes as note (note)}<li>{note}</li>{/each}
		</ul>
	{/if}

	<ol class="dlv__steps" aria-label="Order progress">
		{#each outlook.steps as step, index (step.key)}
			<li
				class="dlv__step"
				class:dlv__step--done={step.done}
				class:dlv__step--next={index === current}
				aria-current={index === current - 1 ? 'step' : undefined}
			>
				<span class="dlv__dot" aria-hidden="true"></span>
				<span class="dlv__label">{step.label}</span>
				{#if step.done && step.at}<span class="dlv__at">{stepDate.format(step.at)}</span>{/if}
			</li>
		{/each}
	</ol>

	{#if trackingRef}
		<p class="dlv__track">
			{courierName ?? 'Courier'} · <span class="dlv__ref">{trackingRef}</span>
			{#if outlook.trackingHref}
				· <a class="dlv__link" href={outlook.trackingHref} target="_blank" rel="noopener noreferrer"
					>Track the parcel</a
				>
			{/if}
		</p>
	{/if}
</section>

<style>
	.dlv {
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: 20px 22px;
		border: 1px solid rgb(20 20 20 / 0.12);
		background: #f6f1e7;
		color: #141414;
	}
	.dlv__headline {
		margin: 0;
		font-family: var(--font-display);
		font-weight: 400;
		font-size: clamp(1.3rem, 2.4vw, 1.7rem);
		line-height: 1.2;
	}
	.dlv__notes {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 18px;
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: 14px;
		color: rgb(20 20 20 / 0.72);
	}
	.dlv__steps {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		margin: 6px 0 0;
		padding: 0;
		list-style: none;
	}
	.dlv__step {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding-top: 18px;
		font-size: 13px;
		color: rgb(20 20 20 / 0.45);
	}
	/* The line between dots: dark where the order has been. */
	.dlv__step::before {
		content: '';
		position: absolute;
		top: 5px;
		left: 0;
		right: 0;
		height: 2px;
		background: rgb(20 20 20 / 0.14);
	}
	.dlv__step--done::before {
		background: #141414;
	}
	.dlv__step:first-child::before {
		left: 6px;
	}
	.dlv__step:last-child::before {
		right: auto;
		width: 6px;
	}
	.dlv__dot {
		position: absolute;
		top: 0;
		left: 0;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		border: 2px solid rgb(20 20 20 / 0.25);
		background: #f6f1e7;
	}
	.dlv__step--done {
		color: #141414;
	}
	.dlv__step--done .dlv__dot {
		border-color: #141414;
		background: #141414;
	}
	.dlv__step--next .dlv__dot {
		border-color: #141414;
		animation: dlv-pulse 1.8s ease-in-out infinite;
	}
	@keyframes dlv-pulse {
		50% {
			box-shadow: 0 0 0 5px rgb(20 20 20 / 0.12);
		}
	}
	.dlv__label {
		font-weight: 500;
	}
	.dlv__at {
		font-size: 12px;
		color: rgb(20 20 20 / 0.6);
	}
	.dlv__track {
		margin: 0;
		font-size: 14px;
	}
	.dlv__ref {
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.02em;
	}
	.dlv__link {
		color: inherit;
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	@media (prefers-reduced-motion: reduce) {
		.dlv__step--next .dlv__dot {
			animation: none;
		}
	}
</style>
