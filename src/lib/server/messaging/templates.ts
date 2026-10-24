/**
 * Message templates (app.message_templates): reading them for sending, and
 * editing them from /admin/messages/templates.
 */
import { getServiceClient } from '$lib/server/db/clients';
import { writeAudit } from '$lib/server/admin/audit';
import { placeholders } from './render';

export type MessageTemplate = {
	readonly key: string;
	readonly name: string;
	readonly channel: 'email' | 'whatsapp';
	readonly purpose: 'transactional' | 'marketing';
	readonly description: string;
	readonly subject: string | null;
	readonly body: string;
	readonly waTemplateName: string | null;
	readonly waLanguage: string;
	readonly waParams: readonly string[];
	readonly active: boolean;
	readonly system: boolean;
	readonly updatedAt: number;
	readonly updatedBy: string | null;
};

type Row = {
	key: string;
	name: string;
	channel: 'email' | 'whatsapp';
	purpose: 'transactional' | 'marketing';
	description: string;
	subject: string | null;
	body: string;
	wa_template_name: string | null;
	wa_language: string;
	wa_params: string[] | null;
	active: boolean;
	system: boolean;
	updated_at: string;
	updated_by: string | null;
};

function toTemplate(row: Row): MessageTemplate {
	return {
		key: row.key,
		name: row.name,
		channel: row.channel,
		purpose: row.purpose,
		description: row.description,
		subject: row.subject,
		body: row.body,
		waTemplateName: row.wa_template_name,
		waLanguage: row.wa_language,
		waParams: row.wa_params ?? [],
		active: row.active,
		system: row.system,
		updatedAt: Date.parse(row.updated_at),
		updatedBy: row.updated_by
	};
}

export async function listTemplates(): Promise<MessageTemplate[]> {
	const { data, error } = await getServiceClient()
		.from('message_templates')
		.select('*')
		.order('name')
		.order('channel');
	if (error) throw new Error(`template read failed: ${error.message}`);
	return ((data ?? []) as Row[]).map(toTemplate);
}

export async function getTemplate(key: string): Promise<MessageTemplate | null> {
	const { data, error } = await getServiceClient()
		.from('message_templates')
		.select('*')
		.eq('key', key)
		.maybeSingle();
	if (error) throw new Error(`template read failed: ${error.message}`);
	return data ? toTemplate(data as Row) : null;
}

export class TemplateError extends Error {}

export async function saveTemplate(input: {
	key: string;
	subject: string | null;
	body: string;
	waTemplateName: string | null;
	waLanguage: string;
	waParams: readonly string[];
	active: boolean;
	actor: string;
}): Promise<void> {
	const before = await getTemplate(input.key);
	if (!before) throw new TemplateError('That template no longer exists.');
	if (!input.body.trim()) throw new TemplateError('Write the message body.');
	if (before.channel === 'email' && !input.subject?.trim()) {
		throw new TemplateError('Email templates need a subject line.');
	}

	// Every WhatsApp parameter must be a placeholder the body actually uses,
	// or Meta receives a value for a slot the preview never showed.
	if (before.channel === 'whatsapp') {
		const used = new Set(placeholders(input.body));
		const unknown = input.waParams.filter((name) => !used.has(name));
		if (unknown.length) {
			throw new TemplateError(
				`These parameters are not in the message: ${unknown.join(', ')}. Add them as {{name}} or remove them.`
			);
		}
	}

	const { error } = await getServiceClient()
		.from('message_templates')
		.update({
			subject: before.channel === 'email' ? input.subject : null,
			body: input.body,
			wa_template_name: before.channel === 'whatsapp' ? input.waTemplateName : null,
			wa_language: input.waLanguage || 'en',
			wa_params: before.channel === 'whatsapp' ? input.waParams : [],
			active: input.active,
			updated_by: input.actor
		})
		.eq('key', input.key);
	if (error) throw new Error(`template write failed: ${error.message}`);

	await writeAudit(input.actor, 'template edited', 'message_template', input.key, {
		active: input.active
	});
}

/** Sample values for the live preview, so a template reads like a real message. */
export const SAMPLE_VARIABLES: Record<string, string> = {
	name: 'Aisha',
	order_number: 'RW-1042',
	total: '₹3,400',
	order_url: 'https://rootwear.in/order/abc123',
	courier: 'Delhivery',
	tracking_ref: '1490 2210 8812',
	drop_name: 'Drop 01 — Pineapple Haze',
	balance: '₹1,700',
	due_by: '12 Nov',
	pay_url: 'https://rootwear.in/checkout/balance/abc',
	amount: '₹3,400',
	items: 'the Pineapple Haze tee (M)',
	cart_url: 'https://rootwear.in/cart',
	drop_url: 'https://rootwear.in/drops/01-pineapple-haze',
	invited_by: 'Aaron',
	login_url: 'https://rootwear.in/admin/login',
	headline: '3 orders to pack',
	summary: '3 orders are waiting to be packed.\n\n2 leads need a follow-up today.',
	code: 'ROOTS10'
};
