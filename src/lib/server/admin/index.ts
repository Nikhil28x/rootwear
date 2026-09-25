/**
 * RW-147 — The one place the admin data source is chosen.
 *
 * Same switch as src/lib/server/drops/index.ts, on the same environment
 * variable, so the catalogue and the admin area can never end up reading from
 * two different worlds. CATALOGUE_SOURCE=supabase reads Postgres; anything
 * else (the default) reads the fixtures, which is what lets the whole admin
 * area run with no database configured.
 *
 * Resolved per call rather than at import, so flipping the variable in dev
 * takes effect without a restart.
 */
import type { AdminRepository } from './repository';
import { mockAdminRepository } from './mock-repository';
import { supabaseAdminRepository } from './supabase-repository';
import { catalogueSource, isSupabaseConfigured } from '$lib/server/env';

function select(): AdminRepository {
	if (catalogueSource() === 'supabase') {
		if (!isSupabaseConfigured()) {
			throw new Error(
				'CATALOGUE_SOURCE=supabase but PUBLIC_SUPABASE_URL / ' +
					'PUBLIC_SUPABASE_ANON_KEY are not set. See .env.example.'
			);
		}
		return supabaseAdminRepository;
	}
	return mockAdminRepository;
}

export const adminRepo: AdminRepository = {
	listDropPerformance: (now) => select().listDropPerformance(now),
	preOrderLedger: (now) => select().preOrderLedger(now),
	revenueByDrop: () => select().revenueByDrop(),
	listDemandRows: () => select().listDemandRows(),
	listDemandEntries: (filter) => select().listDemandEntries(filter),
	listDropRows: () => select().listDropRows(),
	findDropRow: (slug) => select().findDropRow(slug),
	setDropState: (input) => select().setDropState(input),
	setDropPublished: (input) => select().setDropPublished(input),
	setDropLaunchInstant: (input) => select().setDropLaunchInstant(input),
	setVariantStock: (input) => select().setVariantStock(input),
	listOrders: (filter) => select().listOrders(filter),
	findOrder: (id) => select().findOrder(id),
	updateFulfilment: (input) => select().updateFulfilment(input),
	packingList: (limit) => select().packingList(limit),
	listReservations: (filter) => select().listReservations(filter),
	findReservation: (id) => select().findReservation(id),
	markBalanceRequested: (input) => select().markBalanceRequested(input),
	listContact: (filter) => select().listContact(filter),
	setContactStatus: (input) => select().setContactStatus(input)
};

export type { AdminRepository };
export * from './types';
