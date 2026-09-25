#!/usr/bin/env node
/**
 * RW-082 — §14 / §18 content audit.
 *
 * "No unprovable environmental claim anywhere on the site, ALT TEXT INCLUDED."
 * Scans user-facing strings in src/ for the banned terms in
 * src/lib/content/claims.ts and exits non-zero on a hit, so the launch gate
 * (RW-167) and CI can both run it.
 *
 * Comments are stripped before scanning: a comment explaining which claim was
 * removed must not itself trip the audit.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = 'src';
const SKIP_FILES = new Set(['src/lib/content/claims.ts']);

const claims = readFileSync('src/lib/content/claims.ts', 'utf8');
const TERMS = [...claims.matchAll(/^\t'([^']+)',?$/gm)].map((m) => m[1]);

if (TERMS.length === 0) {
	console.error('content-audit: could not read BANNED_CLAIM_TERMS');
	process.exit(2);
}

function walk(dir) {
	return readdirSync(dir).flatMap((entry) => {
		const full = join(dir, entry);
		return statSync(full).isDirectory() ? walk(full) : [full];
	});
}

/** Remove block comments, line comments and Svelte/HTML comments. */
function stripComments(source) {
	return source
		.replace(/\/\*[\s\S]*?\*\//g, ' ')
		.replace(/^\s*\/\/.*$/gm, ' ')
		.replace(/<!--[\s\S]*?-->/g, ' ');
}

const findings = [];

for (const file of walk(ROOT)) {
	if (!['.svelte', '.ts', '.js'].includes(extname(file))) continue;
	if (SKIP_FILES.has(file)) continue;

	const text = stripComments(readFileSync(file, 'utf8'));
	const lower = text.toLowerCase();

	for (const term of TERMS) {
		let index = lower.indexOf(term);
		while (index !== -1) {
			const line = text.slice(0, index).split('\n').length;
			findings.push({ file, line, term });
			index = lower.indexOf(term, index + term.length);
		}
	}
}

if (findings.length > 0) {
	console.error(`\n§14 content audit FAILED — ${findings.length} unprovable claim(s):\n`);
	for (const f of findings) console.error(`  ${f.file}:${f.line}  "${f.term}"`);
	console.error('\nThe fabric composition and GSM are facts and may be stated.');
	console.error('Nothing carbon-neutral, nothing eco-certified, no unsupported claim.\n');
	process.exit(1);
}

console.log(`§14 content audit passed — ${TERMS.length} terms checked across src/.`);
