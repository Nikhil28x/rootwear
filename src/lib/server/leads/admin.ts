/**
 * Leads: everyone who has shown interest, from anywhere, in one pipeline.
 *
 *   new → contacted → interested → won (paid an order) / lost
 *
 * A person is one lead while it is open: a second form, DM or message from
 * the same email or phone adds to their history instead of starting a new
 * card. Once won or lost, a fresh enquiry starts a new lead.
 */
import { getServiceClient } from '$lib/server/db/clients';
import { writeAudit } from '$lib/server/admin/audit';
import { enqueue, type OutboxMessage } from '$lib/server/messaging/outbox';
import { whatsAppNumber } from '$lib/server/messaging/render';
import { sendWhatsApp } from '$lib/server/messaging/providers';
import { whatsAppProvider } from '$lib/server/messaging/config';
import { describeTouch, type Attribution } from '$lib/server/attribution/touch';
import { paise, type Paise } from '$lib/money';

export class LeadError extends Error {}

export const LEAD_STAGES = ['new', 'contacted', 'interested', 'won', 'lost'] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export const LEAD_SOURCES = [
	{ value: 'website', label: 'Website form' },
	{ value: 'instagram', label: 'Instagram' },
	{ value: 'whatsapp', label: 'WhatsApp' },
	{ value: 'meta_ads', label: 'Meta lead ad' },
	{ value: 'referral', label: 'Referral' },
	{ value: 'event', label: 'Event or pop-up' },
	{ value: 'other', label: 'Other' }
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number]['value'];

export type Lead = {
	readonly id: string;
	readonly name: string | null;
	readonly email: string | null;
	readonly phone: string | null;
	readonly instagram: string | null;
	readonly source: LeadSource;
	readonly sourceDetail: string | null;
	readonly stage: LeadStage;
	readonly owner: string | null;
	readonly interest: string | null;
	readonly dropId: string | null;
	readonly nextFollowUpAt: number | null;
	readonly lastContactedAt: number | null;
	readonly lastInboundAt: number | null;
	readonly utm: Attribution;
	readonly campaign: string;
	readonly customerId: string | null;
	readonly wonOrderId: string | null;
	readonly lostReason: string | null;
	readonly consentEmail: boolean;
	readonly consentWhatsapp: boolean;
	readonly createdAt: number;
	readonly updatedAt: number;
};

type Row = {
	id: string;
	name: string | null;
	email: string | null;
	phone: string | null;
	instagram: string | null;
	source: LeadSource;
	source_detail: string | null;
	stage: LeadStage;
	owner: string | null;
	interest: string | null;
	drop_id: string | null;
	next_follow_up_at: string | null;
	last_contacted_at: string | null;
	last_inbound_at: string | null;
	utm: Attribution | null;
	customer_id: string | null;
	won_order_id: string | null;
	lost_reason: string | null;
	consent_email: boolean;
	consent_whatsapp: boolean;
	created_at: string;
	updated_at: string;
};

const ms = (v: string | null) => (v ? Date.parse(v) : null);

function toLead(row: Row): Lead {
	const utm = row.utm ?? {};
	return {
		id: row.id,
		name: row.name,
		email: row.email,
		phone: row.phone,
		instagram: row.instagram,
		source: row.source,
		sourceDetail: row.source_detail,
		stage: row.stage,
		owner: row.owner,
		interest: row.interest,
		dropId: row.drop_id,
		nextFollowUpAt: ms(row.next_follow_up_at),
		lastContactedAt: ms(row.last_contacted_at),
		lastInboundAt: ms(row.last_inbound_at),
		utm,
		campaign: describeTouch(utm.first),
		customerId: row.customer_id,
		wonOrderId: row.won_order_id,
		lostReason: row.lost_reason,
		consentEmail: row.consent_email,
		consentWhatsapp: row.consent_whatsapp,
		createdAt: Date.parse(row.created_at),
		updatedAt: Date.parse(row.updated_at)
	};
}

