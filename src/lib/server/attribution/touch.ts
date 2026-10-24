/**
 * Where a visitor came from: the UTM tags (and click ids) on the URL they
 * landed on, kept in a first-party cookie as the FIRST touch (kept for 30
 * days) and the LAST touch (replaced by each tagged visit). Leads and orders
 * copy it, so admin can say which campaign brought which sale.
 *
 * Only tagged landings are recorded; ordinary browsing never overwrites a
 * campaign. Nothing here identifies a person; it is the link they followed.
 */
import type { Cookies } from '@sveltejs/kit';

export const TOUCH_COOKIE = 'rw_touch';
const KEYS = [
	'utm_source',
	'utm_medium',
	'utm_campaign',
	'utm_content',
	'utm_term',
	'fbclid',
	'gclid'
] as const;

export type Touch = {
	readonly source?: string;
	readonly medium?: string;
	readonly campaign?: string;
	readonly content?: string;
	readonly term?: string;
	readonly click?: 'meta' | 'google';
	readonly landing: string;
	readonly referrer?: string;
	readonly at: number;
};

export type Attribution = { readonly first?: Touch; readonly last?: Touch };

function clean(value: string | null): string | undefined {
	const text = value?.trim().slice(0, 120);
	return text ? text : undefined;
}

/** The touch on this URL, or null when it carries no campaign tags. */
export function touchFrom(url: URL, referrer: string | null, now: number): Touch | null {
	if (!KEYS.some((key) => url.searchParams.has(key))) return null;
	let ref: string | undefined;
	try {
		ref = referrer ? new URL(referrer).hostname : undefined;
	} catch {
		ref = undefined;
	}
	return {
		source: clean(url.searchParams.get('utm_source')),
		medium: clean(url.searchParams.get('utm_medium')),
		campaign: clean(url.searchParams.get('utm_campaign')),
		content: clean(url.searchParams.get('utm_content')),
		term: clean(url.searchParams.get('utm_term')),
		click: url.searchParams.has('fbclid')
			? 'meta'
			: url.searchParams.has('gclid')
				? 'google'
				: undefined,
		landing: url.pathname,
		referrer: ref && ref !== url.hostname ? ref : undefined,
		at: now
	};
}

export function readAttribution(cookies: Cookies): Attribution {
	const raw = cookies.get(TOUCH_COOKIE);
	if (!raw) return {};
	try {
		const parsed = JSON.parse(raw) as Attribution;
		return typeof parsed === 'object' && parsed ? parsed : {};
	} catch {
		return {};
	}
}

export function recordTouch(cookies: Cookies, touch: Touch): void {
	const current = readAttribution(cookies);
	const value: Attribution = { first: current.first ?? touch, last: touch };
	cookies.set(TOUCH_COOKIE, JSON.stringify(value), {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: 60 * 60 * 24 * 30
	});
}

/** "instagram / story / drop02" — the campaign as one line, for tables. */
export function describeTouch(touch: Touch | undefined): string {
	if (!touch) return 'Direct';
	const parts = [
		touch.source ??
			(touch.click === 'meta'
				? 'meta ads'
				: touch.click === 'google'
					? 'google ads'
					: touch.referrer),
		touch.medium,
		touch.campaign
	].filter(Boolean);
	return parts.length ? parts.join(' / ') : 'Direct';
}

/** Copies the visitor's campaign onto their order. Best effort: never blocks checkout. */
export async function stampOrder(orderId: string, cookies: Cookies): Promise<void> {
	const attribution = readAttribution(cookies);
	if (!attribution.first && !attribution.last) return;
	try {
		const { getServiceClient } = await import('$lib/server/db/clients');
		await getServiceClient().from('orders').update({ attribution }).eq('id', orderId);
	} catch (error) {
		console.error('[attribution] order stamp failed', error);
	}
}
