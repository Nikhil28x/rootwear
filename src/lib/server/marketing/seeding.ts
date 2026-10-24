/**
 * Influencer seeding: pieces gifted to creators, whether they posted, and
 * what their code and tracked link sold.
 *
 * Sending a seeding takes the piece out of stock as 'gifted', through
 * app.adjust_stock, so the stock count and its history stay true.
 */
import { getCatalogueClient, getServiceClient } from '$lib/server/db/clients';
import { writeAudit } from '$lib/server/admin/audit';
import { createCoupon } from './coupons';
import { siteUrl } from '$lib/server/messaging/config';
import type { Attribution } from '$lib/server/attribution/touch';
import { paise, type Paise } from '$lib/money';

export class SeedingError extends Error {}

export type Seeding = {
	readonly id: string;
	readonly variantId: string | null;
	readonly piece: string;
	readonly quantity: number;
	readonly status: 'planned' | 'sent' | 'posted' | 'no_post';
	readonly courier: string | null;
	readonly tracking: string | null;
	readonly sentAt: number | null;
	readonly postUrl: string | null;
	readonly postedAt: number | null;
	readonly couponCode: string | null;
	readonly utmCampaign: string | null;
	readonly link: string | null;
	readonly note: string | null;
	readonly createdAt: number;
};

export type Influencer = {
	readonly id: string;
	readonly name: string;
	readonly handle: string;
	readonly platform: string;
	readonly followers: number | null;
	readonly email: string | null;
	readonly phone: string | null;
	readonly address: string | null;
	readonly notes: string | null;
	readonly seedings: readonly Seeding[];
	readonly results: { orders: number; revenue: Paise; couponUses: number };
};

const handleOf = (raw: string) => raw.trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/.*$/, '').toLowerCase();

