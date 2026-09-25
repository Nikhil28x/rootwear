/**
 * RW-149 — State, encoded in FORM as well as in words.
 *
 * §12 asks for "reports that actually matter". A report is only readable at a
 * glance if the thing that needs attention looks different from the thing that
 * does not — so every state string in the admin area maps to one of four
 * treatments here, once, rather than each table inventing its own.
 *
 *   solid     — needs action now (overdue, unpaid, new).
 *   attention — in flight, worth watching (reserved, balance due, packed).
 *   outline   — settled and good (dispatched, delivered, captured).
 *   quiet     — closed, cancelled, or simply not interesting.
 *
 * Deliberately no new colours: the treatments differ by FILL and WEIGHT, drawn
 * from the same cream / gold / stone tokens as the rest of the site, so the
 * tool still looks like Rootwear and nothing depends on hue alone.
 */
export type Tone = 'solid' | 'attention' | 'outline' | 'quiet';

/** 'balance_due' -> 'Balance due'. 'SOLD_OUT' -> 'Sold out'. */
export function humanise(value: string): string {
	const words = value.replace(/_/g, ' ').toLowerCase().trim();
	return words.charAt(0).toUpperCase() + words.slice(1);
}

export function orderTone(state: string): Tone {
	switch (state) {
		case 'pending_payment':
			return 'solid';
		case 'paid':
			return 'attention';
		case 'packed':
			return 'attention';
		case 'dispatched':
		case 'delivered':
			return 'outline';
		default:
			return 'quiet';
	}
}

export function reservationTone(state: string): Tone {
	switch (state) {
		case 'pending_payment':
			return 'solid';
		case 'balance_due':
			return 'solid';
		case 'reserved':
			return 'attention';
		case 'balance_paid':
		case 'dispatched':
			return 'outline';
		default:
			return 'quiet';
	}
}

export function dropTone(state: string): Tone {
	switch (state) {
		case 'LIVE':
		case 'RE_DROP':
			return 'solid';
		case 'TEASE':
		case 'REVEALED':
		case 'PARTIAL':
			return 'attention';
		case 'SOLD_OUT':
			return 'outline';
		default:
			return 'quiet';
	}
}

export function contactTone(status: string): Tone {
	switch (status) {
		case 'new':
			return 'solid';
		case 'in_progress':
			return 'attention';
		default:
			return 'quiet';
	}
}

export function paymentTone(state: string): Tone {
	switch (state) {
		case 'captured':
			return 'outline';
		case 'created':
		case 'authorized':
			return 'attention';
		case 'failed':
			return 'solid';
		default:
			return 'quiet';
	}
}

/** Dates in the admin tool are read, not admired: short, unambiguous, sortable. */
export function shortDate(ms: number): string {
	return new Intl.DateTimeFormat('en-GB', {
		day: '2-digit',
		month: 'short',
		year: 'numeric',
		timeZone: 'Asia/Kolkata'
	}).format(new Date(ms));
}

export function shortDateTime(ms: number): string {
	return new Intl.DateTimeFormat('en-GB', {
		day: '2-digit',
		month: 'short',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
		timeZone: 'Asia/Kolkata'
	}).format(new Date(ms));
}

/**
 * IST WALL CLOCK <-> EPOCH, for the one editable instant in the admin area.
 *
 * `<input type="datetime-local">` has no time zone: it hands back the wall
 * clock the operator typed and nothing else. Read in the browser's zone that
 * would mean a launch set from a laptop in London lands five and a half hours
 * out — so both directions below pin the value to IST explicitly.
 *
 * India has no daylight saving and has held +05:30 since 1945, so a fixed
 * offset is exact here in a way it would not be for most zones. The two
 * functions are kept side by side deliberately: they are a round trip, and a
 * round trip that is edited in one half is a bug.
 */
export const IST_OFFSET = '+05:30';

const IST_PARTS = new Intl.DateTimeFormat('en-GB', {
	timeZone: 'Asia/Kolkata',
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
	hourCycle: 'h23'
});

/** Epoch ms -> "YYYY-MM-DDTHH:mm" in IST, the value a datetime-local wants. */
export function istInputValue(ms: number): string {
	const parts = new Map<string, string>(
		IST_PARTS.formatToParts(new Date(ms)).map((p) => [p.type as string, p.value])
	);
	const get = (type: string) => parts.get(type) ?? '00';
	return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

/**
 * Seconds are optional because the browsers disagree. A datetime-local with no
 * `step` submits "YYYY-MM-DDTHH:mm", but not every engine drops the seconds,
 * and a form that saves in one browser and refuses in another is the worst kind
 * of bug to be told about second-hand. Anything finer than a minute is ignored
 * rather than rejected — a launch instant is not scheduled to the second.
 */
const LOCAL_DATETIME = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?$/;

/**
 * "YYYY-MM-DDTHH:mm" read as IST -> epoch ms, or null if it is not a real
 * instant. Returns null rather than NaN so a caller cannot forget to check:
 * NaN flows silently through arithmetic, null does not.
 *
 * The regex is not enough on its own — "2026-02-30T10:00" matches its shape
 * and is not a date — so the parsed value is round-tripped back through the
 * formatter and compared. A month that rolled over fails that check.
 */
export function parseIstInput(value: string): number | null {
	const match = LOCAL_DATETIME.exec(value.trim());
	if (!match) return null;

	const minutes = match[1];
	const ms = Date.parse(`${minutes}:00${IST_OFFSET}`);
	if (!Number.isFinite(ms)) return null;

	return istInputValue(ms) === minutes ? ms : null;
}

/** "in 5 days" / "4 days ago" — the only figure anyone chasing a balance wants. */
export function relativeDays(target: number, now: number): string {
	const days = Math.round((target - now) / 86_400_000);
	if (days === 0) return 'today';
	if (days > 0) return `in ${days} day${days === 1 ? '' : 's'}`;
	return `${-days} day${days === -1 ? '' : 's'} ago`;
}
