/**
 * Policy pages are stored as blocks (paragraph, heading, list, callout,
 * table, contact). Admin edits them as plain text with a few marks, so
 * nobody needs to know the block format:
 *
 *   ## A heading
 *   - a list item
 *   > a highlighted note
 *   | a | table | row |          (the first row is the header)
 *   ! a contact line
 *
 * Anything else is a paragraph; a blank line starts a new block. The two
 * functions are exact inverses for anything written this way.
 */
import type { PolicyBlock } from '$lib/server/content/types';

export function blocksToMarkup(blocks: readonly PolicyBlock[]): string {
	return blocks
		.map((block) => {
			switch (block.type) {
				case 'heading':
					return `## ${block.text}`;
				case 'list':
					return block.items.map((item) => `- ${item}`).join('\n');
				case 'callout':
					return `> ${block.text}`;
				case 'contact':
					return `! ${block.text}`;
				case 'table':
					return [block.head, ...block.rows].map((row) => `| ${row.join(' | ')} |`).join('\n');
				default:
					return block.text;
			}
		})
		.join('\n\n');
}

export function markupToBlocks(text: string): PolicyBlock[] {
	const blocks: PolicyBlock[] = [];
	for (const chunk of text.replace(/\r\n/g, '\n').split(/\n{2,}/)) {
		const lines = chunk
			.split('\n')
			.map((l) => l.trimEnd())
			.filter((l) => l.trim());
		if (!lines.length) continue;
		const first = lines[0].trimStart();
		if (first.startsWith('## ')) {
			blocks.push({ type: 'heading', text: first.slice(3).trim() });
			if (lines.length > 1)
				blocks.push({ type: 'paragraph', text: lines.slice(1).join(' ').trim() });
		} else if (lines.every((l) => l.trimStart().startsWith('- '))) {
			blocks.push({ type: 'list', items: lines.map((l) => l.trimStart().slice(2).trim()) });
		} else if (first.startsWith('> ')) {
			blocks.push({
				type: 'callout',
				text: lines
					.map((l) => l.replace(/^\s*>\s?/, ''))
					.join(' ')
					.trim()
			});
		} else if (first.startsWith('! ')) {
			blocks.push({
				type: 'contact',
				text: lines
					.map((l) => l.replace(/^\s*!\s?/, ''))
					.join(' ')
					.trim()
			});
		} else if (lines.every((l) => l.trim().startsWith('|'))) {
			const rows = lines.map((l) =>
				l
					.trim()
					.replace(/^\|/, '')
					.replace(/\|$/, '')
					.split('|')
					.map((cell) => cell.trim())
			);
			blocks.push({ type: 'table', head: rows[0], rows: rows.slice(1) });
		} else {
			blocks.push({ type: 'paragraph', text: lines.join(' ').trim() });
		}
	}
	return blocks;
}
