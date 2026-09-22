import type { PageServerLoad } from './$types';
import { policies, blocksToText, excerptAround } from '$lib/server/content';

/**
 * §03 template 10 — search, styled with the static template.
 *
 * A plain GET form: the query lives in the URL, so a result set can be shared,
 * bookmarked and reloaded, and the page works with JavaScript disabled without
 * a form action at all.
 *
 * Ranking is the repository's job — the fixtures score in TypeScript, Postgres
 * scores with the generated tsvector in migration 0009. The matched excerpt is
 * a property of the QUERY rather than of the page, so it is derived here from
 * the body rather than stored anywhere.
 */
export const load: PageServerLoad = async ({ url }) => {
	const raw = url.searchParams.get('q') ?? '';
	// A long query is a paste accident or an attempt to make the scorer work.
	const query = raw.trim().slice(0, 120);

	const all = await policies.listAll();
	const everything = all.map(({ slug, title, summary }) => ({ slug, title, summary }));

	if (query.length === 0) {
		return { query, results: [], everything, searched: false };
	}

	const hits = await policies.search(query);
	const bodies = new Map(all.map((policy) => [policy.slug, blocksToText(policy.body)]));

	const results = hits.map((hit) => ({
		...hit,
		// Empty when the match was in the title alone — the page then shows the
		// summary rather than an excerpt that would look arbitrary.
		snippet: excerptAround(bodies.get(hit.slug) ?? '', query)
	}));

	return { query, results, everything, searched: true };
};
