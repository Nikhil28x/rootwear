import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad, RequestEvent } from './$types';
import { grantRefusal, requireOwner, requireSection } from '$lib/server/admin/roles';
import { actorLabel, staffActor } from '$lib/server/admin/session';
import {
	findStaff,
	removeStaff,
	resetStaffPassword,
	StaffError,
	updateStaff
} from '$lib/server/admin/staff';
import { auditFor } from '$lib/server/admin/audit';

export const load: PageServerLoad = async (event) => {
	const actor = await staffActor(event);
	requireSection(actor, 'staff');

	const person = await findStaff(event.params.id);
	if (!person) error(404, 'That person is not on the team.');

	return {
		person,
		isMe: person.userId === actor.userId,
		canEdit: actor.isOwner || (!person.isOwner && grantRefusal(actor, person.permissions) === null),
		canMakeOwners: actor.isOwner,
		history: await auditFor('staff', person.userId, 20)
	};
};

async function target(event: RequestEvent) {
	const actor = await staffActor(event);
	requireSection(actor, 'staff');
	const person = await findStaff(event.params.id);
	if (!person) error(404, 'That person is not on the team.');
	if (person.isOwner) requireOwner(actor);
	// A non-owner may only manage people whose access is entirely within their
	// own. Otherwise a password reset would hand them a stronger account, and
	// editing or removing would let them act on someone above them.
	const beyond = grantRefusal(actor, person.permissions);
	if (beyond) error(403, 'Only an owner can manage someone with access you do not have yourself.');
	return { actor, person };
}

export const actions: Actions = {
	save: async (event) => {
		const { actor, person } = await target(event);
		const form = await event.request.formData();
		const isOwner = form.get('owner') === 'on';
		const permissions = form.getAll('permissions').map(String);
		const active = form.get('active') === 'on';
		const name = String(form.get('name') ?? '').trim() || null;

		if (isOwner && !person.isOwner) requireOwner(actor);
		const refusal = grantRefusal(actor, permissions, person);
		if (refusal) return fail(403, { error: refusal });

		try {
			await updateStaff({
				userId: person.userId,
				name,
				isOwner,
				permissions,
				active,
				actor: actorLabel(actor)
			});
		} catch (err) {
			if (err instanceof StaffError) return fail(400, { error: err.message });
			throw err;
		}
		return { message: 'Access saved.' };
	},

	resetPassword: async (event) => {
		const { actor, person } = await target(event);
		const password = await resetStaffPassword(person.userId, actorLabel(actor));
		return { message: 'New temporary password created.', password };
	},

	remove: async (event) => {
		const { actor, person } = await target(event);
		try {
			await removeStaff(person.userId, actorLabel(actor));
		} catch (err) {
			if (err instanceof StaffError) return fail(400, { error: err.message });
			throw err;
		}
		redirect(303, '/admin/settings/staff');
	}
};
