/** Drop states and product statuses as admin shows them. */
import type { ChipTone } from './ui/Chip.svelte';

export const DROP_STATE: Record<string, { label: string; tone: ChipTone; help: string }> = {
	TEASE: { label: 'Tease', tone: 'info', help: 'Counting down. Deposits open, nothing on sale.' },
	REVEALED: { label: 'Revealed', tone: 'info', help: 'The piece is shown; still counting down.' },
	LIVE: { label: 'Live', tone: 'success', help: 'On sale.' },
	PARTIAL: { label: 'Partly sold out', tone: 'warning', help: 'On sale; some sizes are gone.' },
	SOLD_OUT: { label: 'Sold out', tone: 'neutral', help: 'Nothing left to buy.' },
	RE_DROP: { label: 'Re-drop', tone: 'success', help: 'Back on sale after selling out.' },
	ARCHIVED: { label: 'Archived', tone: 'neutral', help: 'In the archive, dated as released.' }
};

export const PRODUCT_STATUS: Record<string, { label: string; tone: ChipTone }> = {
	draft: { label: 'Draft', tone: 'neutral' },
	active: { label: 'Live', tone: 'success' },
	archived: { label: 'Archived', tone: 'neutral' }
};

export function dropState(state: string) {
	return DROP_STATE[state] ?? { label: state, tone: 'neutral' as ChipTone, help: '' };
}

export function dropNumber(number: number): string {
	return String(number).padStart(2, '0');
}
