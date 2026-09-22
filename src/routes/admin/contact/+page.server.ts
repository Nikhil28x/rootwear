import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad, RequestEvent } from './$types';
import { adminRepo } from '$lib/server/admin';
import { CONTACT_STATUSES, type ContactStatus } from '$lib/server/admin/types';
import { requireSection } from '$lib/server/admin/roles';
import { actorLabel, resolveAdminAuth } from '$lib/server/admin/session';

/**
 * RW-163 — Contact submissions.
 *
 * §11 names email and Instagram DM as the support channels; the form is the
 * third, and its submissions are stored so nothing is lost in an inbox. Three
 * statuses, no more: new, in progress, closed.
 *
 * §12 puts this behind the owner role — a submission carries a name, an email
 * and whatever the sender chose to write, which is a customer record.
 *
 * Suspected spam is kept, never deleted, and shown in its own section rather
 * than mixed in: a false positive that silently disappears is a lost customer.
 */
async function requireStaff(event: RequestEvent) {
	const auth = await resolveAdminAuth(event);
	if (auth.status !== 'staff') error(403, 'Staff access required.');
	requireSection(auth.actor, 'contact');
	return auth.actor;
}

export const load: PageServerLoad = async (event) => {
	await requireStaff(event);

	const statusParam = event.url.searchParams.get('status');
	const status = (CONTACT_STATUSES as readonly string[]).includes(statusParam ?? '')
		? (statusParam as ContactStatus)
		: undefined;

	const all = await adminRepo.listContact({ status });

	return {
		now: event.locals.now,
		submissions: all.filter((row) => !row.isSpam),
		spam: all.filter((row) => row.isSpam),
		statuses: CONTACT_STATUSES,
		filter: { status: status ?? '' }
	};
};

export const actions: Actions = {
	setStatus: async (event) => {
		const actor = await requireStaff(event);
		const form = await event.request.formData();

		const id = String(form.get('id') ?? '');
		const statusValue = String(form.get('status') ?? '');
		if (!id || !(CONTACT_STATUSES as readonly string[]).includes(statusValue)) {
			return fail(400, { ok: false, message: 'Unknown submission or status.' });
		}

		try {
			await adminRepo.setContactStatus({
				id,
				status: statusValue as ContactStatus,
				actor: actorLabel(actor)
			});
		} catch (cause) {
			return fail(409, {
				ok: false,
				message: cause instanceof Error ? cause.message : 'Status write failed.'
			});
		}

		return { ok: true, message: `Marked ${statusValue.replace(/_/g, ' ')}.` };
	}
};
