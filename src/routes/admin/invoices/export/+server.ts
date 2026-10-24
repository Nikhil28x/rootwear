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
	const stamp = new Date().toISOString().slice(0, 10);
	const type = event.url.searchParams.get('type');

	// GSTR-1 needs net figures per HSN code and per state of supply. Credit
	// notes count negative, so each row is the period's net.
	if (type === 'hsn' || type === 'states') {
		const groups = new Map<string, { key: string[]; qty: number; taxable: number; cgst: number; sgst: number; igst: number; total: number }>();
		for (const d of documents) {
			const sign = d.kind === 'credit_note' ? -1 : 1;
			const parts =
				type === 'hsn'
					? d.lines.map((l) => ({ key: [l.hsn ?? '', String(l.taxRate)], line: l }))
					: d.lines.map((l) => ({ key: [d.buyer.state ?? '', d.buyer.stateCode ?? '', String(l.taxRate)], line: l }));
			for (const { key, line } of parts) {
				const id = key.join('|');
				const g = groups.get(id) ?? { key, qty: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
				g.qty += sign * line.quantity;
				g.taxable += sign * line.taxable;
				g.cgst += sign * line.cgst;
				g.sgst += sign * line.sgst;
				g.igst += sign * line.igst;
				g.total += sign * line.gross;
				groups.set(id, g);
			}
		}
		const rows = [...groups.values()].sort((a, b) => a.key.join().localeCompare(b.key.join()));
		const head = type === 'hsn' ? ['HSN/SAC', 'GST rate %', 'Quantity'] : ['State', 'State code', 'GST rate %'];
		return csvResponse(
			`rootwear-${type === 'hsn' ? 'hsn-summary' : 'state-summary'}-${stamp}.csv`,
			toCsv(
				[...head, 'Taxable (₹)', 'CGST (₹)', 'SGST (₹)', 'IGST (₹)', 'Total (₹)'],
				rows.map((g) => [
					...(type === 'hsn' ? [...g.key, g.qty] : g.key),
					r(g.taxable, 1),
					r(g.cgst, 1),
					r(g.sgst, 1),
					r(g.igst, 1),
					r(g.total, 1)
				])
			)
		);
	}
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
	return csvResponse(`rootwear-sales-register-${stamp}.csv`, body);
};
