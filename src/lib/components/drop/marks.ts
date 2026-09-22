/**
 * §03 template 03 — the state mark that sits on every archive card.
 *
 * §06 is explicit that "the state is a property of the drop; per-size
 * availability is a property of the variant", and that the developer must
 * "model them EXPLICITLY rather than inferring state from stock counts". So
 * this maps DropState -> label directly. Nothing here counts stock, and a drop
 * with pieces left still reads ARCHIVED if that is where it has been moved.
 *
 * Pure, no server imports: the load function and the card component both read
 * it, so the mark rendered and the mark reasoned about are the same value.
 */
import type { DropState } from '$lib/domain/drop-state';

/** `tone` drives colour only. The LABEL is what carries the meaning (a11y). */
export type MarkTone = 'live' | 'closing' | 'gone' | 'quiet';

export type DropMark = {
	readonly label: string;
	readonly tone: MarkTone;
};

export const DROP_STATE_MARK: Record<DropState, DropMark> = {
	TEASE: { label: 'In growth', tone: 'quiet' },
	REVEALED: { label: 'Revealed', tone: 'quiet' },
	LIVE: { label: 'Live', tone: 'live' },
	PARTIAL: { label: 'Sizes going', tone: 'closing' },
	SOLD_OUT: { label: 'Sold out', tone: 'gone' },
	ARCHIVED: { label: 'Archived', tone: 'gone' },
	RE_DROP: { label: 'Re-drop', tone: 'live' }
};

/**
 * §12 — a finished drop is the only kind you can ask to have brought back.
 * A drop still on sale needs a cart, not a petition; a drop still teasing
 * takes a deposit (§08). Enforced in the action too — this is the UI half.
 */
export function acceptsDropRequest(state: DropState): boolean {
	/*
	 * A request is "bring this back, in this size" — meaningful for anything a
	 * visitor cannot buy right now, which includes a drop that has not opened
	 * yet as well as one that has finished. It is NOT meaningful for a drop on
	 * open sale: asking for something already in front of you is noise in the
	 * §12 demand board, which is the whole point of collecting it.
	 */
	return state !== 'LIVE' && state !== 'PARTIAL' && state !== 'RE_DROP';
}

/**
 * §06 — a finished drop "is kept alive: lookbook and story intact, pieces
 * marked sold out". True for exactly the states that belong under "Past
 * growth" on the archive rather than at the top of it.
 */
export function isFinished(state: DropState): boolean {
	return state === 'SOLD_OUT' || state === 'ARCHIVED';
}

/** Tailwind classes per tone, on a dark surface. Square edges, no shadows. */
export const MARK_CLASS: Record<MarkTone, string> = {
	live: 'border-gold/60 text-gold',
	closing: 'border-gold/35 text-gold/80',
	gone: 'border-white/20 text-stone-400',
	quiet: 'border-white/15 text-stone-500'
};

/** The same marks on a cream surface. */
export const MARK_CLASS_LIGHT: Record<MarkTone, string> = {
	live: 'border-gold text-gold',
	closing: 'border-forest/40 text-forest/80',
	gone: 'border-forest/20 text-forest/50',
	quiet: 'border-forest/15 text-forest/45'
};
