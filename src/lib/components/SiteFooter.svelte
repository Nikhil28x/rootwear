<script lang="ts">
	import {
		BUSINESS_NAME,
		SUPPORT_EMAIL,
		INSTAGRAM_HANDLE,
		INSTAGRAM_URL,
		BUSINESS_ADDRESS,
		GST_POSITION,
		displayValue,
		isPlaceholder
	} from '$lib/content/business';

	/**
	 * §14 requires the registered business name and address in the footer.
	 * §11 requires email and Instagram DM to appear here as well as on the
	 * contact page and in every transactional email. All read from one module
	 * so a correction is a one-line change (RW-022).
	 */
	let { policies = [] }: { policies?: Array<{ slug: string; title: string }> } = $props();
</script>

<footer class="border-t border-white/10 bg-forest-black px-5 py-16 text-stone-400 sm:px-10 lg:px-14">
	<div class="mx-auto flex max-w-[1600px] flex-col gap-12">
		<div class="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
			<div class="flex flex-col gap-3">
				<p class="wordmark text-base tracking-[0.2em] text-stone-100 uppercase">Rootwear</p>
				<p class="text-[13px] leading-relaxed">Established in Process.<br />Built from the ground up.</p>
			</div>

			<div class="flex flex-col gap-3">
				<p class="text-[11px] tracking-[0.22em] text-stone-400 uppercase font-medium">Information</p>
				<ul class="flex flex-col gap-2 text-[13px]">
					{#each policies as policy (policy.slug)}
						<li><a class="transition hover:text-stone-100" href="/policies/{policy.slug}">{policy.title}</a></li>
					{/each}
				</ul>
			</div>

			<div class="flex flex-col gap-3">
				<p class="text-[11px] tracking-[0.22em] text-stone-400 uppercase font-medium">Support</p>
				<ul class="flex flex-col gap-2 text-[13px]">
					<li><a class="transition hover:text-stone-100" href="mailto:{SUPPORT_EMAIL}">{SUPPORT_EMAIL}</a></li>
					<li>
						<a class="transition hover:text-stone-100" href={INSTAGRAM_URL} rel="noreferrer noopener"
							>{INSTAGRAM_HANDLE}</a
						>
					</li>
					<li><a class="transition hover:text-stone-100" href="/policies/track-order">Track your order</a></li>
					<li><a class="transition hover:text-stone-100" href="/contact">Contact</a></li>
				</ul>
			</div>

			<div class="flex flex-col gap-3">
				<p class="text-[11px] tracking-[0.22em] text-stone-400 uppercase font-medium">{BUSINESS_NAME}</p>
				<address
					class="text-[13px] leading-relaxed not-italic {isPlaceholder(BUSINESS_ADDRESS)
						? 'text-alert-light'
						: ''}"
				>
					{displayValue(BUSINESS_ADDRESS)}
				</address>
				{#if GST_POSITION.registered}
					<p class="text-[13px]">GSTIN {GST_POSITION.gstin}</p>
				{/if}
			</div>
		</div>

		<div
			class="flex flex-col gap-3 border-t border-white/10 pt-7 text-[11px] tracking-[0.16em] uppercase sm:flex-row sm:items-center sm:justify-between font-medium"
		>
			<span>© {new Date().getFullYear()} {BUSINESS_NAME} · Established in Process</span>
			<span>Ships within India</span>
		</div>
	</div>
</footer>
