import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { can, requirePermission, requireSection } from '$lib/server/admin/roles';
import { actorLabel, staffActor } from '$lib/server/admin/session';
import {
	addCustomerNote,
	CustomerError,
	getCustomer,
	updateCustomer
} from '$lib/server/customers/admin';
import { enqueue } from '$lib/server/messaging/outbox';

export const load: PageServerLoad = async (event) => {
	const actor = await staffActor(event);
	requireSection(actor, 'customers');
	const customer = await getCustomer(event.params.id);
	if (!customer) error(404, 'No such customer.');
	return {
		customer,
		now: event.locals.now,
		canEdit: can(actor, 'customers.edit'),
		canOrders: can(actor, 'orders.view'),
		canLeads: can(actor, 'leads.view')
	};
};

export const actions: Actions = {
	save: async (event) => {
		const actor = await staffActor(event);
		requirePermission(actor, 'customers.edit');
		const form = await event.request.formData();
		try {
			await updateCustomer({
				id: event.params.id,
				phone: String(form.get('phone') ?? ''),
				marketingEmail: form.get('marketingEmail') === 'on',
				marketingWhatsapp: form.get('marketingWhatsapp') === 'on',
				tags: String(form.get('tags') ?? '').split(','),
				actor: actorLabel(actor)
			});
		} catch (err) {
			if (err instanceof CustomerError) return fail(400, { error: err.message });
			throw err;
		}
		return { message: 'Saved.' };
	},
	note: async (event) => {
		const actor = await staffActor(event);
		requirePermission(actor, 'customers.edit');
		try {
			await addCustomerNote({
				id: event.params.id,
				body: String((await event.request.formData()).get('body') ?? ''),
				actor: actorLabel(actor)
			});
		} catch (err) {
			if (err instanceof CustomerError) return fail(400, { error: err.message });
			throw err;
		}
		return { message: 'Note added.' };
	},
	email: async (event) => {
		const actor = await staffActor(event);
		requirePermission(actor, 'customers.edit');
		const form = await event.request.formData();
		const subject = String(form.get('subject') ?? '').trim();
		const message = String(form.get('message') ?? '').trim();
		if (!subject || !message) return fail(400, { error: 'Write a subject and a message.' });
		const customer = await getCustomer(event.params.id);
		if (!customer) error(404, 'No such customer.');
		const sent = await enqueue({
			template: 'direct_email',
			to: customer.email,
			toName: customer.name,
			variables: { subject, message },
			context: { type: 'customer', id: customer.id },
			createdBy: actorLabel(actor)
		});
		if (sent.status === 'sent' || sent.status === 'queued') return { message: 'Email sent.' };
		return fail(400, { error: `Not sent: ${sent.lastError ?? sent.status}` });
	}
};
