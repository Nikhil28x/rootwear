/**
 * "Track an order": find an order from its number plus the email or phone it
 * was placed with, and hand back its private page token.
 *
 * Two things must both match — the number alone is printed on parcels and
 * invoices, so it is not a secret. A wrong guess and an unknown number get the
 * same answer, so the form can't be used to test whether an order exists.
 *
 * Guessing is slowed two ways, both deliberately lenient (a real customer
 * mistyping a few times is never locked out):
 *   - per visitor: the platform limit on posts (ratelimit.ts, /track is in
 *     the strict list: 10 a minute), and below, 10 failed lookups in 15
 *     minutes blocks that visitor for 20 minutes;
 *   - per order: 8 failed lookups against one order number in 30 minutes
 *     locks lookups for that number for 30 minutes, from any visitor, so the
 *     contact details can't be guessed from many addresses at once.
 * Counts live in memory per server instance — a speed bump, not a vault; the
 * real protection is that both the number and the contact must be known.
 *
 * Later: a one-time code by email or WhatsApp, and lookup by tracking number.
 */
import { getServiceClient } from '$lib/server/db/clients';
import { catalogueSource } from '$lib/server/env';

const MINUTE = 60_000;
const VISITOR = { failures: 10, windowMs: 15 * MINUTE, blockMs: 20 * MINUTE };
const ORDER = { failures: 8, windowMs: 30 * MINUTE, blockMs: 30 * MINUTE };

type Counter = { failures: number[]; blockedUntil: number };
const visitors = new Map<string, Counter>();
const orderNumbers = new Map<string, Counter>();

function counter(map: Map<string, Counter>, key: string): Counter {
	let entry = map.get(key);
	if (!entry) {
		entry = { failures: [], blockedUntil: 0 };
		map.set(key, entry);
	}
	return entry;
}

/** Remember a failure; block once the window holds too many. */
function fail(map: Map<string, Counter>, key: string, rule: typeof VISITOR, now: number) {
	const entry = counter(map, key);
	entry.failures = entry.failures.filter((at) => now - at < rule.windowMs);
	entry.failures.push(now);
	if (entry.failures.length >= rule.failures) {
		entry.blockedUntil = now + rule.blockMs;
		entry.failures = [];
	}
	// Keep the maps small: forget quiet entries now and then.
	if (map.size > 5000) {
		for (const [k, v] of map) if (v.blockedUntil < now && !v.failures.length) map.delete(k);
	}
}

const blocked = (map: Map<string, Counter>, key: string, now: number) =>
	(map.get(key)?.blockedUntil ?? 0) > now;

/** "rw261108abcde", "RW261108-ABCDE " → "RW261108-ABCDE"; null if it isn't one. */
export function normaliseOrderNumber(value: string): string | null {
	const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
	const match = clean.match(/^RW(\d{6})([A-Z0-9]{5})$/);
	return match ? `RW${match[1]}-${match[2]}` : null;
}

const lastTen = (phone: string) => phone.replace(/\D/g, '').slice(-10);

export type LookupResult =
	| { status: 'found'; token: string }
	| { status: 'not_found' }
	| { status: 'blocked' };

export async function lookupOrder(input: {
	orderNumber: string;
	contact: string;
	visitor: string;
	now: number;
}): Promise<LookupResult> {
	const { visitor, now } = input;
	const number = normaliseOrderNumber(input.orderNumber);
	if (blocked(visitors, visitor, now) || (number && blocked(orderNumbers, number, now))) {
		return { status: 'blocked' };
	}

	const contact = input.contact.trim().toLowerCase();
	const byEmail = contact.includes('@');
	const token = number && contact ? await match(number, contact, byEmail) : null;
	if (token) return { status: 'found', token };

	fail(visitors, visitor, VISITOR, now);
	if (number) fail(orderNumbers, number, ORDER, now);
	return { status: 'not_found' };
}

async function match(number: string, contact: string, byEmail: boolean): Promise<string | null> {
	// Orders live only in the database; with the in-repo fixtures there are none to find.
	if (catalogueSource() !== 'supabase') return null;
	const db = getServiceClient();
	const { data: order, error } = await db
		.from('orders')
		.select('public_token, ship_phone, customer_id')
		.eq('order_number', number)
		.maybeSingle<{ public_token: string; ship_phone: string | null; customer_id: string | null }>();
	if (error) throw new Error(`order lookup failed: ${error.message}`);
	if (!order) return null;

	if (!byEmail) {
		const given = lastTen(contact);
		return given.length === 10 && lastTen(order.ship_phone ?? '') === given ? order.public_token : null;
	}
	if (!order.customer_id) return null;
	const { data: customer } = await db
		.from('customers')
		.select('email')
		.eq('id', order.customer_id)
		.maybeSingle<{ email: string | null }>();
	return customer?.email?.trim().toLowerCase() === contact ? order.public_token : null;
}
