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
	 * One footer for the whole site — the landing page's artwork lockup, which
	 * previously existed only there while every other route got a plain link
	 * list.
	 *
	 * It is deliberately turned DOWN: the artwork is dimmed and desaturated and
	 * the ground is a grey-green rather than the full brand forest, so the
	 * footer settles behind the page instead of competing with it. See
	 * .brand-footer in layout.css.
	 *
	 * §14 requires the registered business name and address here; §11 requires
	 * email and Instagram DM. Both read from one module (RW-022).
	 */
	let { policies = [] }: { policies?: Array<{ slug: string; title: string }> } = $props();
</script>

<footer id="footer" class="brand-footer">
	<figure class="brand-footer__artwork">
		<img
			src="/images/rootwear-brand-story.jpg"
			alt="Rootwear's illustrated tree manifesto: before we build, we listen; built from the ground up"
			loading="lazy"
		/>
		<figcaption class="brand-footer__desktop-tagline">Established in Process</figcaption>
	</figure>

	<div class="brand-footer__mobile-lockup" aria-hidden="true">
		<p>ROOTWEAR</p>
		<span>Established in Process</span>
		<small>Built from the ground up.</small>
	</div>

	<div class="brand-footer__grid">
		<div class="brand-footer__col">
			<p class="brand-footer__head">Information</p>
			<ul>
				{#each policies as policy (policy.slug)}
					<li><a href="/policies/{policy.slug}">{policy.title}</a></li>
				{/each}
			</ul>
		</div>

		<div class="brand-footer__col">
			<p class="brand-footer__head">Support</p>
			<ul>
				<li><a href="mailto:{SUPPORT_EMAIL}">{SUPPORT_EMAIL}</a></li>
				<li><a href={INSTAGRAM_URL} rel="noreferrer noopener">{INSTAGRAM_HANDLE}</a></li>
				<li><a href="/policies/track-order">Track your order</a></li>
				<li><a href="/contact">Contact</a></li>
			</ul>
		</div>

		<div class="brand-footer__col">
			<p class="brand-footer__head">Explore</p>
			<ul>
				<li><a href="/know-your-roots">Know your roots</a></li>
				<li><a href="/drops">The Drop</a></li>
				<li><a href="/impact">Impact</a></li>
			</ul>
		</div>

		<div class="brand-footer__col">
			<p class="brand-footer__head">{BUSINESS_NAME}</p>
			<address class:is-placeholder={isPlaceholder(BUSINESS_ADDRESS)}>
				{displayValue(BUSINESS_ADDRESS)}
			</address>
			{#if GST_POSITION.registered}
				<p>GSTIN {GST_POSITION.gstin}</p>
			{/if}
		</div>
	</div>

	<div class="brand-footer__legal">
		<span>© {new Date().getFullYear()} {BUSINESS_NAME} · Established in Process</span>
		<span>Ships within India</span>
	</div>
</footer>