/** Phones are stored the way WhatsApp wants them (919876543210) when they can be. */
export function normalisePhone(raw: string | null | undefined): string | null {
	if (!raw?.trim()) return null;
	return whatsAppNumber(raw) ?? raw.replace(/[^\d+]/g, '');
}

function normaliseInstagram(raw: string | null | undefined): string | null {
	const text = raw?.trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/.*$/, '');
	return text ? text.toLowerCase() : null;
}

async function activity(leadId: string, kind: string, body: string | null, actor: string | null, meta: Record<string, unknown> = {}) {
	await getServiceClient().from('lead_activities').insert({ lead_id: leadId, kind, body, actor, meta });
}

/* ------------------------------------------------------------------------ */
/* Capture                                                                   */
/* ------------------------------------------------------------------------ */

export type CaptureInput = {
	readonly name?: string | null;
	readonly email?: string | null;
	readonly phone?: string | null;
	readonly instagram?: string | null;
	readonly source: LeadSource;
	readonly sourceDetail?: string | null;
	readonly dropId?: string | null;
	readonly interest?: string | null;
	readonly externalId?: string | null;
	readonly utm?: Attribution;
	readonly consentEmail?: boolean;
	readonly consentWhatsapp?: boolean;
	/** What happened, for the history: "Notify me: Bone / M". */
	readonly activity: { kind: 'created' | 'form' | 'message_in' | 'note'; body: string | null; meta?: Record<string, unknown> };
	readonly actor?: string | null;
	readonly inbound?: boolean;
};

/** An open lead for the same email, phone or Instagram handle, if there is one. */
async function findOpen(email: string | null, phone: string | null, instagram: string | null): Promise<Row | null> {
	const ors = [
		email ? `email.eq.${email}` : null,
		phone ? `phone.eq.${phone}` : null,
		instagram ? `instagram.eq.${instagram}` : null
	].filter(Boolean);
	if (!ors.length) return null;
	const { data } = await getServiceClient()
		.from('leads')
		.select('*')
		.or(ors.join(','))
		.not('stage', 'in', '(won,lost)')
		.order('created_at', { ascending: false })
		.limit(1);
	return ((data ?? []) as Row[])[0] ?? null;
}

/**
 * Records an enquiry. Returns the lead it landed on (new or existing) and
 * whether it was new. Redelivered webhooks are dropped by external_id.
 */
