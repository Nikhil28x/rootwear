/**
 * The contract between the demand form actions and the forms that render them.
 *
 * It lives on the CLIENT side of the fence deliberately. The server handler
 * (src/lib/server/demand/actions.ts) imports these types; the form components
 * import them too. Putting them under $lib/server instead would mean every
 * component reaching into a server-only module for a shape it renders.
 *
 * `target` exists because one page renders MANY of these forms — a notify-me
 * on every sold-out size — while SvelteKit's `form` prop is page-global. Each
 * form compares `target` against its own id and ignores everyone else's result.
 */

export type DemandIntent = 'request' | 'notify' | 'preorder';
export type DemandField = 'email' | 'size' | 'consent' | 'form' | 'name' | 'phone';

export type DemandSuccess = {
	readonly ok: true;
	readonly intent: DemandIntent;
	/** Drop slug for a request, variant id for a notify-me. */
	readonly target: string;
	/**
	 * 'already' is a SUCCESS. The unique constraint did its job and the person
	 * IS on the list — the UI says so rather than reporting a failure.
	 */
	readonly status: 'recorded' | 'already';
	readonly email: string;
};

export type DemandProblem = {
	readonly ok: false;
	readonly intent: DemandIntent;
	readonly target: string;
	readonly field: DemandField;
	readonly message: string;
	/** Echoed back so a no-JS visitor does not retype a valid address. */
	readonly email: string;
	readonly variantId: string;
	/** Pre-order only: echoed for the same reason as the address. */
	readonly name?: string;
	readonly phone?: string;
};

export type DemandFormResult = DemandSuccess | DemandProblem;

/** `form` arrives loosely typed; narrow before reading it. */
export function isDemandResult(value: unknown): value is DemandFormResult {
	if (typeof value !== 'object' || value === null) return false;
	const candidate = value as Record<string, unknown>;
	return (
		typeof candidate.ok === 'boolean' &&
		(candidate.intent === 'request' ||
			candidate.intent === 'notify' ||
			candidate.intent === 'preorder') &&
		typeof candidate.target === 'string'
	);
}

/** The one result this form cares about, or null. */
export function resultFor(
	value: unknown,
	intent: DemandIntent,
	target: string
): DemandFormResult | null {
	if (!isDemandResult(value)) return null;
	return value.intent === intent && value.target === target ? value : null;
}
