import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad, RequestEvent } from './$types';
import { can, requirePermission, requireSection } from '$lib/server/admin/roles';
import { actorLabel, staffActor } from '$lib/server/admin/session';
import {
	assign,
	getLead,
	LEAD_STAGES,
	LeadError,
	leadOwners,
	log,
	replyWhatsApp,
	sendEmail,
	setFollowUp,
	setStage,
	updateDetails,
	type LeadStage
} from '$lib/server/leads/admin';
import { channelStatus } from '$lib/server/messaging/config';
import { parseIstInput } from '$lib/components/admin/tone';

export const load: PageServerLoad = async (event) => {
	const actor = await staffActor(event);
	requireSection(actor, 'leads');
	const lead = await getLead(event.params.id, event.locals.now);
	if (!lead) error(404, 'No such lead.');
	return {
		lead,
		owners: await leadOwners(),
		now: event.locals.now,
		me: actor.email,
		added: event.url.searchParams.has('added'),
		channels: Object.fromEntries(channelStatus().map((c) => [c.channel, c.configured])) as Record<'email' | 'whatsapp', boolean>,
		canEdit: can(actor, 'leads.edit'),
		canOrders: can(actor, 'orders.view')
	};
};

async function run(event: RequestEvent, work: (form: FormData, actor: string) => Promise<string | void>) {
	const actor = await staffActor(event);
	requirePermission(actor, 'leads.edit');
	const form = await event.request.formData();
	try {
		const message = await work(form, actorLabel(actor));
		return message ? { message } : {};
	} catch (err) {
		if (err instanceof LeadError) return fail(400, { error: err.message });
		throw err;
	}
}

const text = (form: FormData, name: string) => String(form.get(name) ?? '').trim();

export const actions: Actions = {
	stage: (event) =>
		run(event, async (form, actor) => {
			const stage = text(form, 'stage') as LeadStage;
			if (!LEAD_STAGES.includes(stage)) throw new LeadError('Unknown stage.');
			await setStage({ id: event.params.id, stage, lostReason: text(form, 'lostReason') || null, actor });
			return `Moved to ${stage}.`;
		}),

	assign: (event) =>
		run(event, async (form, actor) => {
			await assign({ id: event.params.id, owner: text(form, 'owner') || null, actor });
			return text(form, 'owner') ? `Assigned to ${text(form, 'owner')}.` : 'Unassigned.';
		}),

	followUp: (event) =>
		run(event, async (form, actor) => {
			const raw = text(form, 'date');
			const at = raw ? parseIstInput(`${raw}T10:00`) : null;
			if (raw && at === null) throw new LeadError('Pick a date.');
			await setFollowUp({ id: event.params.id, at, note: text(form, 'note') || null, actor });
			return at ? 'Follow-up set.' : 'Follow-up cleared.';
		}),

	log: (event) =>
		run(event, async (form, actor) => {
			const kind = text(form, 'kind') === 'call' ? 'call' : 'note';
			await log({ id: event.params.id, kind, body: text(form, 'body'), actor });
			return kind === 'call' ? 'Call logged.' : 'Note added.';
		}),

	email: (event) =>
		run(event, async (form, actor) => {
			const message = await sendEmail({
				id: event.params.id,
				subject: text(form, 'subject'),
				message: text(form, 'message'),
				actor,
				now: event.locals.now
			});
			if (message.status === 'sent') return 'Email sent.';
			if (message.status === 'queued') return 'Email queued; it will go out shortly.';
			throw new LeadError(`Not sent: ${message.lastError ?? message.status}`);
		}),

	whatsapp: (event) =>
		run(event, async (form, actor) => {
			await replyWhatsApp({ id: event.params.id, text: text(form, 'message'), actor, now: event.locals.now });
			return 'Sent on WhatsApp.';
		}),

	details: (event) =>
		run(event, async (form, actor) => {
			await updateDetails({
				id: event.params.id,
				name: text(form, 'name') || null,
				email: text(form, 'email') || null,
				phone: text(form, 'phone') || null,
				instagram: text(form, 'instagram') || null,
				interest: text(form, 'interest') || null,
				consentEmail: form.get('consentEmail') === 'on',
				consentWhatsapp: form.get('consentWhatsapp') === 'on',
				actor
			});
			return 'Saved.';
		})
};