export async function listInfluencers(): Promise<Influencer[]> {
	const client = getServiceClient();
	const [{ data: people }, { data: seedings }] = await Promise.all([
		client.from('influencers').select('*').order('created_at', { ascending: false }),
		client.from('seedings').select('*').order('created_at', { ascending: false })
	]);
	const ss = (seedings ?? []) as {
		id: string;
		influencer_id: string;
		variant_id: string | null;
		quantity: number;
		status: Seeding['status'];
		courier_name: string | null;
		tracking_ref: string | null;
		sent_at: string | null;
		post_url: string | null;
		posted_at: string | null;
		coupon_id: string | null;
		utm_campaign: string | null;
		note: string | null;
		created_at: string;
	}[];

	const variantIds = [...new Set(ss.map((s) => s.variant_id).filter((v): v is string => v !== null))];
	const couponIds = [...new Set(ss.map((s) => s.coupon_id).filter((c): c is string => c !== null))];
	const campaigns = [...new Set(ss.map((s) => s.utm_campaign).filter((c): c is string => c !== null))];

	const catalogue = getCatalogueClient();
	const [{ data: variants }, { data: coupons }, { data: redemptions }, { data: orders }] = await Promise.all([
		variantIds.length ? catalogue.from('variants').select('id, size, product_id, colourway_id').in('id', variantIds) : Promise.resolve({ data: [] }),
		couponIds.length ? client.from('coupons').select('id, code, used_count').in('id', couponIds) : Promise.resolve({ data: [] }),
		couponIds.length ? client.from('coupon_redemptions').select('coupon_id, order_id').in('coupon_id', couponIds) : Promise.resolve({ data: [] }),
		campaigns.length
			? client.from('orders').select('id, total_paise, state, attribution').in('state', ['paid', 'packed', 'dispatched', 'delivered']).limit(5000)
			: Promise.resolve({ data: [] })
	]);
	const vs = (variants ?? []) as { id: string; size: string; product_id: string; colourway_id: string | null }[];
	const productIds = [...new Set(vs.map((v) => v.product_id))];
	const [{ data: products }, { data: colours }] = productIds.length
		? await Promise.all([
				catalogue.from('products').select('id, name').in('id', productIds),
				catalogue.from('colourways').select('id, name').in('product_id', productIds)
			])
		: [{ data: [] }, { data: [] }];
	const productName = new Map(((products ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]));
	const colourName = new Map(((colours ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));
	const pieceOf = new Map(
		vs.map((v) => [v.id, `${productName.get(v.product_id) ?? 'Piece'} — ${[v.colourway_id ? colourName.get(v.colourway_id) : null, v.size].filter(Boolean).join(' / ')}`])
	);
	const couponOf = new Map(((coupons ?? []) as { id: string; code: string; used_count: number }[]).map((c) => [c.id, c]));
	const orderRows = (orders ?? []) as { id: string; total_paise: number; attribution: Attribution | null }[];
	const paidTotal = new Map(orderRows.map((o) => [o.id, Number(o.total_paise)]));
	const red = (redemptions ?? []) as { coupon_id: string; order_id: string }[];

	return ((people ?? []) as { id: string; name: string; handle: string; platform: string; followers: number | null; email: string | null; phone: string | null; address: string | null; notes: string | null }[]).map((p) => {
		const mine = ss.filter((s) => s.influencer_id === p.id);
		const myCoupons = new Set(mine.map((s) => s.coupon_id).filter(Boolean));
		const myCampaigns = new Set(mine.map((s) => s.utm_campaign).filter(Boolean));
		const orderIds = new Set<string>();
		for (const r of red) if (myCoupons.has(r.coupon_id) && paidTotal.has(r.order_id)) orderIds.add(r.order_id);
		for (const o of orderRows) {
			const campaign = o.attribution?.last?.campaign ?? o.attribution?.first?.campaign;
			if (campaign && myCampaigns.has(campaign)) orderIds.add(o.id);
		}
		return {
			...p,
			seedings: mine.map((s) => ({
				id: s.id,
				variantId: s.variant_id,
				piece: s.variant_id ? (pieceOf.get(s.variant_id) ?? 'Piece') : 'Piece',
				quantity: s.quantity,
				status: s.status,
				courier: s.courier_name,
				tracking: s.tracking_ref,
				sentAt: s.sent_at ? Date.parse(s.sent_at) : null,
				postUrl: s.post_url,
				postedAt: s.posted_at ? Date.parse(s.posted_at) : null,
				couponCode: s.coupon_id ? (couponOf.get(s.coupon_id)?.code ?? null) : null,
				utmCampaign: s.utm_campaign,
				link: s.utm_campaign ? `${siteUrl()}/drops?utm_source=${encodeURIComponent(p.handle)}&utm_medium=creator&utm_campaign=${encodeURIComponent(s.utm_campaign)}` : null,
				note: s.note,
				createdAt: Date.parse(s.created_at)
			})),
			results: {
				orders: orderIds.size,
				revenue: paise([...orderIds].reduce((n, id) => n + (paidTotal.get(id) ?? 0), 0)),
				couponUses: [...myCoupons].reduce((n, id) => n + (couponOf.get(id as string)?.used_count ?? 0), 0)
			}
		};
	});
}

export async function addInfluencer(input: {
	name: string;
	handle: string;
	platform: string;
	followers: number | null;
	email: string | null;
	phone: string | null;
	address: string | null;
	notes: string | null;
	actor: string;
}): Promise<string> {
	const handle = handleOf(input.handle);
	if (!input.name.trim() || !handle) throw new SeedingError('Give their name and handle.');
	const { data, error } = await getServiceClient()
		.from('influencers')
		.insert({
			name: input.name.trim(),
			handle,
			platform: ['instagram', 'youtube'].includes(input.platform) ? input.platform : 'other',
			followers: input.followers,
			email: input.email?.trim() || null,
			phone: input.phone?.trim() || null,
			address: input.address?.trim() || null,
			notes: input.notes?.trim() || null
		})
		.select('id')
		.single();
	if (error) {
		if (error.code === '23505') throw new SeedingError(`@${handle} is already on the list.`);
		throw new Error(`influencer create failed: ${error.message}`);
	}
	const id = (data as { id: string }).id;
	await writeAudit(input.actor, 'creator added', 'influencer', id, { handle });
	return id;
}

/** Plans a gift; optionally makes their own discount code and tracked link. */
export async function planSeeding(input: {
	influencerId: string;
	variantId: string;
	quantity: number;
	couponPercent: number | null;
	note: string | null;
	actor: string;
}): Promise<void> {
	const client = getServiceClient();
	const { data: person } = await client.from('influencers').select('handle').eq('id', input.influencerId).single();
	if (!person) throw new SeedingError('That creator is no longer on the list.');
	const handle = (person as { handle: string }).handle;
	const campaign = `seed-${handle.replace(/[^a-z0-9]+/g, '-')}`;

	let couponId: string | null = null;
	if (input.couponPercent) {
		const base = handle.replace(/[^a-z0-9]/g, '').toUpperCase().slice(0, 20) || 'CREATOR';
		// A second gift to the same creator keeps their code, so their sales
		// stay in one place.
		const code = `${base}${input.couponPercent}`;
		const { data: existing } = await client.from('coupons').select('id').eq('code', code).maybeSingle();
		couponId = existing ? (existing as { id: string }).id : await createCoupon(
			{
				code,
				kind: 'percent',
				value: input.couponPercent,
				minSubtotal: 0,
				maxDiscount: null,
				validFrom: null,
				validUntil: null,
				maxUses: null,
				description: `@${handle}'s code`
			},
			input.actor
		);
	}
	const { error } = await client.from('seedings').insert({
		influencer_id: input.influencerId,
		variant_id: input.variantId,
		quantity: Math.max(1, input.quantity),
		coupon_id: couponId,
		utm_campaign: campaign,
		note: input.note,
		created_by: input.actor
	});
	if (error) throw new Error(`seeding create failed: ${error.message}`);
	await writeAudit(input.actor, 'seeding planned', 'influencer', input.influencerId, { variantId: input.variantId });
}

export async function markSent(input: { id: string; courier: string; tracking: string; actor: string }): Promise<void> {
	const client = getServiceClient();
	const { data } = await client.from('seedings').select('variant_id, quantity, status, influencer_id').eq('id', input.id).single();
	const s = data as { variant_id: string | null; quantity: number; status: string; influencer_id: string } | null;
	if (!s) throw new SeedingError('That gift no longer exists.');
	if (s.status !== 'planned') throw new SeedingError('This gift has already been sent.');
	if (s.variant_id) {
		const { error } = await client.rpc('adjust_stock', {
			p_variant_id: s.variant_id,
			p_delta: -s.quantity,
			p_reason: 'gifted',
			p_note: 'Creator seeding',
			p_actor: input.actor
		});
		if (error) throw new SeedingError(error.message.replace(/^ERROR:\s*/, ''));
	}
	await client
		.from('seedings')
		.update({ status: 'sent', courier_name: input.courier.trim() || null, tracking_ref: input.tracking.trim() || null, sent_at: new Date().toISOString() })
		.eq('id', input.id);
	await writeAudit(input.actor, 'seeding sent', 'influencer', s.influencer_id, { seeding: input.id });
}

export async function markPosted(input: { id: string; url: string | null; posted: boolean; actor: string }): Promise<void> {
	if (input.posted && !input.url?.trim()) throw new SeedingError('Paste the link to their post.');
	await getServiceClient()
		.from('seedings')
		.update(
			input.posted
				? { status: 'posted', post_url: input.url!.trim(), posted_at: new Date().toISOString() }
				: { status: 'no_post' }
		)
		.eq('id', input.id);
}
