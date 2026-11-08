import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireSection } from '$lib/server/admin/roles';
import { actorLabel, staffActor } from '$lib/server/admin/session';
import {
	addExclusion,
	deleteRate,
	listShipping,
	removeExclusion,
	saveRate,
	ShippingError
} from '$lib/server/settings-shipping';
import { rupeesToPaise } from '$lib/server/catalogue/forms';
import { DEFAULT_DELIVERY, getSetting, saveSetting } from '$lib/server/settings';

export const load: PageServerLoad = async (event) => {
	const actor = await staffActor(event);
	requireSection(actor, 'settings');
	const [shipping, delivery] = await Promise.all([
		listShipping(),
		getSetting('delivery').catch(() => DEFAULT_DELIVERY)
	]);
	return { ...shipping, delivery };
};

async function run(
	event: Parameters<Actions[string]>[0],
	work: (form: FormData, actor: string) => Promise<string>
) {
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
	/** What customers are told about delivery, and where tracking links go. */
	delivery: (event) =>
		run(event, async (form, actor) => {
			const days = Number(t(form, 'days'));
			if (!Number.isInteger(days) || days < 1 || days > 30)
				throw new ShippingError('Delivery time is a whole number of days, 1 to 30.');
			const trackingUrl = t(form, 'trackingUrl');
			if (trackingUrl) {
				let ok = false;
				try {
					ok = new URL(trackingUrl.replace('{ref}', 'X')).protocol === 'https:';
				} catch {
					ok = false;
				}
				if (!ok || !trackingUrl.includes('{ref}'))
					throw new ShippingError('The tracking link must be an https:// address containing {ref}.');
			}
			await saveSetting('delivery', { days, trackingUrl }, actor);
			return 'Delivery details saved.';
		}),
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
