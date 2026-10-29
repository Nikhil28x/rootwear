/**
 * Which providers send messages, read from the environment.
 *
 *   Email:    ZeptoMail when ZEPTOMAIL_TOKEN is set; otherwise SMTP when
 *             SMTP_HOST, SMTP_USER and SMTP_PASS are set (the existing
 *             mailbox); otherwise none.
 *   WhatsApp: Meta's Cloud API when WHATSAPP_PHONE_NUMBER_ID and
 *             WHATSAPP_ACCESS_TOKEN are set; otherwise none.
 *
 * With no provider, messages are still written to the outbox and marked
 * 'skipped' with the reason, so nothing is silently lost and the log shows
 * exactly what would have gone out.
 */
import { env } from '$env/dynamic/private';
import { SUPPORT_EMAIL, BUSINESS_NAME } from '$lib/content/business';

function value(name: string): string | undefined {
	const raw = env[name];
	return raw && raw.trim().length > 0 ? raw.trim() : undefined;
}

export type EmailProvider =
	| {
			readonly kind: 'zeptomail';
			readonly token: string;
			readonly url: string;
			readonly from: string;
			readonly fromName: string;
	  }
	| {
			readonly kind: 'smtp';
			readonly host: string;
			readonly port: number;
			readonly secure: boolean;
			readonly user: string;
			readonly pass: string;
			readonly from: string;
			readonly fromName: string;
	  };

export type WhatsAppProvider = {
	readonly kind: 'whatsapp_cloud';
	readonly phoneNumberId: string;
	readonly token: string;
	readonly apiVersion: string;
};

export function emailProvider(): EmailProvider | null {
	const from = value('EMAIL_FROM') ?? SUPPORT_EMAIL;
	const fromName = value('EMAIL_FROM_NAME') ?? BUSINESS_NAME;

	const token = value('ZEPTOMAIL_TOKEN');
	if (token) {
		return {
			kind: 'zeptomail',
			// ZeptoMail tokens are copied with their "Zoho-enczapikey " prefix as
			// often as without it; accept both.
			token: token.replace(/^Zoho-enczapikey\s+/i, ''),
			// India-region accounts use .in; others use .com.
			url: value('ZEPTOMAIL_API_URL') ?? 'https://api.zeptomail.in/v1.1/email',
			from,
			fromName
		};
	}

	const host = value('SMTP_HOST');
	const user = value('SMTP_USER');
	const pass = value('SMTP_PASS');
	if (host && user && pass) {
		const port = Number(value('SMTP_PORT') ?? '465');
		return {
			kind: 'smtp',
			host,
			port,
			secure: (value('SMTP_SECURE') ?? (port === 465 ? 'true' : 'false')) === 'true',
			user,
			pass,
			from: value('EMAIL_FROM') ?? user,
			fromName
		};
	}

	return null;
}

export function whatsAppProvider(): WhatsAppProvider | null {
	const phoneNumberId = value('WHATSAPP_PHONE_NUMBER_ID');
	const token = value('WHATSAPP_ACCESS_TOKEN');
	if (!phoneNumberId || !token) return null;
	return {
		kind: 'whatsapp_cloud',
		phoneNumberId,
		token,
		apiVersion: value('WHATSAPP_API_VERSION') ?? 'v21.0'
	};
}

/** Webhook settings for Meta (WhatsApp statuses and inbound messages, lead ads). */
export function metaWebhook(): { verifyToken: string | undefined; appSecret: string | undefined } {
	return { verifyToken: value('META_VERIFY_TOKEN'), appSecret: value('META_APP_SECRET') };
}

/** The public origin used in links inside messages. */
export function siteUrl(): string {
	return (value('PUBLIC_SITE_URL') ?? value('SITE_URL') ?? 'https://rootwearclothing.com').replace(
		/\/$/,
		''
	);
}

export type ChannelStatus = {
	readonly channel: 'email' | 'whatsapp';
	readonly configured: boolean;
	readonly provider: string | null;
	readonly sender: string | null;
	readonly missing: readonly string[];
};

/** For the settings screen: what is connected, and what is still missing. */
export function channelStatus(): ChannelStatus[] {
	const email = emailProvider();
	const whatsapp = whatsAppProvider();
	return [
		{
			channel: 'email',
			configured: email !== null,
			provider: email ? (email.kind === 'zeptomail' ? 'ZeptoMail' : `SMTP (${email.host})`) : null,
			sender: email ? `${email.fromName} <${email.from}>` : null,
			missing: email ? [] : ['ZEPTOMAIL_TOKEN', 'or SMTP_HOST, SMTP_USER, SMTP_PASS']
		},
		{
			channel: 'whatsapp',
			configured: whatsapp !== null,
			provider: whatsapp ? `WhatsApp Cloud API ${whatsapp.apiVersion}` : null,
			sender: whatsapp ? `Phone number ID ${whatsapp.phoneNumberId}` : null,
			missing: whatsapp
				? []
				: ['WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_ACCESS_TOKEN'].filter((name) => !value(name))
		}
	];
}
