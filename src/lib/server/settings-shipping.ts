/**
 * Shipping rates and blocked pincodes (public.shipping_rates and
 * public.pincode_exclusions, 0011). Checkout reads both; this edits them.
 */
import { getCatalogueClient } from '$lib/server/db/clients';
import { writeAudit } from '$lib/server/admin/audit';
import { paise, type Paise } from '$lib/money';

export class ShippingError extends Error {}

export type Rate = { id: string; name: string; min: Paise; max: Paise | null; rate: Paise; active: boolean };
export type Exclusion = { pincode: string; reason: string; createdAt: number };

export async function listShipping(): Promise<{ rates: Rate[]; exclusions: Exclusion[] }> {
	const db = getCatalogueClient();
	const [{ data: rates }, { data: exclusions }] = await Promise.all([
		db.from('shipping_rates').select('*').order('min_subtotal_paise'),
		db.from('pincode_exclusions').select('*').order('pincode')
	]);
	return {
		rates: ((rates ?? []) as { id: string; name: string; min_subtotal_paise: number; max_subtotal_paise: number | null; rate_paise: number; active: boolean }[]).map((r) => ({
			id: r.id,
			name: r.name,
			min: paise(Number(r.min_subtotal_paise)),
			max: r.max_subtotal_paise === null ? null : paise(Number(r.max_subtotal_paise)),
			rate: paise(Number(r.rate_paise)),
			active: r.active
		})),
		exclusions: ((exclusions ?? []) as { pincode: string; reason: string; created_at: string }[]).map((e) => ({
			pincode: e.pincode,
			reason: e.reason,
			createdAt: Date.parse(e.created_at)
		}))
	};
}

export async function saveRate(input: { id: string | null; name: string; min: number; max: number | null; rate: number; active: boolean; actor: string }): Promise<void> {
	if (!input.name.trim()) throw new ShippingError('Name the rate, e.g. Standard.');
	if (input.max !== null && input.max <= input.min) throw new ShippingError('“Up to” must be more than “from”.');
	if (!(input.rate >= 0)) throw new ShippingError('Enter the charge in rupees; 0 for free.');
	const row = { name: input.name.trim(), min_subtotal_paise: input.min, max_subtotal_paise: input.max, rate_paise: input.rate, active: input.active };
	const db = getCatalogueClient();
	const { error } = input.id ? await db.from('shipping_rates').update(row).eq('id', input.id) : await db.from('shipping_rates').insert(row);
	if (error) throw new Error(`rate save failed: ${error.message}`);
	await writeAudit(input.actor, input.id ? 'shipping rate edited' : 'shipping rate added', 'shipping', input.id ?? 'new', row);
}

export async function deleteRate(id: string, actor: string): Promise<void> {
	await getCatalogueClient().from('shipping_rates').delete().eq('id', id);
	await writeAudit(actor, 'shipping rate removed', 'shipping', id);
}

export async function addExclusion(input: { pincode: string; reason: string; actor: string }): Promise<void> {
	const codes = input.pincode.split(/[\s,]+/).filter(Boolean);
	if (!codes.length || !codes.every((c) => /^[1-9]\d{5}$/.test(c))) throw new ShippingError('Pincodes are 6 digits, separated by commas.');
	if (!input.reason.trim()) throw new ShippingError('Say why, so checkout can tell the customer.');
	const { error } = await getCatalogueClient()
		.from('pincode_exclusions')
		.upsert(codes.map((pincode) => ({ pincode, reason: input.reason.trim() })), { onConflict: 'pincode' });
	if (error) throw new Error(`exclusion save failed: ${error.message}`);
	await writeAudit(input.actor, `blocked ${codes.length} pincode${codes.length === 1 ? '' : 's'}`, 'shipping', codes.join(','));
}

export async function removeExclusion(pincode: string, actor: string): Promise<void> {
	await getCatalogueClient().from('pincode_exclusions').delete().eq('pincode', pincode);
	await writeAudit(actor, 'pincode unblocked', 'shipping', pincode);
}
