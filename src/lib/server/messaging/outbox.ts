/**
 * The outbox: every customer message is written here first, then sent.
 *
 * enqueue() renders the template and stores the result, then tries to send
 * straight away so a confirmation arrives in seconds. If the provider is down
 * the row stays queued and /api/cron/outbox retries it with backoff
 * (1, 5, 30, 120 minutes) up to max_attempts.
 */
import { getServiceClient } from '$lib/server/db/clients';
import { emailProvider, whatsAppProvider } from './config';
import { fill, whatsAppNumber, type Variables } from './render';
import { SendError, sendEmail, sendWhatsApp } from './providers';
import { getTemplate, type MessageTemplate } from './templates';

export type OutboxStatus =
	'queued' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed' | 'cancelled' | 'skipped';

export type OutboxMessage = {
	readonly id: string;
	readonly channel: 'email' | 'whatsapp';
	readonly purpose: 'transactional' | 'marketing';
	readonly recipient: string;
	readonly recipientName: string | null;
	readonly templateKey: string | null;
	readonly subject: string | null;
	readonly body: string;
	readonly variables: Record<string, string>;
	readonly status: OutboxStatus;
	readonly attempts: number;
	readonly maxAttempts: number;
	readonly nextAttemptAt: number;
	readonly lastError: string | null;
	readonly provider: string | null;
	readonly providerMessageId: string | null;
	readonly contextType: string | null;
	readonly contextId: string | null;
	readonly createdBy: string | null;
	readonly createdAt: number;
	readonly sentAt: number | null;
	readonly deliveredAt: number | null;
	readonly readAt: number | null;
};

type Row = {
	id: string;
	channel: 'email' | 'whatsapp';
	purpose: 'transactional' | 'marketing';
	recipient: string;
	recipient_name: string | null;
	template_key: string | null;
	subject: string | null;
	body: string;
	variables: Record<string, string> | null;
	status: OutboxStatus;
	attempts: number;
	max_attempts: number;
	next_attempt_at: string;
	last_error: string | null;
	provider: string | null;
	provider_message_id: string | null;
	context_type: string | null;
	context_id: string | null;
	created_by: string | null;
	created_at: string;
	sent_at: string | null;
	delivered_at: string | null;
	read_at: string | null;
};

const ms = (value: string | null) => (value ? Date.parse(value) : null);

export function toMessage(row: Row): OutboxMessage {
	return {
		id: row.id,
		channel: row.channel,
		purpose: row.purpose,
		recipient: row.recipient,
		recipientName: row.recipient_name,
		templateKey: row.template_key,
		subject: row.subject,
		body: row.body,
		variables: row.variables ?? {},
		status: row.status,
		attempts: row.attempts,
		maxAttempts: row.max_attempts,
		nextAttemptAt: Date.parse(row.next_attempt_at),
		lastError: row.last_error,
		provider: row.provider,
		providerMessageId: row.provider_message_id,
		contextType: row.context_type,
		contextId: row.context_id,
		createdBy: row.created_by,
		createdAt: Date.parse(row.created_at),
		sentAt: ms(row.sent_at),
		deliveredAt: ms(row.delivered_at),
		readAt: ms(row.read_at)
	};
}

export class EnqueueError extends Error {}

export type EnqueueInput = {
	/** A template key from app.message_templates. */
	readonly template: string;
	/** Email address or phone number, depending on the template's channel. */
	readonly to: string;
	readonly toName?: string | null;
	readonly variables: Variables;
	readonly context?: { readonly type: string; readonly id: string };
	readonly createdBy?: string;
	/** Send now (default) or leave queued for the cron. */
	readonly sendNow?: boolean;
};

function render(template: MessageTemplate, variables: Variables) {
	const body = fill(template.body, variables);
	const subject = template.subject ? fill(template.subject, variables) : null;
	return {
		body: body.text,
		subject: subject?.text ?? null,
		missing: [...new Set([...body.missing, ...(subject?.missing ?? [])])]
	};
}

function stringify(variables: Variables): Record<string, string> {
	return Object.fromEntries(
		Object.entries(variables)
			.filter(([, value]) => value !== undefined && value !== null)
			.map(([key, value]) => [key, String(value)])
	);
}

