/**
 * Human labels and chip tones for every status admin shows, in one place so
 * "Not sent" means the same thing on every screen.
 */
import type { ChipTone } from './ui/Chip.svelte';

type Label = { readonly label: string; readonly tone: ChipTone };

export const MESSAGE_STATUS: Record<string, Label> = {
	queued: { label: 'Queued', tone: 'info' },
	sending: { label: 'Sending', tone: 'info' },
	sent: { label: 'Sent', tone: 'success' },
	delivered: { label: 'Delivered', tone: 'success' },
	read: { label: 'Read', tone: 'success' },
	failed: { label: 'Failed', tone: 'danger' },
	skipped: { label: 'Not sent', tone: 'warning' },
	cancelled: { label: 'Cancelled', tone: 'neutral' }
};

export function label(map: Record<string, Label>, key: string): Label {
	return map[key] ?? { label: key.replace(/_/g, ' '), tone: 'neutral' };
}

export const ORDER_STATE: Record<string, Label> = {
	pending_payment: { label: 'Unpaid', tone: 'neutral' },
	paid: { label: 'To pack', tone: 'warning' },
	packed: { label: 'Packed', tone: 'info' },
	dispatched: { label: 'Dispatched', tone: 'accent' },
	delivered: { label: 'Delivered', tone: 'success' },
	cancelled: { label: 'Cancelled', tone: 'neutral' },
	refunded: { label: 'Refunded', tone: 'neutral' }
};

export const RETURN_STATUS: Record<string, Label> = {
	requested: { label: 'Return expected', tone: 'warning' },
	received: { label: 'Return received', tone: 'info' },
	completed: { label: 'Return closed', tone: 'success' },
	rejected: { label: 'Return rejected', tone: 'neutral' }
};

export const REFUND_STATE: Record<string, Label> = {
	initiated: { label: 'Refund pending', tone: 'warning' },
	processed: { label: 'Refunded', tone: 'success' },
	failed: { label: 'Refund failed', tone: 'danger' }
};

export const CHECKOUT_STATUS: Record<string, Label> = {
	in_checkout: { label: 'In checkout', tone: 'info' },
	abandoned: { label: 'Abandoned', tone: 'warning' },
	reminded: { label: 'Reminded', tone: 'accent' },
	clicked: { label: 'Opened the link', tone: 'accent' },
	recovered: { label: 'Recovered', tone: 'success' },
	bought_later: { label: 'Bought later', tone: 'success' },
	dismissed: { label: 'Dismissed', tone: 'neutral' }
};

export const LEAD_STAGE: Record<string, Label> = {
	new: { label: 'New', tone: 'info' },
	contacted: { label: 'Contacted', tone: 'accent' },
	interested: { label: 'Interested', tone: 'warning' },
	won: { label: 'Won', tone: 'success' },
	lost: { label: 'Lost', tone: 'neutral' }
};

export const LEAD_SOURCE_LABEL: Record<string, string> = {
	website: 'Website',
	instagram: 'Instagram',
	whatsapp: 'WhatsApp',
	meta_ads: 'Meta ad',
	referral: 'Referral',
	event: 'Event',
	other: 'Other'
};

/** "919812345678" → "+91 98123 45678". Anything else is shown as stored. */
export function formatPhone(phone: string | null | undefined): string {
	if (!phone) return '';
	const digits = phone.replace(/\D/g, '');
	if (/^91[6-9]\d{9}$/.test(digits)) return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
	if (/^[6-9]\d{9}$/.test(digits)) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
	return phone;
}
