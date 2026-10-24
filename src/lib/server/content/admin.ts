/**
 * Editing policy pages from admin. A page starts as its code version
 * ($lib/content/policies); saving writes a public.policies row that replaces
 * it on the site once published; "Use the original" deletes the row.
 *
 * §11: the returns wording must be IDENTICAL everywhere it appears, so a page
 * whose original carries it cannot be saved without it.
 */
import { POLICIES } from '$lib/content/policies';
import { RETURNS_WORDING } from '$lib/content/returns';
import { getCatalogueClient } from '$lib/server/db/clients';
import { writeAudit } from '$lib/server/admin/audit';
import { blocksToText } from './text';
import type { Policy, PolicyBlock } from './types';

export class PolicyError extends Error {}

export type AdminPolicy = Policy & {
	readonly edited: boolean;
	readonly published: boolean;
	readonly hasOriginal: boolean;
	readonly carriesReturnsWording: boolean;
};

type Row = {
	slug: string;
	title: string;
	summary: string;
	body: PolicyBlock[];
	updated_at: string;
	nav_order: number;
	show_in_footer: boolean;
	published_at: string | null;
	carries_returns_wording: boolean;
};

export async function listPolicies(): Promise<AdminPolicy[]> {
	const { data, error } = await getCatalogueClient().from('policies').select('*');
	if (error) throw new Error(`policies read failed: ${error.message}`);
	const rows = new Map(((data ?? []) as Row[]).map((r) => [r.slug, r]));
	const slugs = new Set([...POLICIES.map((p) => p.slug), ...rows.keys()]);
	return [...slugs]
		.map((slug) => {
			const row = rows.get(slug);
			const original = POLICIES.find((p) => p.slug === slug);
			const carries = original ? blocksToText(original.body).includes(RETURNS_WORDING) : Boolean(row?.carries_returns_wording);
			if (row) {
				return {
					slug,
					title: row.title,
					summary: row.summary,
					body: row.body ?? [],
					updatedAt: Date.parse(row.updated_at),
					navOrder: row.nav_order,
					showInFooter: row.show_in_footer,
					edited: true,
					published: row.published_at !== null,
					hasOriginal: Boolean(original),
					carriesReturnsWording: carries
				};
			}
			return { ...original!, edited: false, published: true, hasOriginal: true, carriesReturnsWording: carries };
		})
		.sort((a, b) => a.navOrder - b.navOrder || a.title.localeCompare(b.title));
}

export async function findPolicy(slug: string): Promise<AdminPolicy | null> {
	return (await listPolicies()).find((p) => p.slug === slug) ?? null;
}

export async function savePolicy(input: {
	slug: string;
	title: string;
	summary: string;
	body: PolicyBlock[];
	navOrder: number;
	showInFooter: boolean;
	publish: boolean;
	actor: string;
}): Promise<void> {
	if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(input.slug)) throw new PolicyError('The address is lower-case words joined by dashes, e.g. care-guide.');
	if (!input.title.trim()) throw new PolicyError('Give the page a title.');
	if (!input.body.length) throw new PolicyError('The page is empty.');
	const original = POLICIES.find((p) => p.slug === input.slug);
	const carries = original ? blocksToText(original.body).includes(RETURNS_WORDING) : false;
	if (carries && !blocksToText(input.body).includes(RETURNS_WORDING)) {
		throw new PolicyError('This page must keep the returns wording exactly as it is (it appears word for word in four places). Put it back, then save.');
	}
	const { error } = await getCatalogueClient()
		.from('policies')
		.upsert(
			{
				slug: input.slug,
				title: input.title.trim(),
				summary: input.summary.trim(),
				body: input.body,
				nav_order: input.navOrder,
				show_in_footer: input.showInFooter,
				carries_returns_wording: carries,
				published_at: input.publish ? new Date().toISOString() : null
			},
			{ onConflict: 'slug' }
		);
	if (error) throw new Error(`policy save failed: ${error.message}`);
	await writeAudit(input.actor, input.publish ? 'page published' : 'page saved as draft', 'policy', input.slug);
}

export async function revertPolicy(slug: string, actor: string): Promise<void> {
	if (!POLICIES.some((p) => p.slug === slug)) throw new PolicyError('This page has no original to go back to. Unpublish it instead.');
	await getCatalogueClient().from('policies').delete().eq('slug', slug);
	await writeAudit(actor, 'page reverted to original', 'policy', slug);
}
