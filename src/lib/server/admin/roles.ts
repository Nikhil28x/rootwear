/**
 * RW-141 — Who may open which admin screen, expressed once.
 *
 * Access started as §12's two roles ("ROOTWEAR OWNS PRODUCTS, STOCK AND
 * ORDERS. TRONE OWNS LAYOUT, BANNERS AND NEW PAGES."). The CMS needs packers,
 * support and an accountant, so it is now a permission list per person
 * (src/lib/admin/permissions.ts, app.staff.permissions). Trone's account
 * carries exactly 'layout.edit', which is the old 'layout' role unchanged.
 *
 * This module enforces access in the request path, because hiding a nav item
 * is not access control: someone without 'orders.view' who types
 * /admin/orders must be refused, not merely un-linked. Every admin load calls
 * requireSection() or requirePermission() before it touches a repository.
 */
import { error } from '@sveltejs/kit';
import type { PermissionKey } from '$lib/admin/permissions';
import type { AdminActor } from './types';

export const ADMIN_SECTIONS = [
	'dashboard',
	'submissions',
	'drops',
	'demand',
	'orders',
	'reservations',
	'fulfilment',
	'invoices',
	'carts',
	'leads',
	'customers',
	'contact',
	'coupons',
	'broadcasts',
	'influencers',
	'layout',
	'messages',
	'settings',
	'staff',
	'audit'
] as const;

export type AdminSection = (typeof ADMIN_SECTIONS)[number];

/** The permission that opens each section. */
const SECTION_PERMISSION: Record<AdminSection, PermissionKey> = {
	dashboard: 'reports.view',
	submissions: 'leads.view',
	drops: 'catalogue.view',
	demand: 'reports.view',
	orders: 'orders.view',
	reservations: 'orders.view',
	fulfilment: 'orders.view',
	invoices: 'finance.view',
	carts: 'carts.view',
	leads: 'leads.view',
	customers: 'customers.view',
	contact: 'leads.view',
	coupons: 'marketing.edit',
	broadcasts: 'marketing.edit',
	influencers: 'marketing.edit',
	layout: 'layout.edit',
	messages: 'messages.view',
	settings: 'settings.edit',
	staff: 'staff.manage',
	audit: 'audit.view'
};

export function can(actor: AdminActor, permission: PermissionKey): boolean {
	return actor.isOwner || actor.permissions.includes(permission);
}

export function canAccess(actor: AdminActor, section: AdminSection): boolean {
	return can(actor, SECTION_PERMISSION[section]);
}

/** The refusal text. Says what the boundary IS, not merely that access failed. */
export function forbiddenMessage(permission: PermissionKey): string {
	return (
		`Your account does not have the "${permission}" permission. ` +
		'Ask an owner to add it from Settings → Staff if you need this screen.'
	);
}

/** Throws 403 unless this actor holds the permission. */
export function requirePermission(actor: AdminActor, permission: PermissionKey): void {
	if (!can(actor, permission)) error(403, forbiddenMessage(permission));
}

/** Throws 403 unless this actor may open the section. */
export function requireSection(actor: AdminActor, section: AdminSection): void {
	requirePermission(actor, SECTION_PERMISSION[section]);
}

/** For the few actions only an owner may take, such as promoting another owner. */
export function requireOwner(actor: AdminActor): void {
	if (!actor.isOwner) error(403, 'Only an owner can do this.');
}

export type AdminNavIcon =
	| 'chart'
	| 'inbox'
	| 'package'
	| 'receipt'
	| 'clock'
	| 'truck'
	| 'cart'
	| 'users'
	| 'user'
	| 'megaphone'
	| 'ticket'
	| 'sparkles'
	| 'layout'
	| 'trending'
	| 'file'
	| 'message'
	| 'settings'
	| 'shield'
	| 'history';

export type AdminNavItem = {
	readonly section: AdminSection;
	readonly href: string;
	readonly label: string;
	readonly icon: AdminNavIcon;
};

export type AdminNavGroup = {
	readonly label: string | null;
	readonly items: readonly AdminNavItem[];
};

/** Ordered as the work is done: read the numbers, then act on them. */
const NAV: readonly AdminNavGroup[] = [
	{
		label: null,
		items: [{ section: 'dashboard', href: '/admin', label: 'Overview', icon: 'chart' }]
	},
	{
		label: 'Sell',
		items: [
			{ section: 'drops', href: '/admin/drops', label: 'Drops', icon: 'package' },
			{ section: 'orders', href: '/admin/orders', label: 'Orders', icon: 'receipt' },
			{ section: 'reservations', href: '/admin/reservations', label: 'Pre-orders', icon: 'clock' },
			{ section: 'fulfilment', href: '/admin/orders/packing-list', label: 'Packing list', icon: 'truck' },
			{ section: 'carts', href: '/admin/carts', label: 'Carts', icon: 'cart' },
			{ section: 'invoices', href: '/admin/invoices', label: 'Invoices', icon: 'file' }
		]
	},
	{
		label: 'People',
		items: [
			{ section: 'leads', href: '/admin/leads', label: 'Leads', icon: 'inbox' },
			{ section: 'customers', href: '/admin/customers', label: 'Customers', icon: 'users' },
			{ section: 'submissions', href: '/admin/submissions', label: 'Form inbox', icon: 'message' },
			{ section: 'demand', href: '/admin/demand', label: 'Demand', icon: 'trending' }
		]
	},
	{
		label: 'Grow',
		items: [
			{ section: 'coupons', href: '/admin/coupons', label: 'Coupons', icon: 'ticket' },
			{ section: 'broadcasts', href: '/admin/broadcasts', label: 'Broadcasts', icon: 'megaphone' },
			{ section: 'influencers', href: '/admin/influencers', label: 'Seeding', icon: 'sparkles' },
			{ section: 'layout', href: '/admin/layout', label: 'Layout', icon: 'layout' }
		]
	}
];

