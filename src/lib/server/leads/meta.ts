/**
 * Lead capture from Meta, registered with the webhook dispatcher by importing
 * this module (src/routes/api/webhooks/meta).
 *
 *   WhatsApp  — every inbound message lands on the sender's lead (created if
 *               new), and opens WhatsApp's 24-hour reply window.
 *   Lead ads  — a Facebook or Instagram lead form submission. The webhook
 *               carries only an id; the answers are fetched from the Graph API
 *               with META_PAGE_ACCESS_TOKEN.
 *
 * Both dedupe on Meta's own ids, so a redelivered webhook adds nothing.
 */
import { env } from '$env/dynamic/private';
import { onMetaChange } from '$lib/server/meta/webhook';
import { captureLead } from './admin';

type WhatsAppValue = {
	contacts?: { wa_id: string; profile?: { name?: string } }[];
	messages?: {
		id: string;
		from: string;
		timestamp?: string;
		type: string;
		text?: { body: string };
		button?: { text: string };
		interactive?: { button_reply?: { title: string }; list_reply?: { title: string } };
		image?: { caption?: string };
		referral?: { headline?: string; source_url?: string; source_type?: string };
	}[];
};

function textOf(message: NonNullable<WhatsAppValue['messages']>[number]): string {
	return (
		message.text?.body ??
		message.button?.text ??
		message.interactive?.button_reply?.title ??
		message.interactive?.list_reply?.title ??
		message.image?.caption ??
		`[${message.type}]`
	);
}

onMetaChange(async (change) => {
	if (change.object !== 'whatsapp_business_account' || change.field !== 'messages') return;
	const value = change.value as WhatsAppValue;
	for (const message of value.messages ?? []) {
		const contact = value.contacts?.find((c) => c.wa_id === message.from);
		// A message from a click-to-WhatsApp ad carries the ad it came from.
		const fromAd = message.referral?.source_type === 'ad';
		await captureLead({
			name: contact?.profile?.name ?? null,
			phone: message.from,
			source: fromAd ? 'meta_ads' : 'whatsapp',
			sourceDetail: fromAd ? (message.referral?.headline ?? 'Click-to-WhatsApp ad') : 'WhatsApp message',
			// Their first words are the best summary of what they want.
			interest: textOf(message).slice(0, 140),
			externalId: `wa:${message.id}`,
			consentWhatsapp: true,
			inbound: true,
			activity: {
				kind: 'message_in',
				body: textOf(message),
				meta: { channel: 'whatsapp', external_id: `wa:${message.id}`, ...(message.referral ? { referral: message.referral } : {}) }
			}
		});
	}
});

type LeadgenValue = { leadgen_id?: string; form_id?: string; ad_id?: string; page_id?: string };

type GraphLead = {
	id: string;
	created_time?: string;
	ad_name?: string;
	form_id?: string;
	field_data?: { name: string; values: string[] }[];
};

/** Reads one lead's answers. Throws if the token is missing or Meta refuses. */
async function fetchLead(id: string): Promise<GraphLead> {
	const token = env.META_PAGE_ACCESS_TOKEN;
	if (!token) throw new Error('META_PAGE_ACCESS_TOKEN is not set, so lead ad answers cannot be read.');
	const version = env.WHATSAPP_API_VERSION || 'v21.0';
	const response = await fetch(
		`https://graph.facebook.com/${version}/${encodeURIComponent(id)}?fields=id,created_time,ad_name,form_id,field_data&access_token=${encodeURIComponent(token)}`,
		{ signal: AbortSignal.timeout(15_000) }
	);
	const body = (await response.json()) as GraphLead & { error?: { message?: string } };
	if (!response.ok) throw new Error(`Meta lead ${id}: ${body.error?.message ?? response.statusText}`);
	return body;
}

function field(lead: GraphLead, ...names: string[]): string | null {
	for (const name of names) {
		const value = lead.field_data?.find((f) => f.name.toLowerCase() === name)?.values?.[0];
		if (value) return value;
	}
	return null;
}

onMetaChange(async (change) => {
	if (change.object !== 'page' || change.field !== 'leadgen') return;
	const value = change.value as LeadgenValue;
	if (!value.leadgen_id) return;
	const lead = await fetchLead(value.leadgen_id);
	const known = new Set(['email', 'phone_number', 'phone', 'full_name', 'first_name', 'last_name']);
	const answers = (lead.field_data ?? [])
		.filter((f) => !known.has(f.name.toLowerCase()))
		.map((f) => `${f.name.replace(/_/g, ' ')}: ${f.values.join(', ')}`);
	const name =
		field(lead, 'full_name') ?? ([field(lead, 'first_name'), field(lead, 'last_name')].filter(Boolean).join(' ') || null);

	await captureLead({
		name,
		email: field(lead, 'email'),
		phone: field(lead, 'phone_number', 'phone'),
		source: 'meta_ads',
		sourceDetail: lead.ad_name ?? `Lead form ${lead.form_id ?? value.form_id ?? ''}`.trim(),
		externalId: `leadgen:${value.leadgen_id}`,
		consentEmail: true,
		activity: {
			kind: 'form',
			body: [`Lead ad${lead.ad_name ? `: ${lead.ad_name}` : ''}`, ...answers].join('\n'),
			meta: { external_id: `leadgen:${value.leadgen_id}`, ad_id: value.ad_id, form_id: value.form_id }
		},
		inbound: true
	});
});
