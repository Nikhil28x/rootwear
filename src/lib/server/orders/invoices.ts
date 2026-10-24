/**
 * Invoices and credit notes.
 *
 * §10: displayed prices are INCLUSIVE of tax. While Rootwear is not GST
 * registered the invoice is a plain invoice with no tax break-up; once the
 * GSTIN is entered in Settings → Business & GST, new invoices are tax
 * invoices: taxable value and tax per line, CGST + SGST inside Karnataka and
 * IGST elsewhere, the GSTIN, HSN codes and the amount in words.
 *
 * A document is FROZEN when issued (app.invoices stores seller, buyer, lines
 * and totals), so reprinting it later shows exactly what was issued. Numbers
 * run per financial year without gaps: RW/26-27/0001, credit notes
 * RW/CN/26-27/0001.
 */
import { getServiceClient } from '$lib/server/db/clients';
import { getSetting, gstStateOf, type BusinessSettings } from '$lib/server/settings';

export type InvoiceLine = {
	readonly description: string;
	readonly detail: string | null;
	readonly sku: string | null;
	readonly hsn: string | null;
	readonly quantity: number;
	/** Inclusive price per unit, paise. */
	readonly unitPrice: number;
	/** Inclusive line total after its share of any discount, paise. */
	readonly gross: number;
	readonly taxRate: number;
	readonly taxable: number;
	readonly cgst: number;
	readonly sgst: number;
	readonly igst: number;
};

export type InvoiceTotals = {
	readonly subtotal: number;
	readonly shipping: number;
	readonly discount: number;
	readonly taxable: number;
	readonly cgst: number;
	readonly sgst: number;
	readonly igst: number;
	readonly total: number;
};

export type InvoiceParty = {
	readonly name: string;
	readonly address: string;
	readonly state: string | null;
	readonly stateCode: string | null;
	readonly gstin: string | null;
	readonly email: string | null;
	readonly phone: string | null;
};

export type InvoiceDocument = {
	readonly id: string;
	readonly orderId: string;
	readonly orderNumber: string;
	readonly kind: 'invoice' | 'credit_note';
	readonly number: string;
	readonly issuedAt: number;
	readonly gstRegistered: boolean;
	readonly intraState: boolean;
	readonly seller: InvoiceParty & { legalName: string; tradeName: string; footer: string; signatory: string; pan: string };
	readonly buyer: InvoiceParty;
	readonly lines: readonly InvoiceLine[];
	readonly totals: InvoiceTotals;
	/** For a credit note: the invoice it reduces. */
	readonly against: string | null;
};

/* ------------------------------------------------------------------------ */
/* Arithmetic                                                                */
/* ------------------------------------------------------------------------ */

/** Splits an inclusive amount into taxable value and tax at `rate` percent. */
export function splitInclusive(gross: number, rate: number): { taxable: number; tax: number } {
	if (rate <= 0) return { taxable: gross, tax: 0 };
	const taxable = Math.round((gross * 100) / (100 + rate));
	return { taxable, tax: gross - taxable };
}

type RawLine = {
	description: string;
	detail: string | null;
	sku: string | null;
	hsn: string | null;
	quantity: number;
	unitPrice: number;
	taxRate: number;
};

/**
 * The tax arithmetic of a document. The discount is shared across the goods
 * by value; shipping is a line of its own taxed at the highest goods rate
 * (a composite supply follows its principal supply). Every figure is whole
 * paise and the lines always add up to the order total exactly.
 */
export function computeLines(
	raw: readonly RawLine[],
	shipping: number,
	discount: number,
	gstRegistered: boolean,
	intraState: boolean
): { lines: InvoiceLine[]; totals: InvoiceTotals } {
	const subtotal = raw.reduce((n, l) => n + l.unitPrice * l.quantity, 0);
	let discountLeft = Math.min(discount, subtotal);

	const goods = raw.map((line, index) => {
		const value = line.unitPrice * line.quantity;
		const share =
			index === raw.length - 1 ? discountLeft : Math.round((discount * value) / Math.max(subtotal, 1));
		discountLeft -= share;
		return { ...line, gross: value - share };
	});

	const principalRate = Math.max(0, ...raw.map((l) => l.taxRate));
	const all = shipping > 0
		? [
				...goods,
				{
					description: 'Shipping',
					detail: null,
					sku: null,
					hsn: '996812',
					quantity: 1,
					unitPrice: shipping,
					taxRate: principalRate,
					gross: shipping
				}
			]
		: goods;

	const lines: InvoiceLine[] = all.map((line) => {
		const rate = gstRegistered ? line.taxRate : 0;
		const { taxable, tax } = splitInclusive(line.gross, rate);
		const cgst = gstRegistered && intraState ? Math.floor(tax / 2) : 0;
		return {
			description: line.description,
			detail: line.detail,
			sku: line.sku,
			hsn: line.hsn,
			quantity: line.quantity,
			unitPrice: line.unitPrice,
			gross: line.gross,
			taxRate: rate,
			taxable,
			cgst,
			sgst: gstRegistered && intraState ? tax - cgst : 0,
			igst: gstRegistered && !intraState ? tax : 0
		};
	});

	const sum = (pick: (l: InvoiceLine) => number) => lines.reduce((n, l) => n + pick(l), 0);
	return {
		lines,
		totals: {
			subtotal,
			shipping,
			discount,
			taxable: sum((l) => l.taxable),
			cgst: sum((l) => l.cgst),
			sgst: sum((l) => l.sgst),
			igst: sum((l) => l.igst),
			total: sum((l) => l.gross)
		}
	};
}

