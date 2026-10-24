import type { RequestHandler } from './$types';
import { requireSection } from '$lib/server/admin/roles';
import { staffActor } from '$lib/server/admin/session';
import { csvResponse, toCsv } from '$lib/server/admin/csv';
import { listDocuments } from '$lib/server/orders/invoices';
import { readRegisterFilter } from '$lib/server/orders/register';

/**
 * The sales register for the accountant: one row per invoice or credit note,
 * with taxable value and tax split, in rupees. Credit notes are negative so
 * the column totals are the period's net figures.
 */
export const GET: RequestHandler = async (event) => {
	const actor = await staffActor(event);
	requireSection(actor, 'invoices');
	const { filter } = readRegisterFilter(event.url.searchParams);
	const { documents } = await listDocuments({ ...filter, page: 1, all: true });
	const r = (paise: number, sign: number) => ((sign * paise) / 100).toFixed(2);
	const date = (ms: number) =>
		new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(ms);
	const body = toCsv(
		['Date', 'Type', 'Number', 'Against', 'Order', 'Customer', 'State', 'State code', 'GST registered', 'Taxable (₹)', 'CGST (₹)', 'SGST (₹)', 'IGST (₹)', 'Total (₹)'],
		[...documents]
			.sort((a, b) => a.issuedAt - b.issuedAt)
			.map((d) => {
				const sign = d.kind === 'credit_note' ? -1 : 1;
				return [
					date(d.issuedAt),
					d.kind === 'invoice' ? 'Invoice' : 'Credit note',
					d.number,
					d.against ?? '',
					d.orderNumber,
					d.buyer.name,
					d.buyer.state ?? '',
					d.buyer.stateCode ?? '',
					d.gstRegistered ? 'yes' : 'no',
					r(d.totals.taxable, sign),
					r(d.totals.cgst, sign),
					r(d.totals.sgst, sign),
					r(d.totals.igst, sign),
					r(d.totals.total, sign)
				];
			})
	);
	return csvResponse(`rootwear-sales-register-${new Date().toISOString().slice(0, 10)}.csv`, body);
};
