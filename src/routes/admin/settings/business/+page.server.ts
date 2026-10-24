import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireSection } from '$lib/server/admin/roles';
import { actorLabel, staffActor } from '$lib/server/admin/session';
import { getSetting, GST_STATES, saveSetting, type BusinessSettings } from '$lib/server/settings';

const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PAN = /^[A-Z]{5}\d{4}[A-Z]$/;

export const load: PageServerLoad = async (event) => {
	const actor = await staffActor(event);
	requireSection(actor, 'settings');
	return { business: await getSetting('business'), states: GST_STATES };
};

export const actions: Actions = {
	default: async (event) => {
		const actor = await staffActor(event);
		requireSection(actor, 'settings');
		const form = await event.request.formData();
		const text = (name: string) => String(form.get(name) ?? '').trim();

		const state = GST_STATES.find((s) => s.name === text('state'));
		const value: BusinessSettings = {
			legalName: text('legalName'),
			tradeName: text('tradeName'),
			entityType: text('entityType'),
			address: text('address'),
			state: state?.name ?? '',
			stateCode: state?.code ?? '',
			email: text('email'),
			phone: text('phone'),
			instagram: text('instagram'),
			gstRegistered: form.get('gstRegistered') === 'on',
			gstin: text('gstin').toUpperCase(),
			pan: text('pan').toUpperCase(),
			invoicePrefix: text('invoicePrefix').toUpperCase(),
			invoiceFooter: text('invoiceFooter'),
			signatory: text('signatory')
		};

		const errors: Record<string, string> = {};
		if (!value.legalName) errors.legalName = 'Enter the registered business name.';
		if (!value.address) errors.address = 'Enter the registered address; it is printed on every invoice.';
		if (!state) errors.state = 'Pick the state the business is registered in.';
		if (!/^[A-Z0-9]{1,6}$/.test(value.invoicePrefix)) errors.invoicePrefix = 'Use 1–6 letters or digits, e.g. RW.';
		if (value.gstRegistered) {
			if (!GSTIN.test(value.gstin)) errors.gstin = 'A GSTIN is 15 characters, like 29ABCDE1234F1Z5.';
			else if (state && value.gstin.slice(0, 2) !== state.code) {
				errors.gstin = `This GSTIN is for state code ${value.gstin.slice(0, 2)}, not ${state.name} (${state.code}).`;
			}
		}
		if (value.pan && !PAN.test(value.pan)) errors.pan = 'A PAN is 10 characters, like ABCDE1234F.';

		if (Object.keys(errors).length) return fail(400, { errors, error: 'Check the highlighted fields.' });
		await saveSetting('business', value, actorLabel(actor));
		return { message: value.gstRegistered ? 'Saved. New invoices are GST tax invoices.' : 'Saved.' };
	}
};