export async function captureLead(input: CaptureInput): Promise<{ id: string; created: boolean } | null> {
	const client = getServiceClient();
	const email = input.email?.trim().toLowerCase() || null;
	const phone = normalisePhone(input.phone);
	const instagram = normaliseInstagram(input.instagram);
	if (!email && !phone && !instagram) throw new LeadError('Give at least an email, a phone number or an Instagram handle.');

	if (input.externalId) {
		const { data } = await client.from('leads').select('id').eq('external_id', input.externalId).maybeSingle();
		if (data) return { id: (data as { id: string }).id, created: false };
		const { data: act } = await client
			.from('lead_activities')
			.select('lead_id')
			.eq('meta->>external_id', input.externalId)
			.maybeSingle();
		if (act) return { id: (act as { lead_id: string }).lead_id, created: false };
	}

	const now = new Date().toISOString();
	const existing = await findOpen(email, phone, instagram);
	if (existing) {
		await client
			.from('leads')
			.update({
				name: existing.name ?? input.name ?? null,
				email: existing.email ?? email,
				phone: existing.phone ?? phone,
				instagram: existing.instagram ?? instagram,
				drop_id: existing.drop_id ?? input.dropId ?? null,
				interest: existing.interest ?? input.interest ?? null,
				consent_email: existing.consent_email || Boolean(input.consentEmail),
				consent_whatsapp: existing.consent_whatsapp || Boolean(input.consentWhatsapp),
				// Someone getting back in touch puts the card back at the top.
				...(input.inbound ? { last_inbound_at: now } : {}),
				...(existing.stage === 'contacted' && input.inbound ? { stage: 'interested' } : {})
			})
			.eq('id', existing.id);
		await activity(existing.id, input.activity.kind, input.activity.body, input.actor ?? null, {
			...input.activity.meta,
			...(input.externalId ? { external_id: input.externalId } : {}),
			source: input.source
		});
		return { id: existing.id, created: false };
	}

	const { data: customer } = email
		? await client.from('customers').select('id').eq('email', email).maybeSingle()
		: { data: null };

	const { data, error } = await client
		.from('leads')
		.insert({
			name: input.name?.trim() || null,
			email,
			phone,
			instagram,
			source: input.source,
			source_detail: input.sourceDetail ?? null,
			drop_id: input.dropId ?? null,
			interest: input.interest ?? null,
			external_id: input.externalId ?? null,
			utm: input.utm ?? {},
			consent_email: Boolean(input.consentEmail),
			consent_whatsapp: Boolean(input.consentWhatsapp),
			customer_id: (customer as { id: string } | null)?.id ?? null,
			last_inbound_at: input.inbound ? now : null,
			created_by: input.actor ?? 'system'
		})
		.select('id')
		.single();
	if (error) {
		if (error.code === '23505') return null;
		throw new Error(`lead create failed: ${error.message}`);
	}
	const id = (data as { id: string }).id;
	await activity(id, input.activity.kind, input.activity.body, input.actor ?? null, input.activity.meta ?? {});
	return { id, created: true };
}

/** Never lets a lead problem break the form or webhook that caused it. */
export async function captureQuietly(input: CaptureInput): Promise<void> {
	try {
		await captureLead(input);
	} catch (error) {
		console.error('[leads] capture failed', error);
	}
}

/* ------------------------------------------------------------------------ */
/* Lists                                                                     */
/* ------------------------------------------------------------------------ */

export type LeadFilter = {
	readonly stage?: LeadStage | 'open';
	readonly source?: LeadSource;
	readonly owner?: string;
	readonly due?: boolean;
	readonly search?: string;
};

export const LEAD_PAGE_SIZE = 60;

export async function listLeads(filter: LeadFilter, page: number, now: number): Promise<{ leads: Lead[]; total: number }> {
	let query = getServiceClient().from('leads').select('*', { count: 'exact' });
	if (filter.stage === 'open') query = query.not('stage', 'in', '(won,lost)');
	else if (filter.stage) query = query.eq('stage', filter.stage);
	if (filter.source) query = query.eq('source', filter.source);
	if (filter.owner === 'none') query = query.is('owner', null);
	else if (filter.owner) query = query.eq('owner', filter.owner);
	if (filter.due) {
		query = query.lte('next_follow_up_at', new Date(now).toISOString()).not('stage', 'in', '(won,lost)');
	}
	if (filter.search) {
		const term = filter.search.replace(/[%,()*]/g, ' ').trim();
		if (term) {
			const digits = term.replace(/\D/g, '');
			query = query.or(
				[
					`name.ilike.*${term}*`,
					`email.ilike.*${term}*`,
					`instagram.ilike.*${term.replace(/^@/, '')}*`,
					digits.length >= 4 ? `phone.ilike.*${digits}*` : null
				]
					.filter(Boolean)
					.join(',')
			);
		}
	}
	query = filter.due
		? query.order('next_follow_up_at', { ascending: true })
		: query.order('updated_at', { ascending: false });
	const start = Math.max(0, page - 1) * LEAD_PAGE_SIZE;
	const { data, error, count } = await query.range(start, start + LEAD_PAGE_SIZE - 1);
	if (error) throw new Error(`leads read failed: ${error.message}`);
	return { leads: ((data ?? []) as Row[]).map(toLead), total: count ?? 0 };
}