/** Pinned to the bottom of the sidebar. */
const NAV_FOOTER: readonly AdminNavItem[] = [
	{ section: 'messages', href: '/admin/messages', label: 'Messages', icon: 'message' },
	{ section: 'audit', href: '/admin/audit', label: 'Audit log', icon: 'history' },
	{ section: 'settings', href: '/admin/settings', label: 'Settings', icon: 'settings' }
];

/**
 * Sections whose screens exist. A section is listed here once its route is
 * built, so the nav never links to a 404 while the CMS is being filled in.
 */
const BUILT = new Set<AdminSection>([
	'dashboard',
	'submissions',
	'drops',
	'demand',
	'orders',
	'reservations',
	'fulfilment',
	'invoices',
	'carts',
	'contact',
	'layout',
	'messages',
	'settings',
	'staff',
	'audit'
]);

function visible(actor: AdminActor, item: AdminNavItem): boolean {
	return BUILT.has(item.section) && canAccess(actor, item.section);
}

/**
 * The nav this person may see. Filtered here AND enforced per route — the nav
 * is a convenience, requireSection is the control.
 */
export function navFor(actor: AdminActor): { groups: AdminNavGroup[]; footer: AdminNavItem[] } {
	const groups = NAV.map((group) => ({
		label: group.label,
		items: group.items.filter((item) => visible(actor, item))
	})).filter((group) => group.items.length > 0);

	// Settings is reachable by anyone who can manage staff, even without
	// settings.edit, because the staff screen lives under it.
	const footer = NAV_FOOTER.filter(
		(item) =>
			visible(actor, item) ||
			(item.section === 'settings' && BUILT.has('staff') && canAccess(actor, 'staff'))
	);
	return { groups, footer };
}

/**
 * Where this person lands after signing in: the first screen they can open,
 * rather than a 403 the moment they log in.
 */
export function homeFor(actor: AdminActor): string {
	const { groups, footer } = navFor(actor);
	return groups[0]?.items[0]?.href ?? footer[0]?.href ?? '/admin/account';
}

/**
 * Only same-origin admin paths may be used as a post-login redirect target.
 * Rejects protocol-relative URLs ("//evil.example") and anything outside
 * /admin, so a crafted ?next= cannot turn the login form into an open redirect.
 */
export function safeNext(next: string | null, actor: AdminActor): string {
	if (!next) return homeFor(actor);
	if (!next.startsWith('/admin') || next.startsWith('//')) return homeFor(actor);
	return next;
}

/**
 * Map a SvelteKit route id to the section that guards it. Longest prefixes
 * first: /admin/orders/packing-list is fulfilment, /admin/orders is orders.
 * Returns null for screens every staff member may open (their own account).
 */
export function sectionForRoute(routeId: string | null): AdminSection | null {
	const id = routeId ?? '/admin';
	// The settings index only redirects to the first tab this person can open.
	if (id.startsWith('/admin/account') || id === '/admin/settings') return null;
	// One invoice opens for orders.view OR finance.view; the page checks both.
	if (id.startsWith('/admin/invoices/[id]')) return null;
	if (id.startsWith('/admin/orders/packing-list')) return 'fulfilment';
	if (id.startsWith('/admin/settings/staff')) return 'staff';
	const match = ADMIN_SECTIONS.filter((section) => section !== 'dashboard').find((section) =>
		id.startsWith(`/admin/${section}`)
	);
	return match ?? 'dashboard';
}

/** A short description of what someone can do, for the staff list. */
export function accessSummary(actor: Pick<AdminActor, 'isOwner' | 'permissions'>): string {
	if (actor.isOwner) return 'Owner — full access';
	const count = actor.permissions.length;
	if (count === 0) return 'No access';
	return `${count} permission${count === 1 ? '' : 's'}`;
}

/**
 * Privilege escalation guard for the staff screens. Someone who can manage
 * staff but is not an owner may only hand out permissions they hold
 * themselves, and may not touch an owner's account. Otherwise "manage staff"
 * would be a back door to every other permission, including on their own row.
 * Returns the refusal sentence, or null when allowed.
 */
export function grantRefusal(
	actor: AdminActor,
	permissions: readonly string[],
	target?: { isOwner: boolean }
): string | null {
	if (actor.isOwner) return null;
	if (target?.isOwner) return 'Only an owner can change an owner’s access.';
	const beyond = permissions.filter((key) => !actor.permissions.includes(key as PermissionKey));
	return beyond.length
		? `You can only give permissions you have yourself. Remove: ${beyond.join(', ')}.`
		: null;
}