/** Writes one message to the outbox and, by default, tries to send it now. */
export async function enqueue(input: EnqueueInput): Promise<OutboxMessage> {
	const template = await getTemplate(input.template);
	if (!template) throw new EnqueueError(`No message template called "${input.template}".`);

	let recipient = input.to.trim();
	let status: OutboxStatus = 'queued';
	let lastError: string | null = null;

	if (template.channel === 'whatsapp') {
		const number = whatsAppNumber(recipient);
		if (!number) {
			status = 'skipped';
			lastError = `"${recipient}" is not a mobile number WhatsApp can reach.`;
		} else recipient = number;
	} else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
		status = 'skipped';
		lastError = `"${recipient}" is not an email address.`;
	}

	if (!template.active && status === 'queued') {
		status = 'skipped';
		lastError = 'This template is switched off.';
	}

	const rendered = render(template, input.variables);

	const { data, error } = await getServiceClient()
		.from('message_outbox')
		.insert({
			channel: template.channel,
			purpose: template.purpose,
			recipient: recipient.toLowerCase(),
			recipient_name: input.toName ?? null,
			template_key: template.key,
			subject: rendered.subject,
			body: rendered.body,
			variables: stringify(input.variables),
			status,
			last_error: lastError,
			context_type: input.context?.type ?? null,
			context_id: input.context?.id ?? null,
			created_by: input.createdBy ?? 'system'
		})
		.select('*')
		.single();
	if (error || !data) throw new Error(`outbox write failed: ${error?.message}`);

	const message = toMessage(data as Row);
	if (status === 'queued' && input.sendNow !== false) {
		return (await deliver([message.id]))[0] ?? message;
	}
	return message;
}

const BACKOFF_MINUTES = [1, 5, 30, 120, 360];

