import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getServiceClient } from '$lib/server/db/clients';
import { catalogueSource } from '$lib/server/env';
import { amountInWords, issueInvoice } from '$lib/server/orders/invoices';

/**
 * The customer's invoice, at the same unguessable token as their order page
 * (/order/<token>), so it needs no account. Issued on first view if the
 * webhook had not got to it yet.
 */
export const load: PageServerLoad = async ({ params }) => {
	if (catalogueSource() !== 'supabase') error(404, 'Invoices are available once the order is stored.');
	const { data } = await getServiceClient()
		.from('orders')
		.select('id, state')
		.eq('public_token', params.token)
		.maybeSingle();
	if (!data) error(404, 'No such order.');
	const doc = await issueInvoice((data as { id: string }).id);
	if (!doc) error(404, 'The invoice is issued once the payment is confirmed.');
	return { doc, words: amountInWords(doc.totals.total) };
};