export async function stageCounts(now: number): Promise<Record<string, number>> {
	const client = getServiceClient();
	const counts = await Promise.all(
		LEAD_STAGES.map((stage) => client.from('leads').select('id', { count: 'exact', head: true }).eq('stage', stage))
	);
	const due = await client
		.from('leads')
		.select('id', { count: 'exact', head: true })
		.lte('next_follow_up_at', new Date(now).toISOString())
		.not('stage', 'in', '(won,lost)');
	return {
		...Object.fromEntries(LEAD_STAGES.map((stage, i) => [stage, counts[i].count ?? 0])),
		due: due.count ?? 0
	};
}

/* ------------------------------------------------------------------------ */
/* One lead                                                                  */
/* ------------------------------------------------------------------------ */

export type LeadActivity = {
	readonly id: string;
	readonly kind: string;
	readonly body: string | null;
	readonly meta: Record<string, unknown>;
	readonly actor: string | null;
	readonly at: number;
};

export type LeadOrder = { readonly id: string; readonly number: string; readonly state: string; readonly total: Paise; readonly at: number };

export type LeadDetail = Lead & {
	readonly activities: readonly LeadActivity[];
	readonly orders: readonly LeadOrder[];
	readonly messages: readonly OutboxMessage[];
	readonly whatsappWindowOpen: boolean;
};

export async function getLead(id: string, now: number): Promise<LeadDetail | null> {
	const client = getServiceClient();
	const { data } = await client.from('leads').select('*').eq('id', id).maybeSingle();
	if (!data) return null;
	const lead = toLead(data as Row);

	const customerIds = new Set<string>(lead.customerId ? [lead.customerId] : []);
	if (lead.email) {
		const { data: c } = await client.from('customers').select('id').eq('email', lead.email);
		for (const row of (c ?? []) as { id: string }[]) customerIds.add(row.id);
	}
	const orderQuery = [
		customerIds.size ? `customer_id.in.(${[...customerIds].join(',')})` : null,
		lead.phone ? `ship_phone.ilike.*${lead.phone.slice(-10)}*` : null
	].filter(Boolean);

	const [activities, orders, messages] = await Promise.all([
		client.from('lead_activities').select('*').eq('lead_id', id).order('created_at', { ascending: false }).limit(200),
		orderQuery.length
			? client
					.from('orders')
					.select('id, order_number, state, total_paise, created_at')
					.or(orderQuery.join(','))
					.neq('state', 'pending_payment')
					.order('created_at', { ascending: false })
			: Promise.resolve({ data: [] }),
		client.from('message_outbox').select('*').eq('context_type', 'lead').eq('context_id', id).order('created_at', { ascending: false })
	]);
	const { toMessage } = await import('$lib/server/messaging/outbox');

	return {
		...lead,
		activities: ((activities.data ?? []) as { id: string; kind: string; body: string | null; meta: Record<string, unknown>; actor: string | null; created_at: string }[]).map(
			(a) => ({ id: a.id, kind: a.kind, body: a.body, meta: a.meta ?? {}, actor: a.actor, at: Date.parse(a.created_at) })
		),
		orders: ((orders.data ?? []) as { id: string; order_number: string; state: string; total_paise: number; created_at: string }[]).map((o) => ({
			id: o.id,
			number: o.order_number,
			state: o.state,
			total: paise(Number(o.total_paise)),
			at: Date.parse(o.created_at)
		})),
		messages: ((messages.data ?? []) as Parameters<typeof toMessage>[0][]).map(toMessage),
		whatsappWindowOpen: lead.lastInboundAt !== null && now - lead.lastInboundAt < 24 * 3_600_000
	};
}

/* ------------------------------------------------------------------------ */
/* Working a lead                                                            */
/* ------------------------------------------------------------------------ */

