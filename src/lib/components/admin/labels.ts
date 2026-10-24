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
