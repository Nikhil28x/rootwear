import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { adminRepo } from '$lib/server/admin';
import { CONTACT_STATUSES, type ContactStatus } from '$lib/server/admin/types';
import { can, requirePermission, requireSection } from '$lib/server/admin/roles';
import { actorLabel, staffActor } from '$lib/server/admin/session';
import { enqueue } from '$lib/server/messaging/outbox';

/** Messages from the contact form: read, reply, and mark where each one stands. */
export const load: PageServerLoad = async (event) => {
	const actor = await staffActor(event);
	requireSection(actor, 'contact');
	const statusParam = event.url.searchParams.get('status');
	const status = (CONTACT_STATUSES as readonly string[]).includes(statusParam ?? '')
		? (statusParam as ContactStatus)
		: undefined;
	const all = await adminRepo.listContact({ status });
	return {
		now: event.locals.now,
		submissions: all.filter((row) => !row.isSpam),
		spam: all.filter((row) => row.isSpam).length,
		canEdit: can(actor, 'leads.edit')
	};
};

export const actions: Actions = {
	setStatus: async (event) => {
		const actor = await staffActor(event);
		requirePermission(actor, 'leads.edit');
		const form = await event.request.formData();
		const id = String(form.get('id') ?? '');
		const status = String(form.get('status') ?? '');
		if (!id || !(CONTACT_STATUSES as readonly string[]).includes(status))
			return fail(400, { error: 'Unknown message or status.' });
		await adminRepo.setContactStatus({
			id,
			status: status as ContactStatus,
			actor: actorLabel(actor)
		});
		return { message: status === 'closed' ? 'Closed.' : 'Status saved.' };
	},

	reply: async (event) => {
		const actor = await staffActor(event);
		requirePermission(actor, 'leads.edit');
		const form = await event.request.formData();
		const id = String(form.get('id') ?? '');
		const message = String(form.get('message') ?? '').trim();
		if (!message) return fail(400, { error: 'Write the reply first.' });
		const row = (await adminRepo.listContact({})).find((r) => r.id === id);
		if (!row) return fail(404, { error: 'That message no longer exists.' });
		const sent = await enqueue({
			template: 'direct_email',
			to: row.email,
			toName: row.name,
			variables: { subject: `Re: ${row.subject} (${row.trackingId})`, message },
			context: { type: 'contact', id },
			createdBy: actorLabel(actor)
		});
		if (sent.status !== 'sent' && sent.status !== 'queued')
			return fail(400, { error: `Not sent: ${sent.lastError ?? sent.status}` });
		await adminRepo.setContactStatus({ id, status: 'in_progress', actor: actorLabel(actor) });
		return { message: 'Reply sent.' };
	}
};
