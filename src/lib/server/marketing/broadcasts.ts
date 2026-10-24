/**
 * Broadcasts: one message to a chosen audience — typically "the drop is
 * live" to everyone who asked to hear first.
 *
 * Everyone in an audience OPTED IN (§13): notify-me, request and pre-order
 * forms require a ticked consent box; leads and customers count only when
 * their consent is recorded. Each address gets one message per broadcast,
 * however many audiences they are in.
 *
 * Every recipient is an outbox row (context 'broadcast'), so delivery,
 * retries and failures are the outbox's job and the broadcast's progress is
 * read back from it.
 */
import { getCatalogueClient, getServiceClient } from '$lib/server/db/clients';
import { writeAudit } from '$lib/server/admin/audit';
import { deliver, enqueue } from '$lib/server/messaging/outbox';
import { siteUrl } from '$lib/server/messaging/config';
import { whatsAppNumber } from '$lib/server/messaging/render';

export class BroadcastError extends Error {}

export const AUDIENCES = [
	{
		value: 'notify_me',
		label: 'Notify-me sign-ups',
		detail: 'Asked to hear when a size comes back',
		needsDrop: true
	},
	{ value: 'waitlist', label: 'Waitlist', detail: 'Waiting for a sold-out size', needsDrop: true },
	{
		value: 'preorder',
		label: 'Pre-order sign-ups',
		detail: 'Signed up to pre-order (has phone numbers)',
		needsDrop: true
	},
	{
		value: 'drop_request',
		label: 'Drop requests',
		detail: 'Asked for this drop to come back',
		needsDrop: true
	},
	{
		value: 'leads',
		label: 'Open leads who agreed',
		detail: 'Leads with email or WhatsApp consent',
		needsDrop: false
	},
	{
		value: 'customers',
		label: 'Customers who agreed',
		detail: 'Past buyers who opted in to marketing',
		needsDrop: false
	}
] as const;
export type Audience = (typeof AUDIENCES)[number]['value'];

export type Recipient = {
	name: string | null;
	email: string | null;
	phone: string | null;
	whatsapp: boolean;
};

async function variantIdsOf(dropId: string): Promise<string[]> {
	const { data: products } = await getCatalogueClient()
		.from('products')
		.select('id')
		.eq('drop_id', dropId);
	const ids = ((products ?? []) as { id: string }[]).map((p) => p.id);
	if (!ids.length) return [];
	const { data } = await getCatalogueClient().from('variants').select('id').in('product_id', ids);
	return ((data ?? []) as { id: string }[]).map((v) => v.id);
}

