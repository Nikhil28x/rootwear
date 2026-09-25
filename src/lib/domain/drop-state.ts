/**
 * RW-036 — §06 "The life of a drop — seven states".
 *
 * The brief is explicit: "The state is a property of the drop; per-size
 * availability is a property of the variant. The developer should model them
 * EXPLICITLY rather than inferring state from stock counts."
 *
 * So DropState is a stored column, never derived from a SUM(stock). A drop
 * with stock remaining can still be ARCHIVED; a drop with zero stock is not
 * SOLD_OUT until it is moved there.
 */

export const DROP_STATES = [
	'TEASE',
	'REVEALED',
	'LIVE',
	'PARTIAL',
	'SOLD_OUT',
	'ARCHIVED',
	'RE_DROP'
] as const;

export type DropState = (typeof DROP_STATES)[number];

/** §06 numbering, kept because admin and the brief both refer to states by number. */
export const DROP_STATE_ORDINAL: Record<DropState, number> = {
	TEASE: 0,
	REVEALED: 1,
	LIVE: 2,
	PARTIAL: 3,
	SOLD_OUT: 4,
	ARCHIVED: 5,
	RE_DROP: 6
};

export const DROP_STATE_DESCRIPTION: Record<DropState, string> = {
	TEASE: 'Interactive teaser live, piece not shown, deposits taken against a hard cap.',
	REVEALED: 'Piece shown, countdown running, notify-me open, nothing on sale yet.',
	LIVE: 'On sale at an exact stated time.',
	PARTIAL: 'Some sizes gone. Sold-out sizes stay visible and greyed, never hidden.',
	SOLD_OUT: 'Nothing left. Page stays up with notify-me on each piece.',
	ARCHIVED: 'Moved to the archive, story intact, dated as released.',
	RE_DROP: 'An old piece restocked. Same page revived, not a new drop.'
};

/**
 * Legal transitions. Anything not listed here is rejected by `assertTransition`.
 *
 * Notes on the less obvious edges:
 * - PARTIAL -> LIVE is legal: a cancelled reservation can return the last size
 *   to sale, and §08 explicitly releases lapsed pieces back to the waitlist.
 * - SOLD_OUT and ARCHIVED both reach RE_DROP (§06 state 6, §15 open item
 *   RW-010: a re-drop revives the original page rather than opening a new drop).
 * - Nothing transitions OUT of a state by deletion: §06 says "Nothing is ever
 *   deleted; the archive is the brand's proof of history."
 */
const LEGAL_TRANSITIONS: Record<DropState, readonly DropState[]> = {
	TEASE: ['REVEALED', 'ARCHIVED'],
	REVEALED: ['LIVE', 'ARCHIVED'],
	LIVE: ['PARTIAL', 'SOLD_OUT', 'ARCHIVED'],
	PARTIAL: ['LIVE', 'SOLD_OUT', 'ARCHIVED'],
	SOLD_OUT: ['ARCHIVED', 'RE_DROP'],
	ARCHIVED: ['RE_DROP'],
	RE_DROP: ['LIVE', 'PARTIAL', 'SOLD_OUT', 'ARCHIVED']
};

export function canTransition(from: DropState, to: DropState): boolean {
	return LEGAL_TRANSITIONS[from].includes(to);
}

export function legalTransitionsFrom(from: DropState): readonly DropState[] {
	return LEGAL_TRANSITIONS[from];
}

export class IllegalDropTransitionError extends Error {
	constructor(
		readonly from: DropState,
		readonly to: DropState
	) {
		super(
			`Illegal drop transition ${from} -> ${to}. Legal from ${from}: ` +
				`${LEGAL_TRANSITIONS[from].join(', ') || 'none'}.`
		);
		this.name = 'IllegalDropTransitionError';
	}
}

/** Guard every state write with this. */
export function assertTransition(from: DropState, to: DropState): void {
	if (!canTransition(from, to)) throw new IllegalDropTransitionError(from, to);
}

/** §06: "Sold-out sizes are greyed, not hidden — the scarcity is the point." */
export function isPubliclyVisible(state: DropState): boolean {
	return true;
}

/** Only these states may take money for open sale. TEASE takes deposits, not sales. */
export function isOnSale(state: DropState): boolean {
	return state === 'LIVE' || state === 'PARTIAL' || state === 'RE_DROP';
}

/** §08: during TEASE a visitor reserves with a deposit rather than buying. */
export function acceptsDeposits(state: DropState): boolean {
	return state === 'TEASE';
}

/** §06: notify-me sits on every sold-out piece and size. */
export function acceptsNotifyMe(state: DropState): boolean {
	return state === 'REVEALED' || state === 'PARTIAL' || state === 'SOLD_OUT' || state === 'ARCHIVED';
}
