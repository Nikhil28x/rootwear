import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requireSection } from '$lib/server/admin/roles';
import { actorLabel, staffActor } from '$lib/server/admin/session';
import { addInfluencer, listInfluencers, markPosted, markSent, planSeeding, SeedingError } from '$lib/server/marketing/seeding';
import { CouponError } from '$lib/server/marketing/coupons';
import { listDrops } from '$lib/server/catalogue/admin';

export const load: PageServerLoad = async (event) => {
	const actor = await staffActor(event);
	requireSection(actor, 'influencers');
	const [people, drops] = await Promise.all([listInfluencers(), listDrops()]);
	return {
		people,
		pieces: drops.flatMap((d) =>
			d.products.flatMap((p) =>
				p.variants.map((v) => ({
					id: v.id,
					label: `${p.name} — ${[p.colourways.find((c) => c.id === v.colourwayId)?.name, v.size].filter(Boolean).join(' / ')}`,
					available: Math.max(0, v.stock - v.reserved)
				}))
			)
		)
	};
};

async function guarded(event: Parameters<Actions[string]>[0], work: (form: FormData, actor: string) => Promise<string>) {
	const actor = await staffActor(event);
	requireSection(actor, 'influencers');
	const form = await event.request.formData();
	try {
		return { message: await work(form, actorLabel(actor)) };
	} catch (err) {
		if (err instanceof SeedingError || err instanceof CouponError) return fail(400, { error: err.message });
		throw err;
	}
}

const text = (form: FormData, n: string) => String(form.get(n) ?? '').trim();

export const actions: Actions = {
	add: (event) =>
		guarded(event, async (form, actor) => {
			await addInfluencer({
				name: text(form, 'name'),
				handle: text(form, 'handle'),
				platform: text(form, 'platform'),
				followers: text(form, 'followers') ? Number(text(form, 'followers').replace(/[^\d]/g, '')) : null,
				email: text(form, 'email') || null,
				phone: text(form, 'phone') || null,
				address: text(form, 'address') || null,
				notes: text(form, 'notes') || null,
				actor
			});
			return 'Creator added.';
		}),
	plan: (event) =>
		guarded(event, async (form, actor) => {
			if (!text(form, 'variantId')) throw new SeedingError('Pick the piece to send.');
			await planSeeding({
				influencerId: text(form, 'influencerId'),
				variantId: text(form, 'variantId'),
				quantity: Number(text(form, 'quantity') || 1),
				couponPercent: form.get('coupon') === 'on' ? Number(text(form, 'percent') || 10) : null,
				note: text(form, 'note') || null,
				actor
			});
			return 'Gift planned. Mark it sent when it ships.';
		}),
	sent: (event) =>
		guarded(event, async (form, actor) => {
			await markSent({ id: text(form, 'id'), courier: text(form, 'courier'), tracking: text(form, 'tracking'), actor });
			return 'Marked sent. The piece is out of stock as gifted.';
		}),
	posted: (event) =>
		guarded(event, async (form, actor) => {
			const posted = text(form, 'outcome') !== 'no_post';
			await markPosted({ id: text(form, 'id'), url: text(form, 'url') || null, posted, actor });
			return posted ? 'Post saved.' : 'Marked as no post.';
		})
};
