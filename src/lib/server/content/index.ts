/**
 * The one place the static-content data source is chosen.
 *
 * Deliberately the same switch and the same environment variable as
 * src/lib/server/drops/index.ts: the catalogue and the copy wrapped around it
 * must never come from two different worlds.
 *
 * CATALOGUE_SOURCE=supabase reads public.policies; anything else (the default)
 * reads the fixtures in src/lib/content/policies.ts, so the site — including
 * the footer link list the root layout loads on EVERY route — runs with no
 * database configured. No route or component changes between the two.
 */
import type { PolicyRepository } from './types';
import { mockPolicyRepository } from './mock-repository';
import { supabasePolicyRepository } from './supabase-repository';
import { catalogueSource, isSupabaseConfigured } from '$lib/server/env';

function selectRepository(): PolicyRepository {
	if (catalogueSource() === 'supabase') {
		if (!isSupabaseConfigured()) {
			throw new Error(
				'CATALOGUE_SOURCE=supabase but PUBLIC_SUPABASE_URL / ' +
					'PUBLIC_SUPABASE_ANON_KEY are not set. See .env.example.'
			);
		}
		return supabasePolicyRepository;
	}
	return mockPolicyRepository;
}

/** Resolved per call so the switch works without a restart in dev. */
export const policies: PolicyRepository = {
	listFooterLinks: () => selectRepository().listFooterLinks(),
	findBySlug: (slug) => selectRepository().findBySlug(slug),
	listAll: () => selectRepository().listAll(),
	search: (query) => selectRepository().search(query)
};

export { contactInbox } from './contact';
export type { ContactRepository, ContactSubmission, ContactWriteStatus } from './contact';
export { blocksToText, excerptAround, headingsOf, queryTerms, scorePolicy } from './text';
export type { Policy, PolicyBlock, PolicyLink, PolicyRepository } from './types';