/** Everyone in the chosen audiences, merged by email or phone. */
export async function recipients(
	audiences: readonly Audience[],
	dropId: string | null
): Promise<Recipient[]> {
	const client = getServiceClient();
	const people: Recipient[] = [];
	const variants = dropId ? await variantIdsOf(dropId) : [];

	if (dropId && variants.length) {
		if (audiences.includes('notify_me')) {
			const { data } = await client
				.from('notify_requests')
				.select('email')
				.in('variant_id', variants)
				.is('notified_at', null);
			for (const r of (data ?? []) as { email: string }[])
				people.push({ name: null, email: r.email, phone: null, whatsapp: false });
		}
		if (audiences.includes('waitlist')) {
			const { data } = await client
				.from('waitlist_entries')
				.select('customer_id')
				.eq('drop_id', dropId)
				.eq('state', 'waiting');
			const ids = ((data ?? []) as { customer_id: string }[]).map((w) => w.customer_id);
			if (ids.length) {
				const { data: cs } = await client.from('customers').select('email, phone').in('id', ids);
				for (const c of (cs ?? []) as { email: string; phone: string | null }[])
					people.push({ name: null, email: c.email, phone: null, whatsapp: false });
			}
		}
		if (audiences.includes('preorder')) {
			const { data } = await client
				.from('preorder_signups')
				.select('name, email, phone')
				.eq('drop_id', dropId)
				.is('converted_at', null);
			for (const r of (data ?? []) as { name: string; email: string; phone: string }[]) {
				people.push({ name: r.name, email: r.email, phone: r.phone, whatsapp: true });
			}
		}
		if (audiences.includes('drop_request')) {
			const { data } = await client
				.from('drop_requests')
				.select('email')
				.eq('drop_id', dropId)
				.is('fulfilled_at', null);
			for (const r of (data ?? []) as { email: string }[])
				people.push({ name: null, email: r.email, phone: null, whatsapp: false });
		}
	}
	if (audiences.includes('leads')) {
		const { data } = await client
			.from('leads')
			.select('name, email, phone, consent_email, consent_whatsapp')
			.not('stage', 'in', '(won,lost)')
			.or('consent_email.eq.true,consent_whatsapp.eq.true');
		for (const l of (data ?? []) as {
			name: string | null;
			email: string | null;
			phone: string | null;
			consent_email: boolean;
			consent_whatsapp: boolean;
		}[]) {
			people.push({
				name: l.name,
				email: l.consent_email ? l.email : null,
				phone: l.consent_whatsapp ? l.phone : null,
				whatsapp: l.consent_whatsapp
			});
		}
	}
	if (audiences.includes('customers')) {
		const { data } = await client
			.from('customers')
			.select('email, phone, marketing_email, marketing_whatsapp')
			.or('marketing_email.eq.true,marketing_whatsapp.eq.true');
		for (const c of (data ?? []) as {
			email: string;
			phone: string | null;
			marketing_email: boolean;
			marketing_whatsapp: boolean;
		}[]) {
			people.push({
				name: null,
				email: c.marketing_email ? c.email : null,
				phone: c.marketing_whatsapp ? c.phone : null,
				whatsapp: c.marketing_whatsapp
			});
		}
	}

	// Merge: one person per email, phones attached where known.
	const byEmail = new Map<string, Recipient>();
	const phoneOnly = new Map<string, Recipient>();
	for (const p of people) {
		const email = p.email?.trim().toLowerCase() || null;
		const phone = p.phone ? whatsAppNumber(p.phone) : null;
		if (email) {
			const existing = byEmail.get(email);
			byEmail.set(email, {
				name: existing?.name ?? p.name,
				email,
				phone: existing?.phone ?? (p.whatsapp ? phone : null),
				whatsapp: Boolean(existing?.whatsapp || (p.whatsapp && phone))
			});
		} else if (phone && p.whatsapp) {
			phoneOnly.set(phone, { name: p.name, email: null, phone, whatsapp: true });
		}
	}
	const withPhone = new Set([...byEmail.values()].map((r) => r.phone).filter(Boolean));
	return [...byEmail.values(), ...[...phoneOnly.values()].filter((r) => !withPhone.has(r.phone))];
}

export type BroadcastInput = {
	name: string;
	dropId: string | null;
	audiences: Audience[];
	channels: ('email' | 'whatsapp')[];
	kind: 'drop_live' | 'custom';
	subject: string;
	message: string;
};

export async function preview(input: Pick<BroadcastInput, 'audiences' | 'dropId'>) {
	const list = await recipients(input.audiences, input.dropId);
	return {
		email: list.filter((r) => r.email).length,
		whatsapp: list.filter((r) => r.whatsapp && r.phone).length
	};
}

