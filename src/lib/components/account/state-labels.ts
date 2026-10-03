/**
 * RW-137 — Stored states, said in the customer's language.
 *
 * §08 is explicit that reservation state is a STORED, exhaustive column and is
 * never inferred from whether a payment happens to exist. These maps therefore
 * cover every member of `app.reservation_state` and `app.order_state`: a state
 * with no entry here would render as a raw enum value on a customer's screen,
 * which is how `released_to_waitlist` reaches someone who lost their piece.
 *
 * Each state carries a SENTENCE as well as a label. A pill reading "Released"
 * tells a customer nothing about what happened to their money; the sentence
 * beside it does, and it is the same sentence every time.
 *
 * Dates are formatted in Asia/Kolkata. §10 makes this an India-only shop, and
 * pinning the zone also keeps the server's render and the browser's agreeing
 * rather than flickering on hydration.
 */
import type { OrderState, ReservationState } from '$lib/server/account/types';

export type RecordTone = 'attention' | 'settled' | 'quiet' | 'closed';

export type StateCopy = {
	readonly label: string;
	readonly tone: RecordTone;
	readonly sentence: string;
};

export const RESERVATION_COPY: Record<ReservationState, StateCopy> = {
	pending_payment: {
		label: 'Awaiting deposit',
		tone: 'attention',
		sentence:
			'Waiting for your deposit to confirm.'
	},
	reserved: {
		label: 'Reserved',
		tone: 'settled',
		sentence: 'Deposit confirmed. This piece is held for you.'
	},
	refunded_cap_race: {
		label: 'Refunded',
		tone: 'closed',
		sentence:
			"This edition sold out before your deposit confirmed, so we've refunded it in full."
	},
	cancelled: {
		label: 'Cancelled',
		tone: 'closed',
		sentence: 'This pre-order was cancelled. See the cancellation terms below.'
	},
	balance_due: {
		label: 'Balance due',
		tone: 'attention',
		sentence: 'Your piece is held. Pay the balance to have it shipped.'
	},
	balance_paid: {
		label: 'Paid in full',
		tone: 'settled',
		sentence: "Paid in full. We'll let you know when it ships."
	},
	dispatched: {
		label: 'Shipped',
		tone: 'settled',
		sentence: 'On its way. Tracking is on your order below.'
	},
	released_to_waitlist: {
		label: 'Released',
		tone: 'closed',
		sentence:
			"The balance wasn't paid by the due date, so this piece is no longer held for you."
	}
};

export const ORDER_COPY: Record<OrderState, StateCopy> = {
	pending_payment: {
		label: 'Awaiting payment',
		tone: 'attention',
		sentence: "We're confirming your payment."
	},
	paid: {
		label: 'Paid',
		tone: 'settled',
		sentence: "Payment confirmed. We're preparing your order."
	},
	packed: {
		label: 'Packed',
		tone: 'settled',
		sentence: 'Packed and ready to ship.'
	},
	dispatched: {
		label: 'Shipped',
		tone: 'settled',
		sentence: 'On its way to you.'
	},
	delivered: {
		label: 'Delivered',
		tone: 'settled',
		sentence: 'Your order has been delivered.'
	},
	cancelled: {
		label: 'Cancelled',
		tone: 'closed',
		sentence: 'This order was cancelled.'
	},
	refunded: {
		label: 'Refunded',
		tone: 'closed',
		sentence: 'This order was refunded.'
	}
};

const DATE = new Intl.DateTimeFormat('en-IN', {
	day: 'numeric',
	month: 'short',
	year: 'numeric',
	timeZone: 'Asia/Kolkata'
});

const DATE_TIME = new Intl.DateTimeFormat('en-IN', {
	day: 'numeric',
	month: 'short',
	year: 'numeric',
	hour: '2-digit',
	minute: '2-digit',
	timeZone: 'Asia/Kolkata'
});

export function shortDate(instant: number | null): string {
	return instant === null ? '—' : DATE.format(new Date(instant));
}

export function shortDateTime(instant: number | null): string {
	return instant === null ? '—' : DATE_TIME.format(new Date(instant));
}

/** `dispatch_date` is a DATE column, so it arrives as YYYY-MM-DD, not an instant. */
export function isoDate(value: string | null): string {
	if (!value) return '—';
	const parsed = Date.parse(`${value}T00:00:00+05:30`);
	return Number.isNaN(parsed) ? value : DATE.format(new Date(parsed));
}