export async function updateDetails(input: {
	id: string;
	name: string | null;
	email: string | null;
	phone: string | null;
	instagram: string | null;
	interest: string | null;
	consentEmail: boolean;
	consentWhatsapp: boolean;
	actor: string;
}): Promise<void> {
	const email = input.email?.trim().toLowerCase() || null;
	if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new LeadError('That email address does not look right.');
	const phone = normalisePhone(input.phone);
	const instagram = normaliseInstagram(input.instagram);
	if (!email && !phone && !instagram) throw new LeadError('Keep at least one way to reach them.');
	const { error } = await getServiceClient()
		.from('leads')
		.update({
			name: input.name?.trim() || null,
			email,
			phone,
			instagram,
			interest: input.interest?.trim() || null,
			consent_email: input.consentEmail,
			consent_whatsapp: input.consentWhatsapp
		})
		.eq('id', input.id);
	if (error) throw new Error(`lead update failed: ${error.message}`);
	await writeAudit(input.actor, 'lead edited', 'lead', input.id);
}

export async function setStage(input: { id: string; stage: LeadStage; lostReason?: string | null; actor: string }): Promise<void> {
	if (!LEAD_STAGES.includes(input.stage)) throw new LeadError('Unknown stage.');
	if (input.stage === 'lost' && !input.lostReason?.trim()) throw new LeadError('Say why it was lost; it helps to know later.');
	const { data } = await getServiceClient().from('leads').select('stage').eq('id', input.id).single();
	const before = (data as { stage: string } | null)?.stage;
	if (before === input.stage) return;
	await getServiceClient()
		.from('leads')
		.update({
			stage: input.stage,
			lost_reason: input.stage === 'lost' ? input.lostReason?.trim() : null,
			...(input.stage === 'won' || input.stage === 'lost' ? { next_follow_up_at: null } : {})
		})
		.eq('id', input.id);
	await activity(input.id, 'stage', `${before} → ${input.stage}${input.lostReason ? `: ${input.lostReason}` : ''}`, input.actor);
}

export async function assign(input: { id: string; owner: string | null; actor: string }): Promise<void> {
	await getServiceClient().from('leads').update({ owner: input.owner }).eq('id', input.id);
	await activity(input.id, 'assigned', input.owner ? `Assigned to ${input.owner}` : 'Unassigned', input.actor);
}

export async function setFollowUp(input: { id: string; at: number | null; note: string | null; actor: string }): Promise<void> {
	await getServiceClient()
		.from('leads')
		.update({ next_follow_up_at: input.at ? new Date(input.at).toISOString() : null })
		.eq('id', input.id);
	await activity(
		input.id,
		'follow_up',
		input.at
			? `Follow up ${new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }).format(input.at)}${input.note ? ` — ${input.note}` : ''}`
			: 'Follow-up cleared',
		input.actor
	);
}

/** A note or a logged call. A call counts as contact and moves a new lead on. */
export async function log(input: { id: string; kind: 'note' | 'call'; body: string; actor: string }): Promise<void> {
	if (!input.body.trim()) throw new LeadError('Write something first.');
	await activity(input.id, input.kind, input.body.trim(), input.actor);
	if (input.kind === 'call') await contacted(input.id, input.actor);
}

async function contacted(id: string, actor: string) {
	const client = getServiceClient();
	const { data } = await client.from('leads').select('stage').eq('id', id).single();
	await client
		.from('leads')
		.update({
			last_contacted_at: new Date().toISOString(),
			...((data as { stage: string } | null)?.stage === 'new' ? { stage: 'contacted' } : {})
		})
		.eq('id', id);
	if ((data as { stage: string } | null)?.stage === 'new') await activity(id, 'stage', 'new → contacted', actor);
}

/**
 * A WhatsApp reply. Free text only works within 24 hours of their last
 * message (Meta's rule); outside it, staff must use an approved template.
 */
