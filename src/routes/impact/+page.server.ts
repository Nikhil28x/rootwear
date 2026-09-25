import type { PageServerLoad } from './$types';
import { IMPACT_DETAILS, LINEAGE } from '$lib/content/impact';

/**
 * The long form of the four figures the landing page shows as cards.
 *
 * Copy comes through a load rather than being imported into the component, so
 * it can move to the content tables later without touching the markup — the
 * same shape /know-your-roots uses.
 */
export const load: PageServerLoad = async () => {
	return { details: IMPACT_DETAILS, lineage: LINEAGE };
};
