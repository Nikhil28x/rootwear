/**
 * RW-047 — The one place the demand data source is chosen.
 *
 * Same switch as src/lib/server/drops/index.ts, and deliberately the same
 * environment variable: the catalogue and the demand signals against it must
 * never come from two different worlds, or a request would be recorded against
 * a variant id the storefront has never heard of.
 */
import type { DemandRepository } from './repository';
import { mockDemandRepository } from './mock-repository';
import { supabaseDemandRepository } from './supabase-repository';
import { catalogueSource, isSupabaseConfigured } from '$lib/server/env';

function selectRepository(): DemandRepository {
	if (catalogueSource() === 'supabase') {
		if (!isSupabaseConfigured()) {
			throw new Error(
				'CATALOGUE_SOURCE=supabase but PUBLIC_SUPABASE_URL / ' +
					'PUBLIC_SUPABASE_ANON_KEY are not set. See .env.example.'
			);
		}
		return supabaseDemandRepository;
	}
	return mockDemandRepository;
}

/** Resolved per call so the switch works without a restart in dev. */
export const demand: DemandRepository = {
	requestDrop: (input) => selectRepository().requestDrop(input),
	notifyMe: (input) => selectRepository().notifyMe(input),
	demandForDrop: (dropId) => selectRepository().demandForDrop(dropId)
};

export type { DemandRepository };
export * from './types';
