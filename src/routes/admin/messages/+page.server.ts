import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requirePermission, requireSection } from '$lib/server/admin/roles';
import { staffActor } from '$lib/server/admin/session';
import {
	cancelMessage,
	listOutbox,
	OUTBOX_PAGE_SIZE,
	retryMessage,
	type OutboxStatus
} from '$lib/server/messaging/outbox';

const STATUSES = [
	'queued',
	'sending',
	'sent',
	'delivered',
	'read',
	'failed',
	'cancelled',
	'skipped',
	'problem'
];

export const load: PageServerLoad = async (event) => {
	const actor = await staffActor(event);
	requireSection(actor, 'messages');

	const params = event.url.searchParams;
	const status = params.get('status') ?? '';
	const channel = params.get('channel') ?? '';
	const search = params.get('q') ?? '';
	const page = Math.max(1, Number(params.get('page')) || 1);
	// "broadcast:<id>", "order:<id>": the messages about one record.
	const [contextType, contextId] = (params.get('context') ?? '').split(':');

	const result = await listOutbox(
		{
			status: STATUSES.includes(status) ? (status as OutboxStatus | 'problem') : undefined,
			channel: channel === 'email' || channel === 'whatsapp' ? channel : undefined,
			search: search || undefined,
			contextType: contextType && contextId ? contextType : undefined,
			contextId: contextType && contextId ? contextId : undefined
		},
		page
	);

	return {
		...result,
		page,
		pageSize: OUTBOX_PAGE_SIZE,
		filters: { status, channel, search, context: params.get('context') ?? '' },
		canResend: actor.isOwner || actor.permissions.includes('messages.edit')
	};
};

export const actions: Actions = {
	retry: async (event) => {
		const actor = await staffActor(event);
		requirePermission(actor, 'messages.edit');
		const id = String((await event.request.formData()).get('id') ?? '');
		const message = await retryMessage(id);
		if (!message) return fail(404, { error: 'That message no longer exists.' });
		if (message.status === 'sent') return { message: 'Sent.' };
		return fail(400, { error: `Still not sent: ${message.lastError ?? message.status}` });
	},
	cancel: async (event) => {
		const actor = await staffActor(event);
		requirePermission(actor, 'messages.edit');
		const id = String((await event.request.formData()).get('id') ?? '');
		await cancelMessage(id);
		return { message: 'Cancelled. It will not be sent.' };
	}
};
