import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireSection } from '$lib/server/admin/roles';
import { actorLabel, staffActor } from '$lib/server/admin/session';
import {
	CouponError,
	createCoupon,
	listCoupons,
	setCouponActive,
	suggestCode,
	updateCoupon,
	type CouponInput
} from '$lib/server/marketing/coupons';
import { rupeesToPaise } from '$lib/server/catalogue/forms';
import { parseIstInput } from '$lib/components/admin/tone';

export const load: PageServerLoad = async (event) => {
	const actor = await staffActor(event);
	requireSection(actor, 'coupons');
	return {
		coupons: await listCoupons(event.locals.now),
		suggestion: suggestCode(),
		now: event.locals.now
	};
};

function read(form: FormData): CouponInput {
	const text = (n: string) => String(form.get(n) ?? '').trim();
	const kind = text('kind') === 'fixed' ? 'fixed' : 'percent';
	const money = (n: string) => (text(n) ? rupeesToPaise(text(n)) : 0);
	return {
		code: text('code').toUpperCase(),
		kind,
		value: kind === 'fixed' ? money('value') : Number(text('value')),
		minSubtotal: money('minSubtotal') || 0,
		maxDiscount: text('maxDiscount') ? money('maxDiscount') : null,
		validFrom: text('validFrom') ? parseIstInput(text('validFrom')) : null,
		validUntil: text('validUntil') ? parseIstInput(text('validUntil')) : null,
		maxUses: text('maxUses') ? Number(text('maxUses')) : null,
		description: text('description') || null
	};
}

async function guarded(
	event: Parameters<Actions[string]>[0],
	work: (actor: string, form: FormData) => Promise<string>
) {
	const actor = await staffActor(event);
	requireSection(actor, 'coupons');
	const form = await event.request.formData();
	try {
		return { message: await work(actorLabel(actor), form) };
	} catch (err) {
		if (err instanceof CouponError) return fail(400, { error: err.message });
		throw err;
	}
}

export const actions: Actions = {
	create: (event) =>
		guarded(event, async (actor, form) => {
			const input = read(form);
			await createCoupon(input, actor);
			return `${input.code} is ready to use.`;
		}),
	update: (event) =>
		guarded(event, async (actor, form) => {
			await updateCoupon(String(form.get('id')), read(form), actor);
			return 'Coupon saved.';
		}),
	toggle: (event) =>
		guarded(event, async (actor, form) => {
			const active = form.get('active') === 'true';
			await setCouponActive(String(form.get('id')), active, actor);
			return active ? 'Coupon resumed.' : 'Coupon paused. Nobody can use it until you resume it.';
		})
};
