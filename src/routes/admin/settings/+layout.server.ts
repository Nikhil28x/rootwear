import type { LayoutServerLoad } from './$types';
import { canAccess } from '$lib/server/admin/roles';
import { staffActor } from '$lib/server/admin/session';

/** The settings tabs this person can open. Each tab's own load still checks. */
export const load: LayoutServerLoad = async (event) => {
	const actor = await staffActor(event);
	const tabs: { href: string; label: string }[] = [];
	if (canAccess(actor, 'settings')) {
		tabs.push({ href: '/admin/settings/business', label: 'Business & GST' });
		tabs.push({ href: '/admin/settings/shipping', label: 'Shipping' });
		tabs.push({ href: '/admin/settings/alerts', label: 'Alerts & digest' });
		tabs.push({ href: '/admin/settings/channels', label: 'Email & WhatsApp' });
	}
	if (canAccess(actor, 'staff')) tabs.push({ href: '/admin/settings/staff', label: 'Staff' });
	return { settingsTabs: tabs.filter((tab) => BUILT_TABS.has(tab.href)) };
};

/** Tabs whose screens exist; the rest appear as they are built. */
const BUILT_TABS = new Set([
	'/admin/settings/business',
	'/admin/settings/shipping',
	'/admin/settings/alerts',
	'/admin/settings/channels',
	'/admin/settings/staff'
]);
