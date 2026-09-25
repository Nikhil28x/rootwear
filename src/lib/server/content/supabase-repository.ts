/**
 * Postgres-backed PolicyRepository — public.policies (migration 0009).
 *
 * Implements exactly the interface the mock implements, so switching between
 * them is one environment variable and no other code change (see ./index.ts).
 *
 * Reads go through the catalogue client, which uses the service role and so
 * bypasses RLS. The anon read policy on public.policies is
 * `published_at is not null and published_at <= now()`, and that gate is
 * therefore re-applied EXPLICITLY on every query below rather than relied upon
 * implicitly — unpublished drafts must never leak through the storefront.
 */
import type { Policy, PolicyBlock, PolicyLink, PolicyRepository } from './types';
import { getCatalogueClient } from '$lib/server/db/clients';

type Row = {
	slug: string;
	title: string;
	summary: string;
	body: PolicyBlock[] | null;
	updated_at: string;
	nav_order: number;
	show_in_footer: boolean;
};

const FULL = 'slug, title, summary, body, updated_at, nav_order, show_in_footer';
const LINK = 'slug, title, summary, nav_order';

function toDomain(row: Row): Policy {
	return {
		slug: row.slug,
		title: row.title,
		summary: row.summary ?? '',
		// jsonb arrives already parsed; an empty body renders as an empty page
		// rather than throwing, because a half-written draft is not a 500.
		body: Array.isArray(row.body) ? row.body : [],
		updatedAt: Date.parse(row.updated_at),
		navOrder: row.nav_order,
		showInFooter: row.show_in_footer
	};
}

export const supabasePolicyRepository: PolicyRepository = {
	async listFooterLinks(): Promise<PolicyLink[]> {
		const { data, error } = await getCatalogueClient()
			.from('policies')
			.select('slug, title')
			.eq('show_in_footer', true)
			.not('published_at', 'is', null)
			.lte('published_at', new Date().toISOString())
			.order('nav_order', { ascending: true })
			.order('title', { ascending: true });

		if (error) throw new Error(`listFooterLinks failed: ${error.message}`);
		return (data ?? []) as PolicyLink[];
	},

	async findBySlug(slug: string): Promise<Policy | null> {
		const { data, error } = await getCatalogueClient()
			.from('policies')
			.select(FULL)
			.eq('slug', slug)
			.not('published_at', 'is', null)
			.lte('published_at', new Date().toISOString())
			.maybeSingle();

		if (error) throw new Error(`findBySlug failed: ${error.message}`);
		return data ? toDomain(data as unknown as Row) : null;
	},

	async listAll(): Promise<Policy[]> {
		const { data, error } = await getCatalogueClient()
			.from('policies')
			.select(FULL)
			.not('published_at', 'is', null)
			.lte('published_at', new Date().toISOString())
			.order('nav_order', { ascending: true })
			.order('title', { ascending: true });

		if (error) throw new Error(`listAll failed: ${error.message}`);
		return ((data ?? []) as unknown as Row[]).map(toDomain);
	},

	async search(query: string) {
		const trimmed = query.trim();
		if (trimmed.length === 0) return [];

		// 0009 stores a generated tsvector weighted title(A) > summary(B) >
		// body(C), with a GIN index on it. 'websearch' is the forgiving parser:
		// it never throws on punctuation a visitor happened to type.
		const { data, error } = await getCatalogueClient()
			.from('policies')
			.select(LINK)
			.not('published_at', 'is', null)
			.lte('published_at', new Date().toISOString())
			.textSearch('search_vector', trimmed, { type: 'websearch', config: 'english' })
			.order('nav_order', { ascending: true })
			.limit(25);

		if (error) throw new Error(`search failed: ${error.message}`);

		return ((data ?? []) as Array<{ slug: string; title: string; summary: string }>).map(
			({ slug, title, summary }) => ({ slug, title, summary: summary ?? '' })
		);
	}
};