/** Sends a broadcast now. Returns how many messages were queued. */
export async function sendBroadcast(
	input: BroadcastInput,
	actor: string
): Promise<{ id: string; queued: number }> {
	if (!input.name.trim()) throw new BroadcastError('Name the broadcast so you can find it later.');
	if (!input.audiences.length) throw new BroadcastError('Pick who it goes to.');
	if (!input.channels.length) throw new BroadcastError('Pick email, WhatsApp or both.');
	if (AUDIENCES.some((a) => a.needsDrop && input.audiences.includes(a.value)) && !input.dropId) {
		throw new BroadcastError('Pick the drop: those audiences belong to one.');
	}
	if (
		input.kind === 'custom' &&
		(!input.message.trim() || (input.channels.includes('email') && !input.subject.trim()))
	) {
		throw new BroadcastError('Write the message, and a subject for email.');
	}

	const client = getServiceClient();
	let drop: { name: string; slug: string } | null = null;
	if (input.dropId) {
		const { data } = await getCatalogueClient()
			.from('drops')
			.select('name, slug')
			.eq('id', input.dropId)
			.single();
		drop = data as { name: string; slug: string } | null;
	}
	if (input.kind === 'drop_live' && !drop) throw new BroadcastError('“Drop is live” needs a drop.');

	const list = await recipients(input.audiences, input.dropId);
	if (!list.length)
		throw new BroadcastError('Nobody in those audiences has agreed to hear from you yet.');

	const emailTemplate = input.kind === 'drop_live' ? 'drop_live_email' : 'broadcast_email';
	const waTemplate = input.kind === 'drop_live' ? 'drop_live_whatsapp' : 'broadcast_whatsapp';

	const { data, error } = await client
		.from('broadcasts')
		.insert({
			name: input.name.trim(),
			drop_id: input.dropId,
			audiences: input.audiences,
			channels: input.channels,
			email_template: input.channels.includes('email') ? emailTemplate : null,
			whatsapp_template: input.channels.includes('whatsapp') ? waTemplate : null,
			status: 'sending',
			created_by: actor
		})
		.select('id')
		.single();
	if (error || !data) throw new Error(`broadcast create failed: ${error?.message}`);
	const id = (data as { id: string }).id;

	const common = {
		drop_name: drop?.name ?? '',
		drop_url: drop
			? `${siteUrl()}/drops/${drop.slug}?utm_source=broadcast&utm_medium=${'{channel}'}&utm_campaign=${encodeURIComponent(input.name.trim().toLowerCase().replace(/\s+/g, '-'))}`
			: siteUrl(),
		subject: input.subject.trim(),
		message: input.message.trim()
	};

	let queued = 0;
	for (const person of list) {
		const name = person.name?.split(' ')[0] ?? 'there';
		if (input.channels.includes('email') && person.email) {
			await enqueue({
				template: emailTemplate,
				to: person.email,
				toName: person.name,
				variables: { ...common, name, drop_url: common.drop_url.replace('{channel}', 'email') },
				context: { type: 'broadcast', id },
				createdBy: actor,
				sendNow: false
			});
			queued++;
		}
		if (input.channels.includes('whatsapp') && person.whatsapp && person.phone) {
			await enqueue({
				template: waTemplate,
				to: person.phone,
				toName: person.name,
				variables: { ...common, name, drop_url: common.drop_url.replace('{channel}', 'whatsapp') },
				context: { type: 'broadcast', id },
				createdBy: actor,
				sendNow: false
			});
			queued++;
		}
	}

	await client
		.from('broadcasts')
		.update({ recipients: queued, status: 'sent', sent_at: new Date().toISOString() })
		.eq('id', id);

	// Notify-me is a promise kept once: those rows are now notified.
	if (input.kind === 'drop_live' && input.dropId && input.audiences.includes('notify_me')) {
		const variants = await variantIdsOf(input.dropId);
		if (variants.length)
			await client
				.from('notify_requests')
				.update({ notified_at: new Date().toISOString() })
				.in('variant_id', variants)
				.is('notified_at', null);
	}

	await writeAudit(actor, `broadcast sent to ${queued}`, 'broadcast', id, {
		audiences: input.audiences,
		channels: input.channels
	});

	// Send the first few hundred now; the outbox cron sends the rest.
	for (let round = 0; round < 8; round++) {
		const batch = await deliver();
		if (batch.length === 0) break;
	}
	return { id, queued };
}

export type BroadcastSummary = {
	readonly id: string;
	readonly name: string;
	readonly dropId: string | null;
	readonly audiences: readonly string[];
	readonly channels: readonly string[];
	readonly recipients: number;
	readonly createdBy: string | null;
	readonly sentAt: number | null;
	readonly stats: { sent: number; delivered: number; read: number; failed: number; queued: number };
};

export async function listBroadcasts(): Promise<BroadcastSummary[]> {
	const client = getServiceClient();
	const { data } = await client
		.from('broadcasts')
		.select('*')
		.order('created_at', { ascending: false })
		.limit(50);
	const rows = (data ?? []) as {
		id: string;
		name: string;
		drop_id: string | null;
		audiences: string[];
		channels: string[];
		recipients: number;
		created_by: string | null;
		sent_at: string | null;
	}[];
	const { data: messages } = rows.length
		? await client
				.from('message_outbox')
				.select('context_id, status')
				.eq('context_type', 'broadcast')
				.in(
					'context_id',
					rows.map((r) => r.id)
				)
		: { data: [] };
	const ms = (messages ?? []) as { context_id: string; status: string }[];
	return rows.map((r) => {
		const mine = ms.filter((m) => m.context_id === r.id);
		const count = (...s: string[]) => mine.filter((m) => s.includes(m.status)).length;
		return {
			id: r.id,
			name: r.name,
			dropId: r.drop_id,
			audiences: r.audiences,
			channels: r.channels,
			recipients: r.recipients,
			createdBy: r.created_by,
			sentAt: r.sent_at ? Date.parse(r.sent_at) : null,
			stats: {
				sent: count('sent', 'delivered', 'read'),
				delivered: count('delivered', 'read'),
				read: count('read'),
				failed: count('failed', 'skipped'),
				queued: count('queued', 'sending')
			}
		};
	});
}
