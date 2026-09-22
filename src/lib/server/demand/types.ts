/**
 * RW-047 — Demand capture types.
 *
 * Two signals, deliberately kept apart because they answer different questions:
 *
 *   drop request  — "bring this finished drop back, in THIS size". Written
 *                   against app.drop_requests. §12's demand board is the input
 *                   to the next cut and to any re-drop.
 *   notify-me     — "tell me when THIS piece in THIS size is available again".
 *                   Written against app.notify_requests. §06: notify-me sits on
 *                   every sold-out piece and size.
 *
 * Neither takes money. Both are §13 marketing consent, so both carry the
 * instant and the surface the consent was given on, and both are LOGGED with
 * the row rather than assumed from the fact a row exists.
 */
import type { Size } from '$lib/drop/sizes';

/**
 * Where the opt-in was given. Stored verbatim in `consent_source` so a later
 * subject-access request can say exactly which form was filled in.
 */
export const CONSENT_SOURCES = ['drop_archive', 'drop_page', 'product_page'] as const;
export type ConsentSource = (typeof CONSENT_SOURCES)[number];

export function isConsentSource(value: string): value is ConsentSource {
	return (CONSENT_SOURCES as readonly string[]).includes(value);
}

/**
 * A size is REQUIRED, not optional.
 *
 * Two reasons. Commercially, "how many, in what size" is the only version of
 * this number that can be cut against — a bare headcount cannot. Technically,
 * app.drop_requests is unique on (drop_id, variant_id, email), and Postgres
 * treats NULLs as distinct in a unique index, so a null variant_id would make
 * re-submission silently non-idempotent. Requiring the size removes both.
 */
export type DropRequestInput = {
	readonly dropId: string;
	readonly variantId: string;
	readonly email: string;
	readonly note: string | null;
	readonly consentSource: ConsentSource;
	/** §13: captured AND logged. Comes from locals.now, never Date.now(). */
	readonly consentedAt: number;
};

export type NotifyRequestInput = {
	readonly variantId: string;
	readonly email: string;
	readonly consentSource: ConsentSource;
	readonly consentedAt: number;
};

/**
 * 'already' is a SUCCESS, not an error: the unique constraint did its job and
 * the person is on the list. The UI says "you are already on the list" — it
 * never reports a failure for a repeat submission.
 */
export type DemandWriteStatus = 'recorded' | 'already';

/** One row of app.demand_board, per drop and size. */
export type DemandRow = {
	readonly dropId: string;
	readonly variantId: string;
	readonly size: Size;
	readonly requests: number;
	readonly notifyMe: number;
	readonly waitlist: number;
};
