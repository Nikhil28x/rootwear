/**
 * Pure text helpers over PolicyBlock[].
 *
 * Kept out of both repositories so the mock search, the Postgres search and
 * the search page all derive snippets the same way. No I/O, no fixtures.
 */
import type { PolicyBlock } from './types';

/** Flatten a body to searchable plain text, blocks separated by a full stop gap. */
export function blocksToText(blocks: readonly PolicyBlock[]): string {
	const parts: string[] = [];
	for (const block of blocks) {
		switch (block.type) {
			case 'paragraph':
			case 'heading':
			case 'callout':
			case 'contact':
				parts.push(block.text);
				break;
			case 'list':
				parts.push(block.items.join(' '));
				break;
			case 'table':
				parts.push(block.head.join(' '));
				for (const row of block.rows) parts.push(row.join(' '));
				break;
		}
	}
	return parts.join(' · ');
}

/** Heading text alone — a hit in a heading is about the page, not in passing. */
export function headingsOf(blocks: readonly PolicyBlock[]): string {
	return blocks
		.filter((block) => block.type === 'heading')
		.map((block) => block.text)
		.join(' · ');
}

/** Query words worth matching on. Two characters or fewer are noise. */
export function queryTerms(query: string): string[] {
	return query
		.toLowerCase()
		.split(/[^a-z0-9]+/i)
		.filter((term) => term.length > 2);
}

/**
 * Weighted relevance: title beats heading beats summary beats body, and an
 * exact phrase hit beats a scatter of individual words.
 *
 * The weighting deliberately mirrors the setweight() A/B/C in migration 0009,
 * so a result list does not reorder itself when CATALOGUE_SOURCE flips.
 * Deliberately simple — eight pages do not need an index, and Postgres does
 * this properly on the other path.
 */
export function scorePolicy(
	query: string,
	fields: { title: string; summary: string; body: string; headings?: string }
): number {
	const phrase = query.trim().toLowerCase();
	if (phrase.length === 0) return 0;

	const title = fields.title.toLowerCase();
	const headings = (fields.headings ?? '').toLowerCase();
	const summary = fields.summary.toLowerCase();
	const body = fields.body.toLowerCase();

	let score = 0;
	if (title.includes(phrase)) score += 40;
	if (headings.includes(phrase)) score += 24;
	if (summary.includes(phrase)) score += 16;
	if (body.includes(phrase)) score += 8;

	for (const term of queryTerms(query)) {
		if (title.includes(term)) score += 10;
		if (headings.includes(term)) score += 6;
		if (summary.includes(term)) score += 4;
		if (body.includes(term)) score += 2;
	}
	return score;
}

/**
 * A readable window of `text` around the first query hit, so a result shows
 * the sentence the match is in rather than the opening line of the page.
 * Returns an empty string when nothing matched — the caller falls back to the
 * summary rather than printing a misleading excerpt.
 */
export function excerptAround(text: string, query: string, radius = 110): string {
	const haystack = text.toLowerCase();
	const candidates = [query.trim().toLowerCase(), ...queryTerms(query)].filter(Boolean);

	let at = -1;
	for (const candidate of candidates) {
		at = haystack.indexOf(candidate);
		if (at !== -1) break;
	}
	if (at === -1) return '';

	const start = Math.max(0, at - radius);
	const end = Math.min(text.length, at + radius);
	// Snap to word boundaries so the excerpt does not begin mid-word.
	const head = start === 0 ? 0 : text.indexOf(' ', start) + 1;
	const tail = end === text.length ? end : text.lastIndexOf(' ', end);

	const slice = text.slice(head, tail > head ? tail : end).trim();
	return `${head > 0 ? '… ' : ''}${slice}${tail < text.length ? ' …' : ''}`;
}
