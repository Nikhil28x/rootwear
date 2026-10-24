/**
 * The three senders. Each takes one rendered message and either returns the
 * provider's message id or throws a SendError saying whether a retry could
 * help. Nothing here touches the database; outbox.ts owns state.
 */
import type { EmailProvider, WhatsAppProvider } from './config';
import { emailHtml } from './render';

export class SendError extends Error {
	constructor(
		message: string,
		/** False for errors a retry cannot fix: a bad address, an unapproved template. */
		readonly retryable: boolean
	) {
		super(message);
	}
}

export type EmailMessage = {
	readonly to: string;
	readonly toName: string | null;
	readonly subject: string;
	readonly body: string;
};

export async function sendEmail(provider: EmailProvider, message: EmailMessage): Promise<string> {
	const html = emailHtml(message.subject, message.body);

	if (provider.kind === 'zeptomail') {
		const response = await fetch(provider.url, {
			method: 'POST',
			headers: {
				accept: 'application/json',
				'content-type': 'application/json',
				authorization: `Zoho-enczapikey ${provider.token}`
			},
			body: JSON.stringify({
				from: { address: provider.from, name: provider.fromName },
				to: [{ email_address: { address: message.to, name: message.toName ?? undefined } }],
				subject: message.subject,
				htmlbody: html,
				textbody: message.body
			}),
			signal: AbortSignal.timeout(15_000)
		});
		const payload = (await response.json().catch(() => ({}))) as {
			request_id?: string;
			data?: { message_id?: string }[];
			error?: { message?: string; details?: { message?: string }[] };
		};
		if (!response.ok) {
			const detail =
				payload.error?.details?.[0]?.message ?? payload.error?.message ?? response.statusText;
			// 4xx other than rate limiting is a problem with the message itself.
			throw new SendError(`ZeptoMail ${response.status}: ${detail}`, response.status >= 500 || response.status === 429);
		}
		return payload.data?.[0]?.message_id ?? payload.request_id ?? 'zeptomail';
	}

	const nodemailer = await import('nodemailer');
	const transport = nodemailer.createTransport({
		host: provider.host,
		port: provider.port,
		secure: provider.secure,
		auth: { user: provider.user, pass: provider.pass },
		connectionTimeout: 15_000
	});
	try {
		const info = await transport.sendMail({
			from: { name: provider.fromName, address: provider.from },
			to: message.toName ? { name: message.toName, address: message.to } : message.to,
			subject: message.subject,
			text: message.body,
			html
		});
		return info.messageId;
	} catch (error) {
		const text = error instanceof Error ? error.message : String(error);
		// 5xx SMTP replies are permanent (bad mailbox); connection trouble is not.
		throw new SendError(`SMTP: ${text}`, !/\b5\d\d\b/.test(text));
	}
}

export type WhatsAppMessage =
	| {
			readonly kind: 'template';
			readonly to: string;
			readonly templateName: string;
			readonly language: string;
			readonly parameters: readonly string[];
	  }
	| {
			/** Free text. Only allowed within 24 hours of the customer's last message. */
			readonly kind: 'text';
			readonly to: string;
			readonly text: string;
	  };

export async function sendWhatsApp(provider: WhatsAppProvider, message: WhatsAppMessage): Promise<string> {
	const body =
		message.kind === 'template'
			? {
					messaging_product: 'whatsapp',
					to: message.to,
					type: 'template',
					template: {
						name: message.templateName,
						language: { code: message.language },
						components: message.parameters.length
							? [
									{
										type: 'body',
										parameters: message.parameters.map((text) => ({ type: 'text', text }))
									}
								]
							: []
					}
				}
			: { messaging_product: 'whatsapp', to: message.to, type: 'text', text: { body: message.text } };

	const response = await fetch(
		`https://graph.facebook.com/${provider.apiVersion}/${provider.phoneNumberId}/messages`,
		{
			method: 'POST',
			headers: { authorization: `Bearer ${provider.token}`, 'content-type': 'application/json' },
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(15_000)
		}
	);
	const payload = (await response.json().catch(() => ({}))) as {
		messages?: { id: string }[];
		error?: { message?: string; code?: number; error_data?: { details?: string } };
	};
	if (!response.ok || !payload.messages?.[0]?.id) {
		const detail = payload.error?.error_data?.details ?? payload.error?.message ?? response.statusText;
		// 131026 undeliverable, 132001 template missing, 131047 outside the 24h window.
		const permanent = [131026, 132000, 132001, 132005, 132007, 131047, 131051].includes(
			payload.error?.code ?? 0
		);
		throw new SendError(
			`WhatsApp ${payload.error?.code ?? response.status}: ${detail}`,
			!permanent && (response.status >= 500 || response.status === 429)
		);
	}
	return payload.messages[0].id;
}
