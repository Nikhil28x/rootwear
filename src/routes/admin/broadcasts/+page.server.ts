import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireSection } from '$lib/server/admin/roles';
import { actorLabel, staffActor } from '$lib/server/admin/session';
import { AUDIENCES, BroadcastError, listBroadcasts, preview, sendBroadcast, type Audience } from '$lib/server/marketing/broadcasts';
import { listDrops } from '$lib/server/catalogue/admin';
import { channelStatus } from '$lib/server/messaging/config';

export const load: PageServerLoad = async (event) => {
	const actor = await staffActor(event);
	requireSection(actor, 'broadcasts');
	const drops = await listDrops();
	return {
		broadcasts: await listBroadcasts(),
		drops: drops.map((d) => ({ id: d.id, label: `Drop ${String(d.number).padStart(2, '0')} — ${d.name}`, state: d.state })),
		audiences: AUDIENCES,
		channels: Object.fromEntries(channelStatus().map((c) => [c.channel, c.configured])) as Record<'email' | 'whatsapp', boolean>
	};
};

function read(form: FormData) {
	const audiences = form.getAll('audiences').map(String).filter((a): a is Audience => AUDIENCES.some((x) => x.value === a));
	return {
		name: String(form.get('name') ?? ''),
		dropId: String(form.get('dropId') ?? '') || null,
		audiences,
		channels: form.getAll('channels').map(String).filter((c): c is 'email' | 'whatsapp' => c === 'email' || c === 'whatsapp'),
		kind: (form.get('kind') === 'custom' ? 'custom' : 'drop_live') as 'custom' | 'drop_live',
		subject: String(form.get('subject') ?? ''),
		message: String(form.get('message') ?? '')
	};
}

export const actions: Actions = {
	preview: async (event) => {
		const actor = await staffActor(event);
		requireSection(actor, 'broadcasts');
		const input = read(await event.request.formData());
		return { preview: await preview(input) };
	},
	send: async (event) => {
		const actor = await staffActor(event);
		requireSection(actor, 'broadcasts');
		try {
			const { queued } = await sendBroadcast(read(await event.request.formData()), actorLabel(actor));
			return { message: `Sending ${queued} message${queued === 1 ? '' : 's'}. Progress shows below.`, sent: true };
		} catch (err) {
			if (err instanceof BroadcastError) return fail(400, { error: err.message });
			throw err;
		}
	}
};
