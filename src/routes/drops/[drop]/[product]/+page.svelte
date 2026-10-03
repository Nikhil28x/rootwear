<script lang="ts">
	/**
	 * §03 template 05 — a piece within its drop, as the product experience.
	 * The same component as the drop URL; see ProductExperience.svelte.
	 */
	import ProductExperience from '$lib/components/product/ProductExperience.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<ProductExperience {data} {form} />