/** Sends one claimed row and records the outcome. Never throws. */
async function sendOne(row: Row): Promise<OutboxMessage> {
	const client = getServiceClient();
	const finish = async (patch: Record<string, unknown>) => {
		const { data, error } = await client
			.from('message_outbox')
			.update({ ...patch, attempts: row.attempts })
			.eq('id', row.id)
			.select('*')
			.single();
		if (error || !data) throw new Error(`outbox write failed: ${error?.message}`);
		return toMessage(data as Row);
	};

	try {
		let providerName: string;
		let providerId: string;

		if (row.channel === 'email') {
			const provider = emailProvider();
			if (!provider) {
				return finish({
					status: 'skipped',
					last_error: 'No email provider is connected. Add ZeptoMail or SMTP settings.'
				});
			}
			providerName = provider.kind;
			providerId = await sendEmail(provider, {
				to: row.recipient,
				toName: row.recipient_name,
				subject: row.subject ?? '',
				body: row.body
			});
		} else {
			const provider = whatsAppProvider();
			if (!provider) {
				return finish({
					status: 'skipped',
					last_error: 'WhatsApp is not connected yet. Add the Cloud API settings.'
				});
			}
			const template = row.template_key ? await getTemplate(row.template_key) : null;
			providerName = provider.kind;
			if (template?.waTemplateName) {
				providerId = await sendWhatsApp(provider, {
					kind: 'template',
					to: row.recipient,
					templateName: template.waTemplateName,
					language: template.waLanguage,
					parameters: template.waParams.map((name) => row.variables?.[name] ?? '')
				});
			} else {
				// No approved template: a free-text reply inside the 24-hour window.
				providerId = await sendWhatsApp(provider, {
					kind: 'text',
					to: row.recipient,
					text: row.body
				});
			}
		}

		return finish({
			status: 'sent',
			provider: providerName,
			provider_message_id: providerId,
			sent_at: new Date().toISOString(),
			last_error: null
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const retryable = error instanceof SendError ? error.retryable : true;
		if (!retryable || row.attempts >= row.max_attempts) {
			return finish({ status: 'failed', last_error: message });
		}
		const wait = BACKOFF_MINUTES[Math.min(row.attempts - 1, BACKOFF_MINUTES.length - 1)];
		return finish({
			status: 'queued',
			last_error: message,
			next_attempt_at: new Date(Date.now() + wait * 60_000).toISOString()
		});
	}
}

/**
 * Sends specific rows now (when given ids) or whatever is due (when not).
 * Rows are claimed with SKIP LOCKED, so this is safe to run concurrently.
 */
export async function deliver(ids?: readonly string[]): Promise<OutboxMessage[]> {
	const client = getServiceClient();
	let rows: Row[];

	if (ids) {
		const { data, error } = await client
			.from('message_outbox')
			.update({ status: 'sending' })
			.in('id', [...ids])
			.eq('status', 'queued')
			.select('*');
		if (error) throw new Error(`outbox claim failed: ${error.message}`);
		// claim_outbox increments attempts in SQL; this path counts the attempt
		// here and sendOne writes it back with the outcome.
		rows = ((data ?? []) as Row[]).map((row) => ({ ...row, attempts: row.attempts + 1 }));
	} else {
		await client.rpc('requeue_stuck_outbox');
		const { data, error } = await client.rpc('claim_outbox', { p_limit: 25 });
		if (error) throw new Error(`outbox claim failed: ${error.message}`);
		rows = (data ?? []) as Row[];
	}

	const results: OutboxMessage[] = [];
	for (const row of rows) results.push(await sendOne(row));
	return results;
}

/* ------------------------------------------------------------------------ */
/* Reads and operator actions for /admin/messages                             */
/* ------------------------------------------------------------------------ */

export const OUTBOX_PAGE_SIZE = 50;

export type OutboxFilter = {
	readonly status?: OutboxStatus | 'problem';
	readonly channel?: 'email' | 'whatsapp';
	readonly search?: string;
	readonly contextType?: string;
	readonly contextId?: string;
};

export async function listOutbox(
	filter: OutboxFilter,
	page: number
): Promise<{ messages: OutboxMessage[]; total: number }> {
	let query = getServiceClient()
		.from('message_outbox')
		.select('*', { count: 'exact' })
		.order('created_at', { ascending: false });

	if (filter.status === 'problem') query = query.in('status', ['failed', 'skipped']);
	else if (filter.status) query = query.eq('status', filter.status);
	if (filter.channel) query = query.eq('channel', filter.channel);
	if (filter.contextType) query = query.eq('context_type', filter.contextType);
	if (filter.contextId) query = query.eq('context_id', filter.contextId);
	if (filter.search) {
		const term = filter.search.replace(/[%,()]/g, ' ').trim();
		if (term)
			query = query.or(
				`recipient.ilike.*${term}*,subject.ilike.*${term}*,recipient_name.ilike.*${term}*`
			);
	}

	const start = Math.max(0, page - 1) * OUTBOX_PAGE_SIZE;
	const { data, error, count } = await query.range(start, start + OUTBOX_PAGE_SIZE - 1);
	if (error) throw new Error(`outbox read failed: ${error.message}`);
	return { messages: ((data ?? []) as Row[]).map(toMessage), total: count ?? 0 };
}

/** Messages about one record, for its timeline. */
export async function messagesFor(
	contextType: string,
	contextId: string
): Promise<OutboxMessage[]> {
	return (await listOutbox({ contextType, contextId }, 1)).messages;
}

export async function findMessage(id: string): Promise<OutboxMessage | null> {
	const { data, error } = await getServiceClient()
		.from('message_outbox')
		.select('*')
		.eq('id', id)
		.maybeSingle();
	if (error) throw new Error(`outbox read failed: ${error.message}`);
	return data ? toMessage(data as Row) : null;
}

/** Puts a failed or skipped message back in the queue and tries it now. */
export async function retryMessage(id: string): Promise<OutboxMessage | null> {
	const { error } = await getServiceClient()
		.from('message_outbox')
		.update({
			status: 'queued',
			next_attempt_at: new Date().toISOString(),
			max_attempts: 5,
			attempts: 0
		})
		.eq('id', id)
		.in('status', ['failed', 'skipped', 'cancelled']);
	if (error) throw new Error(`outbox write failed: ${error.message}`);
	return (await deliver([id]))[0] ?? findMessage(id);
}

export async function cancelMessage(id: string): Promise<void> {
	const { error } = await getServiceClient()
		.from('message_outbox')
		.update({ status: 'cancelled' })
		.eq('id', id)
		.eq('status', 'queued');
	if (error) throw new Error(`outbox write failed: ${error.message}`);
}

/** Counts for the tabs on the messages screen. */
export async function outboxCounts(): Promise<{ queued: number; problem: number }> {
	const client = getServiceClient();
	const [queued, problem] = await Promise.all([
		client
			.from('message_outbox')
			.select('id', { count: 'exact', head: true })
			.eq('status', 'queued'),
		client
			.from('message_outbox')
			.select('id', { count: 'exact', head: true })
			.in('status', ['failed', 'skipped'])
	]);
	return { queued: queued.count ?? 0, problem: problem.count ?? 0 };
}

/** Applies a WhatsApp delivery receipt from the Meta webhook. */
export async function recordReceipt(
	providerMessageId: string,
	status: string,
	at: number,
	error?: string
): Promise<void> {
	const patch: Record<string, unknown> = {};
	const iso = new Date(at).toISOString();
	if (status === 'delivered') Object.assign(patch, { status: 'delivered', delivered_at: iso });
	else if (status === 'read') Object.assign(patch, { status: 'read', read_at: iso });
	else if (status === 'failed')
		Object.assign(patch, { status: 'failed', last_error: error ?? 'Failed on delivery.' });
	else return;
	await getServiceClient()
		.from('message_outbox')
		.update(patch)
		.eq('provider_message_id', providerMessageId);
}
