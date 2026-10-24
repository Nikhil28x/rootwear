/**
 * Coupons (app.coupons, 0011): making them, pausing them, and what each one
 * sold. A coupon's discount is applied and re-checked by the database at
 * order time (app.apply_coupon / app.redeem_coupon); this module only
 * manages the codes.
 */
import { getServiceClient } from '$lib/server/db/clients';
import { writeAudit } from '$lib/server/admin/audit';
import { paise, type Paise } from '$lib/money';

export class CouponError extends Error {}

export type Coupon = {
	readonly id: string;
	readonly code: string;
	readonly kind: 'percent' | 'fixed';
	/** Percent 1–100, or paise. */
	readonly value: number;
	readonly minSubtotal: Paise;
	readonly maxDiscount: Paise | null;
	readonly validFrom: number;
	readonly validUntil: number | null;
	readonly maxUses: number | null;
	readonly used: number;
	readonly active: boolean;
	readonly description: string | null;
	readonly createdAt: number;
	readonly discountGiven: Paise;
	readonly revenue: Paise;
	readonly status: 'active' | 'scheduled' | 'expired' | 'used_up' | 'paused';
};

type Row = {
	id: string;
	code: string;
	kind: 'percent' | 'fixed';
	value: number;
	min_subtotal_paise: number;
	max_discount_paise: number | null;
	valid_from: string;
	valid_until: string | null;
	max_uses: number | null;
	used_count: number;
	active: boolean;
	description: string | null;
	created_at: string;
};

function status(row: Row, now: number): Coupon['status'] {
	if (!row.active) return 'paused';
	if (row.max_uses !== null && row.used_count >= row.max_uses) return 'used_up';
	if (row.valid_until && Date.parse(row.valid_until) < now) return 'expired';
	if (Date.parse(row.valid_from) > now) return 'scheduled';
	return 'active';
}

export async function listCoupons(now: number): Promise<Coupon[]> {
	const client = getServiceClient();
	const { data, error } = await client.from('coupons').select('*').order('created_at', { ascending: false });
	if (error) throw new Error(`coupons read failed: ${error.message}`);
	const rows = (data ?? []) as Row[];
	const { data: redemptions } = rows.length
		? await client.from('coupon_redemptions').select('coupon_id, order_id, amount_paise').in('coupon_id', rows.map((r) => r.id))
		: { data: [] };
	const red = (redemptions ?? []) as { coupon_id: string; order_id: string; amount_paise: number }[];
	const { data: orders } = red.length
		? await client.from('orders').select('id, total_paise, state').in('id', red.map((r) => r.order_id))
		: { data: [] };
	const paid = new Map(
		((orders ?? []) as { id: string; total_paise: number; state: string }[])
			.filter((o) => ['paid', 'packed', 'dispatched', 'delivered'].includes(o.state))
			.map((o) => [o.id, Number(o.total_paise)])
	);
	return rows.map((row) => {
		const mine = red.filter((r) => r.coupon_id === row.id && paid.has(r.order_id));
		return {
			id: row.id,
			code: row.code,
			kind: row.kind,
			value: Number(row.value),
			minSubtotal: paise(Number(row.min_subtotal_paise)),
			maxDiscount: row.max_discount_paise ? paise(Number(row.max_discount_paise)) : null,
			validFrom: Date.parse(row.valid_from),
			validUntil: row.valid_until ? Date.parse(row.valid_until) : null,
			maxUses: row.max_uses,
			used: row.used_count,
			active: row.active,
			description: row.description,
			createdAt: Date.parse(row.created_at),
			discountGiven: paise(mine.reduce((n, r) => n + Number(r.amount_paise), 0)),
			revenue: paise(mine.reduce((n, r) => n + (paid.get(r.order_id) ?? 0), 0)),
			status: status(row, now)
		};
	});
}

export type CouponInput = {
	code: string;
	kind: 'percent' | 'fixed';
	value: number;
	minSubtotal: number;
	maxDiscount: number | null;
	validFrom: number | null;
	validUntil: number | null;
	maxUses: number | null;
	description: string | null;
};

function validate(input: CouponInput): void {
	if (!/^[A-Z0-9-]{3,32}$/.test(input.code)) throw new CouponError('A code is 3–32 capital letters, digits or dashes, e.g. ROOTS10.');
	if (input.kind === 'percent' && !(Number.isInteger(input.value) && input.value >= 1 && input.value <= 100)) {
		throw new CouponError('A percentage is a whole number from 1 to 100.');
	}
	if (input.kind === 'fixed' && !(Number.isInteger(input.value) && input.value > 0)) throw new CouponError('Enter the amount off in rupees.');
	if (input.validUntil && input.validFrom && input.validUntil <= input.validFrom) throw new CouponError('The end must be after the start.');
	if (input.maxUses !== null && !(Number.isInteger(input.maxUses) && input.maxUses > 0)) throw new CouponError('Uses must be a whole number, 1 or more.');
}

function row(input: CouponInput) {
	return {
		code: input.code,
		kind: input.kind,
		value: input.value,
		min_subtotal_paise: input.minSubtotal,
		max_discount_paise: input.maxDiscount,
		valid_from: input.validFrom ? new Date(input.validFrom).toISOString() : new Date().toISOString(),
		valid_until: input.validUntil ? new Date(input.validUntil).toISOString() : null,
		max_uses: input.maxUses,
		description: input.description
	};
}

export async function createCoupon(input: CouponInput, actor: string): Promise<string> {
	validate(input);
	const { data, error } = await getServiceClient()
		.from('coupons')
		.insert({ ...row(input), created_by: actor })
		.select('id')
		.single();
	if (error) {
		if (error.code === '23505') throw new CouponError(`${input.code} already exists. Pick another code.`);
		throw new Error(`coupon create failed: ${error.message}`);
	}
	const id = (data as { id: string }).id;
	await writeAudit(actor, 'coupon created', 'coupon', id, { code: input.code, kind: input.kind, value: input.value });
	return id;
}

export async function updateCoupon(id: string, input: CouponInput, actor: string): Promise<void> {
	validate(input);
	const { data: used } = await getServiceClient().from('coupons').select('used_count, code').eq('id', id).single();
	const current = used as { used_count: number; code: string } | null;
	if (current && current.used_count > 0 && current.code !== input.code) {
		throw new CouponError('This code has been used, so it cannot be renamed. Make a new coupon instead.');
	}
	if (current && input.maxUses !== null && input.maxUses < current.used_count) {
		throw new CouponError(`It has been used ${current.used_count} times already.`);
	}
	const { error } = await getServiceClient().from('coupons').update(row(input)).eq('id', id);
	if (error) throw new Error(`coupon update failed: ${error.message}`);
	await writeAudit(actor, 'coupon edited', 'coupon', id, { code: input.code });
}

export async function setCouponActive(id: string, active: boolean, actor: string): Promise<void> {
	await getServiceClient().from('coupons').update({ active }).eq('id', id);
	await writeAudit(actor, active ? 'coupon resumed' : 'coupon paused', 'coupon', id);
}

/** A readable random code: prefix plus four characters, no look-alikes. */
export function suggestCode(prefix = 'ROOTS'): string {
	const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
	const bytes = crypto.getRandomValues(new Uint8Array(4));
	return `${prefix}-${[...bytes].map((b) => alphabet[b % alphabet.length]).join('')}`;
}
