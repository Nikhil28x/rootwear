import type { PageServerLoad } from './$types';
import { drops } from '$lib/server/drops';

/** RW-026 — §03 template 03: the drop archive. "The proof-of-history page." */
export const load: PageServerLoad = async () => {
	// §06: nothing is ever deleted; every drop released stays listed.
	return { archive: await drops.listDrops() };
};
