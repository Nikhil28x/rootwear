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
import type { Policy, PolicyRepository } from './types';
import { mockPolicyRepository } from './mock-repository';
import { supabasePolicyRepository } from './supabase-repository';
import { catalogueSource, isSupabaseConfigured } from '$lib/server/env';
import { POLICIES } from '$lib/content/policies';
import { blocksToText, headingsOf, scorePolicy } from './text';

/**
 * With a database, a page edited in admin (a published public.policies row)
 * replaces the code version of the same slug; every page nobody has edited
 * is still served from $lib/content/policies. Without this, connecting the
 * database would have emptied /policies, because the table starts empty.
 */
async function merged(): Promise<Policy[]> {
	const edited = await supabasePolicyRepository.listAll();
	const bySlug = new Map<string, Policy>(POLICIES.map((p) => [p.slug, p]));
	for (const policy of edited) bySlug.set(policy.slug, policy);
	return [...bySlug.values()].sort((a, b) => a.navOrder - b.navOrder || a.title.localeCompare(b.title));
}

const mergedPolicyRepository: PolicyRepository = {
	async listFooterLinks() {
		return (await merged()).filter((p) => p.showInFooter).map(({ slug, title }) => ({ slug, title }));
	},
	async findBySlug(slug) {
		return (await supabasePolicyRepository.findBySlug(slug)) ?? POLICIES.find((p) => p.slug === slug) ?? null;
	},
	async listAll() {
		return merged();
	},
	async search(query) {
		const trimmed = query.trim();
		if (!trimmed) return [];
		return (await merged())
			.map((policy) => ({
				policy,
				score: scorePolicy(trimmed, {
					title: policy.title,
					summary: policy.summary,
					headings: headingsOf(policy.body),
					body: blocksToText(policy.body)
				})
			}))
			.filter((hit) => hit.score > 0)
			.sort((a, b) => b.score - a.score || a.policy.navOrder - b.policy.navOrder)
			.map(({ policy }) => ({ slug: policy.slug, title: policy.title, summary: policy.summary }));
	}
};

function selectRepository(): PolicyRepository {
	if (catalogueSource() === 'supabase') {
		if (!isSupabaseConfigured()) {
			throw new Error(
				'CATALOGUE_SOURCE=supabase but PUBLIC_SUPABASE_URL / ' +
					'PUBLIC_SUPABASE_ANON_KEY are not set. See .env.example.'
			);
		}
		return mergedPolicyRepository;
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
export type {
	ContactRepository,
	ContactSubmission,
	ContactWriteResult,
	ContactWriteStatus
} from './contact';
export { blocksToText, excerptAround, headingsOf, queryTerms, scorePolicy } from './text';
export type { Policy, PolicyBlock, PolicyLink, PolicyRepository } from './types';
