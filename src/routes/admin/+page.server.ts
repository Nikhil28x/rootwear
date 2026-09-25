import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { adminRepo } from '$lib/server/admin';
import { requireSection } from '$lib/server/admin/roles';
import { resolveAdminAuth } from '$lib/server/admin/session';
import { isOnSale } from '$lib/domain/drop-state';

/**
 * RW-153 — §12 "REPORTS THAT ACTUALLY MATTER".
 *
 * Four reports, in the order they are used:
 *   1. Drop performance — reserved, sold and remaining BY SIZE, and the curve
 *      against time from launch. "The number that decides how big Drop 02 is
 *      cut."
 *   2. Pre-order ledger — deposits taken, balances outstanding and overdue,
 *      refunds issued.
 *   3. Demand board — notify-me, waitlist and drop-request counts by size.
 *   4. Revenue by drop, with the deposit-vs-balance split kept visible.
 *
 * The role check runs HERE as well as in +layout.server.ts. Two independent
 * refusals, because §12's split is a commitment to a person, not a nav filter.
 */
export const load: PageServerLoad = async (event) => {
	const auth = await resolveAdminAuth(event);
	if (auth.status !== 'staff') error(403, 'Staff access required.');
	requireSection(auth.actor, 'dashboard');

	const now = event.locals.now;

	const [performance, ledger, demandRows, revenue] = await Promise.all([
		adminRepo.listDropPerformance(now),
		adminRepo.preOrderLedger(now),
		adminRepo.listDemandRows(),
		adminRepo.revenueByDrop()
	]);

	/**
	 * §06 / RW-043 — "one live drop at a time". The data model deliberately
	 * permits two, because the storefront must be able to resolve a re-drop
	 * while a new drop teases. The storefront assumes one. So admin WARNS
	 * rather than forbidding: a second live drop is a decision, not a bug, and
	 * whoever made it should see that they made it.
	 */
	const live = performance.filter((drop) => isOnSale(drop.state));

	return {
		now,
		performance,
		ledger,
		demandRows,
		revenue,
		liveWarning:
			live.length > 1
				? live.map((drop) => `Drop ${String(drop.number).padStart(2, '0')} ${drop.name}`)
				: null
	};
};
