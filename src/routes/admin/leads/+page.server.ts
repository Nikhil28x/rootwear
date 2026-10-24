import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { can, requirePermission, requireSection } from '$lib/server/admin/roles';
import { actorLabel, staffActor } from '$lib/server/admin/session';
import {
	captureLead,
	LEAD_PAGE_SIZE,
	LEAD_SOURCES,
	LEAD_STAGES,
	LeadError,
	leadOwners,
	listLeads,
	setFollowUp,
	stageCounts,
	assign,
	type LeadSource,
	type LeadStage
} from '$lib/server/leads/admin';
import { parseIstInput } from '$lib/components/admin/tone';

export const load: PageServerLoad = async (event) => {
	const actor = await staffActor(event);
	requireSection(actor, 'leads');
	const p = event.url.searchParams;
	const view = p.get('view') ?? 'open';
	const filters = {
		q: p.get('q') ?? '',
		source: p.get('source') ?? '',
		owner: p.get('owner') ?? '',
		layout: p.get('layout') ?? 'board'
	};
	const page = Math.max(1, Number(p.get('page')) || 1);
	const stage: LeadStage | 'open' | undefined =
		view === 'open'
			? 'open'
			: (LEAD_STAGES as readonly string[]).includes(view)
				? (view as LeadStage)
				: undefined;
	const now = event.locals.now;

	const [result, counts, owners] = await Promise.all([
		listLeads(
			{
				stage: view === 'due' ? undefined : stage,
				due: view === 'due',
				source: (LEAD_SOURCES.some((s) => s.value === filters.source)
					? filters.source
					: undefined) as LeadSource | undefined,
				owner: filters.owner === 'me' ? actor.email : filters.owner || undefined,
				search: filters.q || undefined
			},
			page,
			now
		),
		stageCounts(now),
		leadOwners()
	]);

	return {
		...result,
		view,
		filters,
		page,
		pageSize: LEAD_PAGE_SIZE,
		counts,
		owners,
		sources: LEAD_SOURCES,
		me: actor.email,
		now,
		canEdit: can(actor, 'leads.edit')
	};
};

export const actions: Actions = {
	add: async (event) => {
		const actor = await staffActor(event);
		requirePermission(actor, 'leads.edit');
		const form = await event.request.formData();
		const text = (n: string) => String(form.get(n) ?? '').trim();
		const source = text('source') as LeadSource;
		if (!LEAD_SOURCES.some((s) => s.value === source))
			return fail(400, { error: 'Pick where they came from.' });
		let id: string;
		try {
			const result = await captureLead({
				name: text('name') || null,
				email: text('email') || null,
				phone: text('phone') || null,
				instagram: text('instagram') || null,
				source,
				sourceDetail: text('sourceDetail') || null,
				interest: text('interest') || null,
				consentWhatsapp: form.get('consentWhatsapp') === 'on',
				consentEmail: form.get('consentEmail') === 'on',
				actor: actorLabel(actor),
				activity: { kind: 'created', body: text('note') || `Added by ${actor.name ?? actor.email}` }
			});
			if (!result) return fail(400, { error: 'That lead already exists.' });
			id = result.id;
			const follow = text('followUp') ? parseIstInput(`${text('followUp')}T10:00`) : null;
			if (follow) await setFollowUp({ id, at: follow, note: null, actor: actorLabel(actor) });
			if (form.get('assignMe') === 'on')
				await assign({ id, owner: actor.email, actor: actorLabel(actor) });
			if (!result.created) {
				return {
					message: 'They were already a lead, so this was added to their history.',
					leadId: id
				};
			}
		} catch (err) {
			if (err instanceof LeadError) return fail(400, { error: err.message });
			throw err;
		}
		redirect(303, `/admin/leads/${id}?added=1`);
	}
};