export async function replyWhatsApp(input: { id: string; text: string; actor: string; now: number }): Promise<void> {
	const lead = await getLead(input.id, input.now);
	if (!lead) throw new LeadError('That lead no longer exists.');
	if (!lead.phone) throw new LeadError('There is no phone number on this lead.');
	if (!input.text.trim()) throw new LeadError('Write the message first.');
	if (!lead.whatsappWindowOpen) {
		throw new LeadError('WhatsApp only allows a free reply within 24 hours of their last message. Send an email, or wait for them to write.');
	}
	const provider = whatsAppProvider();
	if (!provider) throw new LeadError('WhatsApp is not connected yet. Add the Cloud API settings first.');
	const id = await sendWhatsApp(provider, { kind: 'text', to: lead.phone, text: input.text.trim() });
	await activity(input.id, 'message_out', input.text.trim(), input.actor, { channel: 'whatsapp', provider_message_id: id });
	await contacted(input.id, input.actor);
}

export async function sendEmail(input: { id: string; subject: string; message: string; actor: string; now: number }): Promise<OutboxMessage> {
	const lead = await getLead(input.id, input.now);
	if (!lead) throw new LeadError('That lead no longer exists.');
	if (!lead.email) throw new LeadError('There is no email address on this lead.');
	if (!input.subject.trim() || !input.message.trim()) throw new LeadError('Write a subject and a message.');
	const message = await enqueue({
		template: 'direct_email',
		to: lead.email,
		toName: lead.name,
		variables: { subject: input.subject.trim(), message: input.message.trim() },
		context: { type: 'lead', id: input.id },
		createdBy: input.actor
	});
	await activity(input.id, 'message_out', `${input.subject.trim()}\n\n${input.message.trim()}`, input.actor, {
		channel: 'email',
		status: message.status
	});
	if (['sent', 'queued'].includes(message.status)) await contacted(input.id, input.actor);
	return message;
}

/** When an order is paid, open leads for the same person are won. */
export async function markWonByOrder(orderId: string): Promise<void> {
	const client = getServiceClient();
	const { data } = await client.from('orders').select('customer_id, ship_phone, order_number').eq('id', orderId).maybeSingle();
	if (!data) return;
	const order = data as { customer_id: string; ship_phone: string | null; order_number: string };
	const { data: customer } = await client.from('customers').select('email').eq('id', order.customer_id).maybeSingle();
	const email = (customer as { email: string } | null)?.email?.toLowerCase() ?? null;
	const phone = normalisePhone(order.ship_phone);
	const ors = [email ? `email.eq.${email}` : null, phone ? `phone.eq.${phone}` : null, `customer_id.eq.${order.customer_id}`].filter(Boolean);
	const { data: leads } = await client.from('leads').select('id').or(ors.join(',')).not('stage', 'in', '(won,lost)');
	for (const lead of (leads ?? []) as { id: string }[]) {
		await client
			.from('leads')
			.update({ stage: 'won', won_order_id: orderId, customer_id: order.customer_id, next_follow_up_at: null })
			.eq('id', lead.id);
		await activity(lead.id, 'order', `Paid order ${order.order_number}`, 'system', { order_id: orderId });
	}
}

/* ------------------------------------------------------------------------ */
/* Where leads and sales come from                                           */
/* ------------------------------------------------------------------------ */

export type SourceRow = { readonly source: string; readonly leads: number; readonly won: number; readonly revenue: Paise };
export type CampaignRow = { readonly campaign: string; readonly orders: number; readonly revenue: Paise; readonly leads: number };

