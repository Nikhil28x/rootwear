import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireSection } from '$lib/server/admin/roles';
import { actorLabel, staffActor } from '$lib/server/admin/session';
import { getSetting, saveSetting } from '$lib/server/settings';
import { getServiceClient } from '$lib/server/db/clients';
import { writeAudit } from '$lib/server/admin/audit';
import { sendDigest } from '$lib/server/alerts';

export const load: PageServerLoad = async (event) => {
	const actor = await staffActor(event);
	requireSection(actor, 'settings');
	const { data } = await getServiceClient()
		.from('staff')
		.select('user_id, email, display_name, daily_digest')
		.eq('active', true)
		.order('created_at');
	return {
		alerts: await getSetting('alerts'),
		staff: (data ?? []) as {
			user_id: string;
			email: string | null;
			display_name: string | null;
			daily_digest: boolean;
		}[]
	};
};

export const actions: Actions = {
	save: async (event) => {
		const actor = await staffActor(event);
		requireSection(actor, 'settings');
		const form = await event.request.formData();
		const lowStock = Number(form.get('lowStock'));
		if (!Number.isInteger(lowStock) || lowStock < 0 || lowStock > 50)
			return fail(400, { error: 'Low stock is a whole number from 0 to 50.' });
		await saveSetting('alerts', { lowStock }, actorLabel(actor));
		const chosen = new Set(form.getAll('digest').map(String));
		const { data } = await getServiceClient()
			.from('staff')
			.select('user_id, daily_digest')
			.eq('active', true);
		for (const s of (data ?? []) as { user_id: string; daily_digest: boolean }[]) {
			const want = chosen.has(s.user_id);
			if (want !== s.daily_digest)
				await getServiceClient()
					.from('staff')
					.update({ daily_digest: want })
					.eq('user_id', s.user_id);
		}
		await writeAudit(actorLabel(actor), 'digest recipients changed', 'settings', 'alerts', {
			recipients: chosen.size
		});
		return { message: 'Saved.' };
	},
	test: async (event) => {
		const actor = await staffActor(event);
		requireSection(actor, 'settings');
		const sent = await sendDigest(event.locals.now);
		return sent
			? { message: `Today’s digest sent to ${sent} ${sent === 1 ? 'person' : 'people'}.` }
			: fail(400, { error: 'Nobody gets the digest yet. Tick someone and save first.' });
	}
};
