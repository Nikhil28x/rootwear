import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requirePermission, requireSection } from '$lib/server/admin/roles';
import { actorLabel, staffActor } from '$lib/server/admin/session';
import {
	getTemplate,
	SAMPLE_VARIABLES,
	saveTemplate,
	TemplateError
} from '$lib/server/messaging/templates';

export const load: PageServerLoad = async (event) => {
	const actor = await staffActor(event);
	requireSection(actor, 'messages');
	const template = await getTemplate(event.params.key);
	if (!template) error(404, 'No such template.');
	return {
		template,
		samples: SAMPLE_VARIABLES,
		canEdit: actor.isOwner || actor.permissions.includes('messages.edit')
	};
};

export const actions: Actions = {
	save: async (event) => {
		const actor = await staffActor(event);
		requirePermission(actor, 'messages.edit');
		const form = await event.request.formData();
		try {
			await saveTemplate({
				key: event.params.key,
				subject: String(form.get('subject') ?? '') || null,
				body: String(form.get('body') ?? ''),
				waTemplateName: String(form.get('waTemplateName') ?? '').trim() || null,
				waLanguage: String(form.get('waLanguage') ?? 'en').trim(),
				waParams: String(form.get('waParams') ?? '')
					.split(',')
					.map((p) => p.trim())
					.filter(Boolean),
				active: form.get('active') === 'on',
				actor: actorLabel(actor)
			});
		} catch (err) {
			if (err instanceof TemplateError) return fail(400, { error: err.message });
			throw err;
		}
		return { message: 'Template saved. New messages use it straight away.' };
	}
};
