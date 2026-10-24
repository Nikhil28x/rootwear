import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { can, requireSection } from '$lib/server/admin/roles';
import { staffActor } from '$lib/server/admin/session';
import { getOrder } from '$lib/server/orders/admin';
import { amountInWords, issueInvoice } from '$lib/server/orders/invoices';
import { getSetting } from '$lib/server/settings';

/**
 * Printing for a batch of orders: packing slips, address labels (4 per A4
 * sheet) or invoices. Opened in a new tab from the orders list.
 */
export const load: PageServerLoad = async (event) => {
	const actor = await staffActor(event);
	requireSection(actor, 'orders');
	const requested = event.url.searchParams.get('kind');
	if (requested !== 'packing' && requested !== 'label' && requested !== 'invoice')
		error(400, 'Pick what to print.');
	const kind: 'packing' | 'label' | 'invoice' = requested;
	const ids = (event.url.searchParams.get('ids') ?? '').split(',').filter(Boolean).slice(0, 100);
	if (!ids.length) error(400, 'Select orders to print.');

	const orders = (await Promise.all(ids.map((id) => getOrder(id)))).filter((o) => o !== null);
	const business = await getSetting('business');

	const invoices =
		kind === 'invoice'
			? (
					await Promise.all(
						orders.map((o) =>
							can(actor, 'finance.view') || can(actor, 'orders.view')
								? issueInvoice(o.id, 'print')
								: null
						)
					)
				)
					.filter((d) => d !== null)
					.map((doc) => ({ doc, words: amountInWords(doc.totals.total) }))
			: [];

	return {
		kind,
		from: {
			name: business.tradeName,
			address: business.address,
			phone: business.phone,
			email: business.email
		},
		orders: orders.map((o) => ({
			id: o.id,
			number: o.number,
			createdAt: o.createdAt,
			shipTo: o.shipTo,
			customerNote: o.customerNote,
			isPreOrder: o.isPreOrder,
			lines: o.lines.map((l) => ({
				name: l.name,
				variant: l.variant,
				sku: l.sku,
				quantity: l.quantity,
				pieceNumber: l.pieceNumber
			}))
		})),
		invoices
	};
};
