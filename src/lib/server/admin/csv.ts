/**
 * RW-148 — CSV encoding for the §13 export.
 *
 * "The list belongs to Rootwear, exportable at any time." That promise is only
 * worth anything if the file opens cleanly in the spreadsheet Aaron actually
 * uses, so three things are handled deliberately:
 *
 *  - QUOTING. Every field is quoted and internal quotes are doubled, per
 *    RFC 4180. A note containing a comma, a newline or a quote survives.
 *  - FORMULA INJECTION. A field starting with = + - or @ is prefixed with a
 *    single quote. Excel and Sheets treat a leading = as a formula, and an
 *    email address a stranger typed into the notify-me box is untrusted input.
 *  - BOM. A UTF-8 byte-order mark, so Excel does not mangle non-ASCII names.
 */

const RISKY = /^[=+\-@\t\r]/;

function cell(value: unknown): string {
	if (value === null || value === undefined) return '""';
	let text = String(value);
	if (RISKY.test(text)) text = `'${text}`;
	return `"${text.replaceAll('"', '""')}"`;
}

export function toCsv(headers: string[], rows: Array<Array<unknown>>): string {
	const lines = [headers.map(cell).join(','), ...rows.map((row) => row.map(cell).join(','))];
	return `﻿${lines.join('\r\n')}\r\n`;
}

/** ISO date, which sorts correctly as text in every spreadsheet. */
export function csvDate(ms: number): string {
	return new Date(ms).toISOString().replace('T', ' ').slice(0, 19);
}

export function csvResponse(filename: string, body: string): Response {
	return new Response(body, {
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'content-disposition': `attachment; filename="${filename}"`,
			// Customer contact data: never cached by a proxy on the way out.
			'cache-control': 'no-store'
		}
	});
}
