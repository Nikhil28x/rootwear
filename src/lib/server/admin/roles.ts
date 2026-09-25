/**
 * RW-141 — §12 role split, expressed once.
 *
 * "TWO PEOPLE HAVE ACCESS. ROOTWEAR OWNS PRODUCTS, STOCK AND ORDERS.
 *  TRONE OWNS LAYOUT, BANNERS AND NEW PAGES."
 *
 *   owner  (Aaron) — everything: drops, products, stock and caps, launch
 *                    schedules, orders, reservations, waitlist, balance links,
 *                    dispatch, customers, the subscriber list, every report.
 *   layout (Trone) — page layouts, hero and banner design, campaign slots,
 *                    site copy outside product listings, new pages, navigation.
 *                    "NO ACCESS TO ORDERS, CUSTOMER RECORDS OR PAYOUTS."
 *
 * The database already enforces this with RLS (0007, 0010, 0012). This module
 * enforces it a SECOND time, in the request path, because hiding a nav item is
 * not access control: a 'layout' user who types /admin/orders must be refused,
 * not merely un-linked. Every admin load calls requireSection() before it
 * touches a repository.
 */
import { error } from '@sveltejs/kit';
import type { AdminActor, StaffRole } from './types';

export const ADMIN_SECTIONS = [
	'dashboard',
	'drops',
	'demand',
	'orders',
	'reservations',
	'fulfilment',
	'contact',
	'layout'
] as const;

export type AdminSection = (typeof ADMIN_SECTIONS)[number];

/**
 * What each role may reach. Written as an allow-list per role rather than a
 * deny-list, so a section added later is INACCESSIBLE to 'layout' until
 * somebody deliberately lists it here.
 */
const ALLOWED: Record<StaffRole, readonly AdminSection[]> = {
	owner: ADMIN_SECTIONS,
	// §12, verbatim: layout access only.
	layout: ['layout']
};

export function canAccess(role: StaffRole, section: AdminSection): boolean {
	return ALLOWED[role].includes(section);
}

/** The refusal text. Says what the boundary IS, not merely that access failed. */
export const FORBIDDEN_MESSAGE =
	'Layout access only. Orders, customer records and payouts are owner-only (§12). ' +
	'Ask Aaron if you need a figure from one of those screens.';

/** Throws 403 unless this actor's role covers the section. */
export function requireSection(actor: AdminActor, section: AdminSection): void {
	if (!canAccess(actor.role, section)) error(403, FORBIDDEN_MESSAGE);
}

/** Convenience for the many owner-only screens. */
export function requireOwner(actor: AdminActor): void {
	if (actor.role !== 'owner') error(403, FORBIDDEN_MESSAGE);
}

export type AdminNavItem = {
	readonly section: AdminSection;
	readonly href: string;
	readonly label: string;
	readonly blurb: string;
};

/** Ordered as the work is done: read the numbers, then act on them. */
const NAV: readonly AdminNavItem[] = [
	{ section: 'dashboard', href: '/admin', label: 'Reports', blurb: 'Performance, ledger, demand, revenue' },
	{ section: 'demand', href: '/admin/demand', label: 'Demand', blurb: 'Requests, notify-me and waitlist by size' },
	{ section: 'drops', href: '/admin/drops', label: 'Drops', blurb: 'State, launch instant, stock and caps' },
	{ section: 'orders', href: '/admin/orders', label: 'Orders', blurb: 'Payment, packing and dispatch' },
	{ section: 'reservations', href: '/admin/reservations', label: 'Reservations', blurb: 'Deposits, balances, piece numbers' },
	{ section: 'fulfilment', href: '/admin/orders/packing-list', label: 'Packing list', blurb: 'Printable list and address labels' },
	{ section: 'contact', href: '/admin/contact', label: 'Contact', blurb: 'Submissions from the contact form' },
	{ section: 'layout', href: '/admin/layout', label: 'Layout', blurb: 'Pages, banners, campaign slots, navigation' }
];

/**
 * The nav this role may see. Filtered here AND enforced per route — the nav is
 * a convenience, `requireSection` is the control.
 */
export function navFor(role: StaffRole): AdminNavItem[] {
	return NAV.filter((item) => canAccess(role, item.section));
}

/**
 * Where this role lands after signing in. The dashboard is owner-only, so a
 * 'layout' user is sent to the first screen they actually own rather than
 * bounced off a 403 the moment they log in.
 */
export function homeFor(role: StaffRole): string {
	return navFor(role)[0]?.href ?? '/admin/layout';
}

/**
 * Only same-origin admin paths may be used as a post-login redirect target.
 * Rejects protocol-relative URLs ("//evil.example") and anything outside
 * /admin, so a crafted ?next= cannot turn the login form into an open redirect.
 */
export function safeNext(next: string | null, role: StaffRole): string {
	if (!next) return homeFor(role);
	if (!next.startsWith('/admin') || next.startsWith('//')) return homeFor(role);
	return next;
}

/**
 * Map a SvelteKit route id to the section that guards it. Longest prefixes
 * first: /admin/orders/packing-list is fulfilment, /admin/orders is orders.
 */
export function sectionForRoute(routeId: string | null): AdminSection {
	const id = routeId ?? '/admin';
	if (id.startsWith('/admin/orders/packing-list')) return 'fulfilment';
	if (id.startsWith('/admin/orders')) return 'orders';
	if (id.startsWith('/admin/reservations')) return 'reservations';
	if (id.startsWith('/admin/demand')) return 'demand';
	if (id.startsWith('/admin/drops')) return 'drops';
	if (id.startsWith('/admin/contact')) return 'contact';
	if (id.startsWith('/admin/layout')) return 'layout';
	return 'dashboard';
}

export const ROLE_LABEL: Record<StaffRole, string> = {
	owner: 'Owner — products, stock, orders',
	layout: 'Layout — pages, banners, navigation'
};
