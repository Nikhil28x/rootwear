<script lang="ts">
	/**
	 * §03 templates 03 and 04 — the drop, at the URL that survives its whole
	 * life (§05). It renders the drop's lead piece as the product experience.
	 */
	import ProductExperience from '$lib/components/product/ProductExperience.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<ProductExperience {data} {form} />
