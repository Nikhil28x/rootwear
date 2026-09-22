/**
 * RW-046 — The one place the catalogue data source is chosen.
 *
 * CATALOGUE_SOURCE=supabase reads from Postgres; anything else (the default)
 * uses the in-repo fixtures, so the app runs with no database configured.
 * No route or component changes between the two.
 */
import type { DropRepository } from './repository';
import { mockDropRepository } from './mock-repository';
import { supabaseDropRepository } from './supabase-repository';
import { catalogueSource, isSupabaseConfigured } from '$lib/server/env';

function selectRepository(): DropRepository {
	if (catalogueSource() === 'supabase') {
		if (!isSupabaseConfigured()) {
			throw new Error(
				'CATALOGUE_SOURCE=supabase but PUBLIC_SUPABASE_URL / ' +
					'PUBLIC_SUPABASE_ANON_KEY are not set. See .env.example.'
			);
		}
		return supabaseDropRepository;
	}
	return mockDropRepository;
}

/** Resolved per call so the switch works without a restart in dev. */
export const drops: DropRepository = {
	listDrops: () => selectRepository().listDrops(),
	findBySlug: (slug) => selectRepository().findBySlug(slug),
	findLiveDrop: () => selectRepository().findLiveDrop()
};

export type { DropRepository };
