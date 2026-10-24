import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { staffActor } from '$lib/server/admin/session';
import { setOwnName, setOwnPassword } from '$lib/server/admin/staff';
import { PERMISSION_GROUPS } from '$lib/admin/permissions';

/** Every staff member's own screen: name, password, and what they can do. */
export const load: PageServerLoad = async (event) => {
	const actor = await staffActor(event);
	const all: readonly { key: string; label: string }[] = PERMISSION_GROUPS.flatMap(
		(group) => group.permissions as readonly { key: string; label: string }[]
	);
	const granted = all.filter(
		(p) => actor.isOwner || (actor.permissions as readonly string[]).includes(p.key)
	);
	return { me: actor, granted: granted.map((p) => p.label) };
};

export const actions: Actions = {
	name: async (event) => {
		const actor = await staffActor(event);
		if (actor.preview) return fail(400, { error: 'Not available without a database.' });
		const name = String((await event.request.formData()).get('name') ?? '').trim() || null;
		await setOwnName(actor.userId, name);
		return { message: 'Name saved.' };
	},

	password: async (event) => {
		const actor = await staffActor(event);
		if (actor.preview) {
			return fail(400, {
				error: 'This sign-in comes from the server settings and cannot be changed here.'
			});
		}
		const form = await event.request.formData();
		const current = String(form.get('current') ?? '');
		const next = String(form.get('next') ?? '');
		const confirm = String(form.get('confirm') ?? '');

		if (next.length < 12) {
			return fail(400, { error: 'Use at least 12 characters for the new password.' });
		}
		if (next !== confirm) return fail(400, { error: 'The two new passwords do not match.' });

		// Prove the current password before replacing it, so a session left open
		// on a shared machine cannot be used to lock its owner out.
		const supabase = event.locals.supabase;
		if (!supabase) return fail(503, { error: 'Sign-in is not configured on this server.' });
		const { error } = await supabase.auth.signInWithPassword({
			email: actor.email,
			password: current
		});
		if (error) return fail(400, { error: 'Your current password is not right.' });

		await setOwnPassword(actor.userId, next);
		return { message: 'Password changed.' };
	}
};