export async function sourceReport(now: number, days: number): Promise<{ sources: SourceRow[]; campaigns: CampaignRow[] }> {
	const client = getServiceClient();
	const since = new Date(now - days * 86_400_000).toISOString();
	const [{ data: leads }, { data: orders }] = await Promise.all([
		client.from('leads').select('source, stage, won_order_id, utm').gte('created_at', since).limit(5000),
		client
			.from('orders')
			.select('id, total_paise, attribution, state')
			.gte('created_at', since)
			.in('state', ['paid', 'packed', 'dispatched', 'delivered'])
			.limit(5000)
	]);
	const orderRows = (orders ?? []) as { id: string; total_paise: number; attribution: Attribution | null }[];
	const revenueOf = new Map(orderRows.map((o) => [o.id, Number(o.total_paise)]));

	const bySource = new Map<string, { leads: number; won: number; revenue: number }>();
	for (const lead of (leads ?? []) as { source: string; stage: string; won_order_id: string | null }[]) {
		const row = bySource.get(lead.source) ?? { leads: 0, won: 0, revenue: 0 };
		row.leads++;
		if (lead.stage === 'won') {
			row.won++;
			row.revenue += lead.won_order_id ? (revenueOf.get(lead.won_order_id) ?? 0) : 0;
		}
		bySource.set(lead.source, row);
	}

	const byCampaign = new Map<string, { orders: number; revenue: number; leads: number }>();
	for (const order of orderRows) {
		const key = describeTouch(order.attribution?.first ?? order.attribution?.last);
		const row = byCampaign.get(key) ?? { orders: 0, revenue: 0, leads: 0 };
		row.orders++;
		row.revenue += Number(order.total_paise);
		byCampaign.set(key, row);
	}
	for (const lead of (leads ?? []) as { utm: Attribution | null }[]) {
		const key = describeTouch(lead.utm?.first ?? lead.utm?.last);
		const row = byCampaign.get(key) ?? { orders: 0, revenue: 0, leads: 0 };
		row.leads++;
		byCampaign.set(key, row);
	}

	return {
		sources: [...bySource.entries()]
			.map(([source, r]) => ({ source, leads: r.leads, won: r.won, revenue: paise(r.revenue) }))
			.sort((a, b) => b.leads - a.leads),
		campaigns: [...byCampaign.entries()]
			.map(([campaign, r]) => ({ campaign, orders: r.orders, revenue: paise(r.revenue), leads: r.leads }))
			.sort((a, b) => Number(b.revenue) - Number(a.revenue) || b.leads - a.leads)
	};
}

/** Staff who can work leads, for the owner picker. */
export async function leadOwners(): Promise<string[]> {
	const { data } = await getServiceClient().from('staff').select('email, is_owner, permissions, active').eq('active', true);
	return ((data ?? []) as { email: string | null; is_owner: boolean; permissions: string[] }[])
		.filter((s) => s.email && (s.is_owner || s.permissions.includes('leads.edit')))
		.map((s) => s.email!)
		.sort();
}

/**
 * A website form became a lead. Called after the form's own record is safely
 * stored; a failure here is logged, never shown to the visitor.
 */
export async function leadFromForm(
	cookies: import('@sveltejs/kit').Cookies,
	input: {
		kind: 'contact' | 'drop_request' | 'notify_me' | 'preorder';
		trackingId: string | null | undefined;
		name?: string | null;
		email: string;
		phone?: string | null;
		dropId?: string | null;
		interest?: string | null;
		detail?: string | null;
		consent: boolean;
	}
): Promise<void> {
	const { catalogueSource } = await import('$lib/server/env');
	if (catalogueSource() !== 'supabase') return;
	const { readAttribution } = await import('$lib/server/attribution/touch');
	const LABEL = { contact: 'Contact form', drop_request: 'Request this drop', notify_me: 'Notify me', preorder: 'Pre-order signup' };
	await captureQuietly({
		name: input.name,
		email: input.email,
		phone: input.phone,
		source: 'website',
		sourceDetail: input.kind,
		dropId: input.dropId,
		interest: input.interest,
		externalId: input.trackingId || null,
		utm: readAttribution(cookies),
		consentEmail: input.consent,
		activity: {
			kind: 'form',
			body: [`${LABEL[input.kind]}${input.interest ? `: ${input.interest}` : ''}`, input.detail].filter(Boolean).join('\n'),
			meta: input.trackingId ? { external_id: input.trackingId } : {}
		},
		inbound: true
	});
}
