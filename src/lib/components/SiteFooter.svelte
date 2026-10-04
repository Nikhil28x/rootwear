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
	 * One footer for the whole site: the wordmark, contact, the links and the
	 * registered address.
	 *
	 * §14 requires the registered business name and address here; §11 requires
	 * email and Instagram DM. Both read from one module (RW-022).
	 */
	let { policies = [] }: { policies?: Array<{ slug: string; title: string }> } = $props();
</script>

<footer id="footer" class="brand-footer" data-header-theme="dark">

	<div class="foot">
		<div class="foot__brand">
			<a class="foot__mark wordmark" href="/" aria-label="Rootwear home"
				>ROOTWEAR<sup aria-hidden="true">TM</sup></a
			>
			<p class="foot__about">Clothing grown from hemp, cut in small numbered runs.</p>
			<div class="foot__reach">
				<a href="mailto:{SUPPORT_EMAIL}">{SUPPORT_EMAIL}</a>
				<a href={INSTAGRAM_URL} rel="noreferrer noopener">Instagram {INSTAGRAM_HANDLE}</a>
			</div>
		</div>

		<nav class="foot__links" aria-label="Footer">
			<div>
				<p class="foot__head">Shop</p>
				<ul>
					<li><a href="/drops">The drop</a></li>
					<li><a href="/know-your-roots">Our roots</a></li>
					<li><a href="/impact">Impact</a></li>
					<li><a href="/account">Account</a></li>
				</ul>
			</div>
			<div>
				<p class="foot__head">Help</p>
				<ul>
					<li><a href="/contact">Contact</a></li>
					<li><a href="/policies/track-order">Track your order</a></li>
					{#each policies.filter( (policy) => ['shipping', 'returns', 'size-guide', 'faq'].includes(policy.slug) ) as policy (policy.slug)}
						<li><a href="/policies/{policy.slug}">{policy.title}</a></li>
					{/each}
				</ul>
			</div>
			<div>
				<p class="foot__head">Information</p>
				<ul>
					{#each policies.filter((policy) => !['shipping', 'returns', 'size-guide', 'faq', 'track-order'].includes(policy.slug)) as policy (policy.slug)}
						<li><a href="/policies/{policy.slug}">{policy.title}</a></li>
					{/each}
				</ul>
			</div>
		</nav>

		<div class="foot__studio">
			<p class="foot__head">{BUSINESS_NAME}</p>
			<address class:is-placeholder={isPlaceholder(BUSINESS_ADDRESS)}>
				{displayValue(BUSINESS_ADDRESS)}
			</address>
			{#if GST_POSITION.registered}
				<p>GSTIN {GST_POSITION.gstin}</p>
			{/if}
			<p>Ships within India.</p>
		</div>
	</div>

	<div class="foot__legal">
		<span>© {new Date().getFullYear()} {BUSINESS_NAME}</span>
		<a
			href="#top"
			onclick={(event) => {
				event.preventDefault();
				window.scrollTo({ top: 0, behavior: 'smooth' });
			}}>Back to top ↑</a
		>
	</div>
</footer>

<style>
	.foot {
		--cream: #f3efe6;
		--muted: rgb(243 239 230 / 0.66);
		--line: rgb(243 239 230 / 0.14);
		--gutter: clamp(20px, 4vw, 56px);
		display: grid;
		grid-template-columns: minmax(0, 1.2fr) minmax(0, 2fr) minmax(0, 1fr);
		gap: clamp(32px, 5vw, 80px);
		padding: clamp(56px, 7vw, 96px) var(--gutter);
		color: var(--cream);
	}
	.foot__brand {
		display: flex;
		flex-direction: column;
		gap: 18px;
	}
	.foot__mark {
		font-size: clamp(1.6rem, 2.4vw, 2.2rem);
		letter-spacing: 0.22em;
	}
	.foot__mark sup {
		margin-left: 3px;
		font-size: 0.32em;
		letter-spacing: 0.06em;
		vertical-align: 1.4em;
	}
	.foot__about {
		max-width: 30ch;
		font-family: var(--font-display);
		font-size: 18px;
		line-height: 1.4;
		color: rgb(243 239 230 / 0.82);
	}
	.foot__reach {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 8px;
		font-size: 14px;
	}
	.foot__reach a {
		text-decoration: underline;
		text-decoration-color: rgb(243 239 230 / 0.35);
		text-underline-offset: 4px;
		transition: text-decoration-color 0.2s;
	}
	.foot__reach a:hover {
		text-decoration-color: currentColor;
	}
	.foot__links {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 24px;
	}
	.foot__head {
		margin-bottom: 16px;
		padding-bottom: 10px;
		border-bottom: 1px solid var(--line);
		font-size: 13px;
		color: var(--color-gold);
	}
	.foot ul {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.foot ul a {
		font-size: 15px;
		color: var(--muted);
		transition: color 0.2s;
	}
	.foot ul a:hover {
		color: var(--cream);
	}
	.foot__studio {
		display: flex;
		flex-direction: column;
		gap: 10px;
		font-size: 14px;
		line-height: 1.6;
		color: var(--muted);
	}
	.foot__studio .foot__head {
		margin-bottom: 6px;
	}
	.foot__studio address {
		font-style: normal;
	}
	.foot__studio .is-placeholder {
		color: var(--color-alert-light);
	}
	.foot__legal {
		--gutter: clamp(20px, 4vw, 56px);
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 12px;
		padding: 18px var(--gutter) calc(20px + env(safe-area-inset-bottom, 0px));
		border-top: 1px solid rgb(243 239 230 / 0.12);
		font-size: 12px;
		color: rgb(243 239 230 / 0.6);
	}
	.foot__legal a:hover {
		color: #f3efe6;
	}

	@media (max-width: 960px) {
		.foot {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		}
		.foot__links {
			grid-column: 1 / -1;
			grid-row: 2;
		}
	}
	@media (max-width: 560px) {
		.foot {
			grid-template-columns: minmax(0, 1fr);
		}
		.foot__links {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			row-gap: 36px;
			grid-row: auto;
		}
	}
</style>