/** India's financial year for an instant, as printed: "26-27". IST. */
export function financialYear(ms: number): string {
	const ist = new Date(ms + 5.5 * 3_600_000);
	const year = ist.getUTCFullYear();
	const start = ist.getUTCMonth() >= 3 ? year : year - 1;
	return `${String(start).slice(2)}-${String(start + 1).slice(2)}`;
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n: number): string {
	return n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`;
}

function threeDigits(n: number): string {
	const hundred = Math.floor(n / 100);
	const rest = n % 100;
	return [hundred ? `${ONES[hundred]} Hundred` : '', rest ? twoDigits(rest) : ''].filter(Boolean).join(' ');
}

/** 410050 paise → "Rupees Four Thousand One Hundred and Paise Fifty Only" (Indian grouping). */
export function amountInWords(paise: number): string {
	const rupees = Math.floor(paise / 100);
	const fraction = paise % 100;
	const parts: string[] = [];
	const crore = Math.floor(rupees / 10_000_000);
	const lakh = Math.floor((rupees % 10_000_000) / 100_000);
	const thousand = Math.floor((rupees % 100_000) / 1000);
	const rest = rupees % 1000;
	if (crore) parts.push(`${threeDigits(crore)} Crore`);
	if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
	if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
	if (rest) parts.push(threeDigits(rest));
	const words = parts.join(' ') || 'Zero';
	return `Rupees ${words}${fraction ? ` and Paise ${twoDigits(fraction)}` : ''} Only`;
}

/* ------------------------------------------------------------------------ */
/* Issuing                                                                   */
/* ------------------------------------------------------------------------ */

type OrderForInvoice = {
	id: string;
	order_number: string;
	state: string;
	subtotal_paise: number;
	shipping_paise: number;
	discount_paise: number;
	total_paise: number;
	ship_name: string;
	ship_line1: string;
	ship_line2: string | null;
	ship_city: string;
	ship_state: string;
	ship_pincode: string;
	ship_phone: string;
	customer_id: string;
	created_at: string;
};

type LineForInvoice = {
	id: string;
	quantity: number;
	unit_price_paise: number;
	sku_snapshot: string;
	name_snapshot: string;
	variant_snapshot: string | null;
	hsn_snapshot: string | null;
	gst_rate_snapshot: number | string | null;
	piece_number: number | null;
};

function sellerOf(business: BusinessSettings) {
	return {
		legalName: business.legalName,
		tradeName: business.tradeName,
		name: business.legalName,
		address: business.address,
		state: business.state,
		stateCode: business.stateCode,
		gstin: business.gstRegistered ? business.gstin : null,
		pan: business.pan,
		email: business.email,
		phone: business.phone || null,
		footer: business.invoiceFooter,
		signatory: business.signatory
	};
}

async function loadOrder(orderId: string) {
	const client = getServiceClient();
	const { data: order, error } = await client.from('orders').select('*').eq('id', orderId).maybeSingle();
	if (error) throw new Error(`order read failed: ${error.message}`);
	if (!order) return null;
	const o = order as OrderForInvoice;
	const [{ data: lines }, { data: customer }] = await Promise.all([
		client.from('order_lines').select('*').eq('order_id', orderId),
		client.from('customers').select('email, phone').eq('id', o.customer_id).maybeSingle()
	]);
	return {
		order: o,
		lines: (lines ?? []) as LineForInvoice[],
		customer: (customer ?? { email: null, phone: null }) as { email: string | null; phone: string | null }
	};
}

function buyerOf(order: OrderForInvoice, customer: { email: string | null; phone: string | null }): InvoiceParty {
	const state = gstStateOf(order.ship_state);
	return {
		name: order.ship_name,
		address: [order.ship_line1, order.ship_line2, `${order.ship_city} ${order.ship_pincode}`, order.ship_state]
			.filter(Boolean)
			.join(', '),
		state: state?.name ?? order.ship_state,
		stateCode: state?.code ?? null,
		gstin: null,
		email: customer.email,
		phone: order.ship_phone || customer.phone
	};
}

function rawLines(lines: LineForInvoice[], fallbackRate: number): RawLine[] {
	return lines.map((line) => ({
		description: line.name_snapshot,
		detail: [line.variant_snapshot, line.piece_number ? `No. ${line.piece_number}` : null].filter(Boolean).join(' · ') || null,
		sku: line.sku_snapshot,
		hsn: line.hsn_snapshot ?? '6109',
		quantity: line.quantity,
		unitPrice: Number(line.unit_price_paise),
		taxRate: line.gst_rate_snapshot === null || line.gst_rate_snapshot === undefined ? fallbackRate : Number(line.gst_rate_snapshot)
	}));
}

type InvoiceRow = {
	id: string;
	order_id: string;
	kind: 'invoice' | 'credit_note';
	number: string;
	issued_at: string;
	gst_registered: boolean;
	seller: InvoiceDocument['seller'];
	buyer: InvoiceParty;
	lines: InvoiceLine[];
	totals: InvoiceTotals & { intra_state?: boolean; against?: string | null; order_number?: string };
};

function toDocument(row: InvoiceRow): InvoiceDocument {
	return {
		id: row.id,
		orderId: row.order_id,
		orderNumber: row.totals.order_number ?? '',
		kind: row.kind,
		number: row.number,
		issuedAt: Date.parse(row.issued_at),
		gstRegistered: row.gst_registered,
		intraState: row.totals.intra_state ?? true,
		seller: row.seller,
		buyer: row.buyer,
		lines: row.lines,
		totals: row.totals,
		against: row.totals.against ?? null
	};
}

/** Orders that can carry an invoice: paid, and everything after paid. */
const INVOICEABLE = ['paid', 'packed', 'dispatched', 'delivered', 'refunded'];

/**
 * Issues the invoice for an order, once. Safe to call repeatedly: the second
 * call returns the invoice the first one issued.
 */
export async function issueInvoice(orderId: string, actor = 'system'): Promise<InvoiceDocument | null> {
	const existing = await invoiceForOrder(orderId);
	if (existing) return existing;

	const loaded = await loadOrder(orderId);
	if (!loaded || !INVOICEABLE.includes(loaded.order.state)) return null;
	const { order, lines, customer } = loaded;

	const business = await getSetting('business');
	const buyer = buyerOf(order, customer);
	const intraState = (buyer.stateCode ?? business.stateCode) === business.stateCode;
	const computed = computeLines(
		rawLines(lines, 5),
		Number(order.shipping_paise),
		Number(order.discount_paise),
		business.gstRegistered,
		intraState
	);

	const client = getServiceClient();
	const issuedAt = Date.now();
	const fy = financialYear(issuedAt);
	const { data: next, error: seqError } = await client.rpc('next_document_number', {
		p_series: `invoice:${business.invoicePrefix}:${fy}`
	});
	if (seqError) throw new Error(`invoice number failed: ${seqError.message}`);
	const number = `${business.invoicePrefix}/${fy}/${String(next).padStart(4, '0')}`;

	const { data, error } = await client
		.from('invoices')
		.insert({
			order_id: orderId,
			kind: 'invoice',
			number,
			issued_at: new Date(issuedAt).toISOString(),
			gst_registered: business.gstRegistered,
			seller: sellerOf(business),
			buyer,
			lines: computed.lines,
			totals: { ...computed.totals, intra_state: intraState, order_number: order.order_number },
			created_by: actor
		})
		.select('*')
		.single();
	if (error) {
		// Two callers raced; the other one won. Theirs is the invoice.
		if (error.code === '23505') return invoiceForOrder(orderId);
		throw new Error(`invoice write failed: ${error.message}`);
	}
	return toDocument(data as InvoiceRow);
}

/**
 * A credit note for a refund: the refunded amount, split across the
 * invoice's lines in proportion, with tax reversed at the same rates.
 */
export async function issueCreditNote(refundId: string, orderId: string, actor = 'system'): Promise<InvoiceDocument | null> {
	const client = getServiceClient();
	const { data: existing } = await client.from('invoices').select('*').eq('refund_id', refundId).maybeSingle();
	if (existing) return toDocument(existing as InvoiceRow);

	const invoice = await issueInvoice(orderId, actor);
	if (!invoice) return null;
	const { data: refund, error: refundError } = await client
		.from('refunds')
		.select('amount_paise, reason')
		.eq('id', refundId)
		.single();
	if (refundError || !refund) throw new Error(`refund read failed: ${refundError?.message}`);
	const amount = Number((refund as { amount_paise: number }).amount_paise);

	// Scale every line by amount / total; the last line takes the rounding.
	const ratio = amount / Math.max(invoice.totals.total, 1);
	let left = amount;
	const raw: RawLine[] = invoice.lines.map((line, index) => {
		const gross = index === invoice.lines.length - 1 ? left : Math.round(line.gross * ratio);
		left -= gross;
		return {
			description: line.description,
			detail: line.detail,
			sku: line.sku,
			hsn: line.hsn,
			quantity: 1,
			unitPrice: gross,
			taxRate: line.taxRate
		};
	});
	const computed = computeLines(
		raw.filter((l) => l.unitPrice > 0),
		0,
		0,
		invoice.gstRegistered,
		invoice.intraState
	);

	const business = await getSetting('business');
	const issuedAt = Date.now();
	const fy = financialYear(issuedAt);
	const { data: next, error: seqError } = await client.rpc('next_document_number', {
		p_series: `credit:${business.invoicePrefix}:${fy}`
	});
	if (seqError) throw new Error(`credit note number failed: ${seqError.message}`);
	const number = `${business.invoicePrefix}/CN/${fy}/${String(next).padStart(4, '0')}`;

	const { data, error } = await client
		.from('invoices')
		.insert({
			order_id: orderId,
			kind: 'credit_note',
			number,
			refund_id: refundId,
			issued_at: new Date(issuedAt).toISOString(),
			gst_registered: invoice.gstRegistered,
			seller: invoice.seller,
			buyer: invoice.buyer,
			lines: computed.lines,
			totals: {
				...computed.totals,
				intra_state: invoice.intraState,
				against: invoice.number,
				order_number: invoice.orderNumber
			},
			created_by: actor
		})
		.select('*')
		.single();
	if (error) throw new Error(`credit note write failed: ${error.message}`);
	return toDocument(data as InvoiceRow);
}

export async function invoiceForOrder(orderId: string): Promise<InvoiceDocument | null> {
	const { data, error } = await getServiceClient()
		.from('invoices')
		.select('*')
		.eq('order_id', orderId)
		.eq('kind', 'invoice')
		.maybeSingle();
	if (error) throw new Error(`invoice read failed: ${error.message}`);
	return data ? toDocument(data as InvoiceRow) : null;
}

export async function documentsForOrder(orderId: string): Promise<InvoiceDocument[]> {
	const { data, error } = await getServiceClient()
		.from('invoices')
		.select('*')
		.eq('order_id', orderId)
		.order('issued_at');
	if (error) throw new Error(`invoice read failed: ${error.message}`);
	return ((data ?? []) as InvoiceRow[]).map(toDocument);
}

export async function findDocument(id: string): Promise<InvoiceDocument | null> {
	const { data, error } = await getServiceClient().from('invoices').select('*').eq('id', id).maybeSingle();
	if (error) throw new Error(`invoice read failed: ${error.message}`);
	return data ? toDocument(data as InvoiceRow) : null;
}

export const DOCUMENT_PAGE_SIZE = 50;

export async function listDocuments(filter: {
	from?: number;
	to?: number;
	kind?: 'invoice' | 'credit_note';
	search?: string;
	page: number;
	all?: boolean;
}): Promise<{ documents: InvoiceDocument[]; total: number }> {
	let query = getServiceClient()
		.from('invoices')
		.select('*', { count: 'exact' })
		.order('issued_at', { ascending: false });
	if (filter.kind) query = query.eq('kind', filter.kind);
	if (filter.from) query = query.gte('issued_at', new Date(filter.from).toISOString());
	if (filter.to) query = query.lte('issued_at', new Date(filter.to).toISOString());
	if (filter.search) {
		const term = filter.search.replace(/[%,()]/g, ' ').trim();
		if (term) query = query.ilike('number', `*${term}*`);
	}
	if (!filter.all) {
		const start = Math.max(0, filter.page - 1) * DOCUMENT_PAGE_SIZE;
		query = query.range(start, start + DOCUMENT_PAGE_SIZE - 1);
	}
	const { data, error, count } = await query;
	if (error) throw new Error(`invoice read failed: ${error.message}`);
	return { documents: ((data ?? []) as InvoiceRow[]).map(toDocument), total: count ?? 0 };
}
