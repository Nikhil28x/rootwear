import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { can } from '$lib/server/admin/roles';
import { staffActor } from '$lib/server/admin/session';
import { amountInWords, findDocument } from '$lib/server/orders/invoices';

/** One invoice or credit note, ready to print or save as PDF. */
export const load: PageServerLoad = async (event) => {
	const actor = await staffActor(event);
	if (!can(actor, 'finance.view') && !can(actor, 'orders.view'))
		error(403, 'You need orders or finance access to see invoices.');
	const doc = await findDocument(event.params.id);
	if (!doc) error(404, 'No such invoice.');
	return { doc, words: amountInWords(doc.totals.total) };
};
