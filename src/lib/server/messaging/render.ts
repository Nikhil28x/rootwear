/**
 * Filling templates, and the house email layout.
 *
 * Templates use {{name}} placeholders. A placeholder with no value renders
 * as an empty string and is reported, so a template edited to mention
 * {{coupon}} where no coupon exists shows up in the preview rather than
 * going out with a hole nobody noticed.
 */
import { BUSINESS_ADDRESS, BUSINESS_NAME, INSTAGRAM_URL, SUPPORT_EMAIL } from '$lib/content/business';

export type Variables = Record<string, string | number | null | undefined>;

const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function placeholders(text: string): string[] {
	return [...new Set([...text.matchAll(PLACEHOLDER)].map((match) => match[1]))];
}

export function fill(text: string, variables: Variables): { text: string; missing: string[] } {
	const missing: string[] = [];
	const out = text.replace(PLACEHOLDER, (_, name: string) => {
		const value = variables[name];
		if (value === undefined || value === null || value === '') {
			missing.push(name);
			return '';
		}
		return String(value);
	});
	return { text: out, missing: [...new Set(missing)] };
}

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

/** URLs in plain text become links; everything else is escaped. */
function linkify(line: string): string {
	return escapeHtml(line).replace(
		/(https?:\/\/[^\s<]+)/g,
		(url) => `<a href="${url}" style="color:#1f382a;text-decoration:underline">${url}</a>`
	);
}

/**
 * Plain text in, the house HTML email out. Blank lines separate paragraphs.
 * Deliberately simple markup: email clients render tables and inline styles
 * reliably and very little else.
 */
export function emailHtml(subject: string, body: string): string {
	const paragraphs = body
		.trim()
		.split(/\n{2,}/)
		.map(
			(block) =>
				`<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#27272a">${block
					.split('\n')
					.map(linkify)
					.join('<br>')}</p>`
		)
		.join('');

	return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e4e4e7;border-radius:14px">
<tr><td style="padding:28px 32px 8px;font-size:13px;letter-spacing:0.2em;text-transform:uppercase;color:#1f382a;font-weight:600">Rootwear</td></tr>
<tr><td style="padding:16px 32px 16px">${paragraphs}</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px"><tr><td style="padding:20px 32px;font-size:12px;line-height:18px;color:#6b6b74">
${escapeHtml(BUSINESS_NAME)} · ${escapeHtml(BUSINESS_ADDRESS)}<br>
<a href="mailto:${SUPPORT_EMAIL}" style="color:#6b6b74">${SUPPORT_EMAIL}</a> · <a href="${INSTAGRAM_URL}" style="color:#6b6b74">Instagram</a>
</td></tr></table>
</td></tr></table></body></html>`;
}

/**
 * Indian mobile numbers to WhatsApp's format: digits only, country code
 * first. "098765 43210", "+91 98765 43210" and "9876543210" all become
 * "919876543210". Returns null for anything that is not a plausible mobile.
 */
export function whatsAppNumber(raw: string | null | undefined): string | null {
	if (!raw) return null;
	let digits = raw.replace(/\D/g, '');
	if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
	if (digits.length === 10) digits = `91${digits}`;
	if (!/^91[6-9]\d{9}$/.test(digits) && !(digits.length >= 11 && digits.length <= 15 && !digits.startsWith('91'))) {
		return null;
	}
	return digits;
}
