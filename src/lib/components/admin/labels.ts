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
