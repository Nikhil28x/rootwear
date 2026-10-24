import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireSection } from '$lib/server/admin/roles';
import { actorLabel, staffActor } from '$lib/server/admin/session';
import { channelStatus, metaWebhook, siteUrl } from '$lib/server/messaging/config';
import { enqueue } from '$lib/server/messaging/outbox';
import { whatsAppNumber } from '$lib/server/messaging/render';

export const load: PageServerLoad = async (event) => {
	const actor = await staffActor(event);
	requireSection(actor, 'settings');
	const webhook = metaWebhook();
	return {
		channels: channelStatus(),
		webhookUrl: `${siteUrl()}/api/webhooks/meta`,
		webhookReady: Boolean(webhook.verifyToken && webhook.appSecret),
		cronUrl: `${siteUrl()}/api/cron/outbox`,
		myEmail: actor.email
	};
};

export const actions: Actions = {
	test: async (event) => {
		const actor = await staffActor(event);
		requireSection(actor, 'settings');
		const form = await event.request.formData();
		const channel = String(form.get('channel'));
		const to = String(form.get('to') ?? '').trim();

		if (channel === 'whatsapp' && !whatsAppNumber(to)) {
			return fail(400, { error: 'Enter a 10-digit Indian mobile number, like 98765 43210.' });
		}
		if (channel === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
			return fail(400, { error: 'Enter an email address to send the test to.' });
		}

		// Uses the real order-confirmation template with sample values, so the
		// test proves the template, the provider and (for WhatsApp) Meta's
		// approval of that template name all at once.
		const message = await enqueue({
			template: channel === 'whatsapp' ? 'order_confirmed_whatsapp' : 'order_confirmed_email',
			to,
			toName: 'Test',
			variables: {
				name: 'there',
				order_number: 'TEST-0001',
				total: '₹0',
				order_url: siteUrl()
			},
			context: { type: 'test', id: actor.userId },
			createdBy: actorLabel(actor)
		});

		if (message.status === 'sent') return { message: `Test sent to ${to}.` };
		return fail(400, {
			error: `Not sent. ${(message.lastError ?? message.status).replace(/\.$/, '')}. It is in Messages if you want to retry.`
		});
	}
};
