/**
 * Fixture-backed PolicyRepository.
 *
 * Mirrors src/lib/server/drops/mock-repository.ts exactly: async by design, so
 * callers are written against the shape the Supabase implementation has. This
 * is what lets the whole site — footer links included — run with no database.
 */
import type { Policy, PolicyLink, PolicyRepository } from './types';
import { POLICIES } from '$lib/content/policies';
import { blocksToText, headingsOf, scorePolicy } from './text';

/** Footer and index order is nav_order, then title, exactly as the SQL orders it. */
const ORDERED: readonly Policy[] = [...POLICIES].sort(
	(a, b) => a.navOrder - b.navOrder || a.title.localeCompare(b.title)
);

const link = ({ slug, title }: Policy): PolicyLink => ({ slug, title });

export const mockPolicyRepository: PolicyRepository = {
	async listFooterLinks() {
		return ORDERED.filter((policy) => policy.showInFooter).map(link);
	},

	async findBySlug(slug: string) {
		return ORDERED.find((policy) => policy.slug === slug) ?? null;
	},

	async listAll() {
		return [...ORDERED];
	},

	async search(query: string) {
		const trimmed = query.trim();
		if (trimmed.length === 0) return [];

		return (
			ORDERED.map((policy) => {
				const body = blocksToText(policy.body);
				return {
					policy,
					body,
					score: scorePolicy(trimmed, {
						title: policy.title,
						summary: policy.summary,
						headings: headingsOf(policy.body),
						body
					})
				};
			})
				.filter((hit) => hit.score > 0)
				.sort((a, b) => b.score - a.score || a.policy.navOrder - b.policy.navOrder)
				// The interface fixes the return shape at PolicyLink + the page's own
				// summary. The matched excerpt is a property of the query rather than
				// of the page, so the search route derives it from the body instead —
				// see excerptAround() in ./text.
				.map(({ policy }) => ({
					slug: policy.slug,
					title: policy.title,
					summary: policy.summary
				}))
		);
	}
};
