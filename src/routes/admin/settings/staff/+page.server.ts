import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { grantRefusal, requireOwner, requireSection } from '$lib/server/admin/roles';
import { actorLabel, staffActor } from '$lib/server/admin/session';
import { inviteStaff, listStaff, StaffError } from '$lib/server/admin/staff';
import { enqueue } from '$lib/server/messaging/outbox';
import { emailProvider, siteUrl } from '$lib/server/messaging/config';

export const load: PageServerLoad = async (event) => {
	const actor = await staffActor(event);
	requireSection(actor, 'staff');
	return {
		staff: await listStaff(),
		me: actor.userId,
		canMakeOwners: actor.isOwner,
		emailConnected: emailProvider() !== null
	};
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const actions: Actions = {
	invite: async (event) => {
		const actor = await staffActor(event);
		requireSection(actor, 'staff');

		const form = await event.request.formData();
		const email = String(form.get('email') ?? '').trim().toLowerCase();
		const name = String(form.get('name') ?? '').trim() || null;
		const isOwner = form.get('owner') === 'on';
		const permissions = form.getAll('permissions').map(String);

		const values = { email, name, isOwner, permissions };
		if (!EMAIL.test(email)) {
			return fail(400, { ...values, error: 'Enter their email address, like name@example.com.' });
		}
		if (isOwner) requireOwner(actor);
		const refusal = grantRefusal(actor, permissions);
		if (refusal) return fail(403, { ...values, error: refusal });
		if (!isOwner && permissions.length === 0) {
			return fail(400, {
				...values,
				error: 'Tick at least one permission, or pick a starting point above the list.'
			});
		}

		try {
			const result = await inviteStaff({
				email,
				name,
				isOwner,
				permissions,
				actor: actorLabel(actor)
			});

			if (emailProvider()) {
				await enqueue({
					template: 'staff_invite_email',
					to: email,
					toName: name,
					variables: {
						name: name ?? email,
						invited_by: actor.name ?? actor.email,
						login_url: `${siteUrl()}/admin/login`
					},
					context: { type: 'staff', id: result.userId },
					createdBy: actorLabel(actor)
				});
			}

			return {
				message: `${name ?? email} can now sign in.`,
				invited: { email, name, password: result.password }
			};
		} catch (error) {
			if (error instanceof StaffError) return fail(400, { ...values, error: error.message });
			throw error;
		}
	}
};
