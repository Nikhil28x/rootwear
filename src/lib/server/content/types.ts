import type { Snippet } from 'svelte';

/**
 * §03 template 10 — the reusable Static/Policy template.
 * "Unlimited pages on one template."
 *
 * Body is ordered structured blocks, not raw HTML: the renderer owns
 * typography, and a policy page cannot inject markup.
 */
export type PolicyBlock =
	| { type: 'paragraph'; text: string }
	| { type: 'heading'; text: string }
	| { type: 'list'; items: string[] }
	| { type: 'callout'; text: string }
	| { type: 'table'; head: string[]; rows: string[][] }
	| { type: 'contact'; text: string };

export type Policy = {
	slug: string;
	title: string;
	summary: string;
	body: PolicyBlock[];
	updatedAt: number;
	navOrder: number;
	showInFooter: boolean;
};

export type PolicyLink = { slug: string; title: string };

export interface PolicyRepository {
	listFooterLinks(): Promise<PolicyLink[]>;
	findBySlug(slug: string): Promise<Policy | null>;
	listAll(): Promise<Policy[]>;
	search(query: string): Promise<Array<PolicyLink & { summary: string }>>;
}
