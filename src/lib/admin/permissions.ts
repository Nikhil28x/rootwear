/**
 * Staff permissions — the one list of what a person can be allowed to do.
 *
 * Shared (not under $lib/server) because the staff editor renders these as
 * checkboxes. It holds names and descriptions only; every check that GRANTS
 * anything runs on the server (src/lib/server/admin/roles.ts).
 *
 * Owners hold every permission implicitly, including ones added later. Anyone
 * else holds exactly the keys ticked for them, so a new key is inaccessible to
 * non-owners until somebody deliberately grants it.
 */

export const PERMISSION_GROUPS = [
	{
		label: 'Overview',
		permissions: [
			{ key: 'reports.view', label: 'See reports', detail: 'Sales, revenue, demand and drop performance.' }
		]
	},
	{
		label: 'Catalogue',
		permissions: [
			{ key: 'catalogue.view', label: 'See drops and products', detail: 'Read-only view of drops, products and stock.' },
			{ key: 'catalogue.edit', label: 'Edit drops and products', detail: 'Prices, copy, images, sizes, stock and visibility.' }
		]
	},
	{
		label: 'Orders',
		permissions: [
			{ key: 'orders.view', label: 'See orders', detail: 'Orders, pre-orders, addresses and the packing list.' },
			{ key: 'orders.edit', label: 'Fulfil orders', detail: 'Pack, dispatch, add notes, record returns.' },
			{ key: 'orders.refund', label: 'Refund and cancel', detail: 'Moves money back to customers.' },
			{ key: 'carts.view', label: 'See carts', detail: 'Live and abandoned carts.' },
			{ key: 'carts.recover', label: 'Send cart reminders', detail: 'Email or WhatsApp a customer about their cart.' }
		]
	},
	{
		label: 'Customers',
		permissions: [
			{ key: 'customers.view', label: 'See customers', detail: 'Names, contact details and order history.' },
			{ key: 'customers.edit', label: 'Edit customers', detail: 'Update contact details, notes and consent.' },
			{ key: 'leads.view', label: 'See leads', detail: 'Every lead, form submission and message.' },
			{ key: 'leads.edit', label: 'Work leads', detail: 'Add, assign, move and reply to leads.' }
		]
	},
	{
		label: 'Marketing',
		permissions: [
			{ key: 'marketing.edit', label: 'Run marketing', detail: 'Coupons, launch broadcasts and influencer seeding.' }
		]
	},
	{
		label: 'Content',
		permissions: [
			{ key: 'layout.edit', label: 'Edit site layout', detail: 'Pages, banners, campaign slots and navigation.' }
		]
	},
	{
		label: 'Finance',
		permissions: [
			{ key: 'finance.view', label: 'Invoices and accounts', detail: 'Invoices, credit notes and the accountant export.' }
		]
	},
	{
		label: 'Administration',
		permissions: [
			{ key: 'messages.view', label: 'See messages', detail: 'The log of every email and WhatsApp sent.' },
			{ key: 'messages.edit', label: 'Edit message templates', detail: 'Change what customers receive.' },
			{ key: 'settings.edit', label: 'Change settings', detail: 'Shipping, GST, business details and policies.' },
			{ key: 'staff.manage', label: 'Manage staff', detail: 'Add people and change what they can do.' },
			{ key: 'audit.view', label: 'See the audit log', detail: 'Every change made in admin, and by whom.' }
		]
	}
] as const;

export type PermissionKey =
	(typeof PERMISSION_GROUPS)[number]['permissions'][number]['key'];

export const PERMISSION_KEYS: readonly PermissionKey[] = PERMISSION_GROUPS.flatMap((group) =>
	group.permissions.map((p) => p.key)
);

export function isPermissionKey(value: string): value is PermissionKey {
	return (PERMISSION_KEYS as readonly string[]).includes(value);
}

/** Starting points for a new person. Ticking boxes afterwards is still allowed. */
export const PERMISSION_PRESETS: readonly {
	readonly id: string;
	readonly label: string;
	readonly detail: string;
	readonly permissions: readonly PermissionKey[];
}[] = [
	{
		id: 'packing',
		label: 'Packing',
		detail: 'Sees orders and addresses, marks them packed and dispatched. No money.',
		permissions: ['orders.view', 'orders.edit']
	},
	{
		id: 'support',
		label: 'Support',
		detail: 'Leads, customers, orders and carts. No refunds, stock or prices.',
		permissions: [
			'orders.view',
			'carts.view',
			'carts.recover',
			'customers.view',
			'customers.edit',
			'leads.view',
			'leads.edit',
			'messages.view'
		]
	},
	{
		id: 'accountant',
		label: 'Accountant',
		detail: 'Read-only: reports, orders, invoices and exports.',
		permissions: ['reports.view', 'orders.view', 'finance.view']
	},
	{
		id: 'layout',
		label: 'Layout',
		detail: 'Pages, banners and navigation only.',
		permissions: ['layout.edit']
	}
];
