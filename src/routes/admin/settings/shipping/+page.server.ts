import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireSection } from '$lib/server/admin/roles';
import { actorLabel, staffActor } from '$lib/server/admin/session';
import { addExclusion, deleteRate, listShipping, removeExclusion, saveRate, ShippingError } from '$lib/server/settings-shipping';
import { rupeesToPaise } from '$lib/server/catalogue/forms';

export const load: PageServerLoad = async (event) => {
	const actor = await staffActor(event);
	requireSection(actor, 'settings');
	return listShipping();
};

async function run(event: Parameters<Actions[string]>[0], work: (form: FormData, actor: string) => Promise<string>) {
	const actor = await staffActor(event);
	requireSection(actor, 'settings');
	const form = await event.request.formData();
	try {
		return { message: await work(form, actorLabel(actor)) };
	} catch (err) {
		if (err instanceof ShippingError) return fail(400, { error: err.message });
		throw err;
	}
}

const t = (f: FormData, n: string) => String(f.get(n) ?? '').trim();

export const actions: Actions = {
	rate: (event) =>
		run(event, async (form, actor) => {
			await saveRate({
				id: t(form, 'id') || null,
				name: t(form, 'name'),
				min: t(form, 'min') ? rupeesToPaise(t(form, 'min')) : 0,
				max: t(form, 'max') ? rupeesToPaise(t(form, 'max')) : null,
				rate: t(form, 'rate') ? rupeesToPaise(t(form, 'rate')) : 0,
				active: form.get('active') === 'on',
				actor
			});
			return 'Rate saved. Checkout uses it straight away.';
		}),
	deleteRate: (event) =>
		run(event, async (form, actor) => {
			await deleteRate(t(form, 'id'), actor);
			return 'Rate removed.';
		}),
	block: (event) =>
		run(event, async (form, actor) => {
			await addExclusion({ pincode: t(form, 'pincode'), reason: t(form, 'reason'), actor });
			return 'Blocked. Checkout will refuse those pincodes with your reason.';
		}),
	unblock: (event) =>
		run(event, async (form, actor) => {
			await removeExclusion(t(form, 'pincode'), actor);
			return 'Unblocked.';
		})
};
