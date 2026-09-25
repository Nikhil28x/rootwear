/**
 * RW-047 — The two demand form actions, written once.
 *
 * The archive (/drops), the drop page (/drops/[drop]) and the product page
 * (/drops/[drop]/[product]) all carry the same two forms. Three copies of this
 * validation would be three chances for one of them to skip the §13 consent
 * check or the state guard, so both handlers live here and each route's
 * `actions` export is two lines that delegate.
 *
 * Everything is validated AGAINST THE CATALOGUE, never trusted from the post:
 * the drop is resolved by slug, the variant must belong to that drop, and the
 * drop's state must actually permit the signal being recorded (§04 — the
 * browser is never the authority). `locals.now` supplies the consent instant,
 * never Date.now() (§04, RW-019).
 *
 * Returned shapes carry `intent` and `target` because a single page renders
 * MANY of these forms — one notify-me per sold-out size — and SvelteKit's
 * `form` prop is page-global. Without the target every form on the page would
 * light up green when one of them succeeded.
 */
import { fail, type ActionFailure } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { drops } from '$lib/server/drops';
import { demand } from './index';
import { isConsentSource, type ConsentSource } from './types';
import { isValidEmail, normaliseEmail } from './email';
import { acceptsNotifyMe } from '$lib/domain/drop-state';
import { isSizeSoldOut, type Drop, type Variant } from '$lib/domain/drop';
import type {
	DemandField,
	DemandIntent,
	DemandProblem,
	DemandSuccess
} from '$lib/components/drop/demand-result';

export type DemandActionResult = DemandSuccess | ActionFailure<DemandProblem>;

const MAX_NOTE = 400;

function reject(
	intent: DemandIntent,
	target: string,
	field: DemandField,
	message: string,
	email = '',
	variantId = ''
): ActionFailure<DemandProblem> {
	return fail(400, { ok: false as const, intent, target, field, message, email, variantId });
}

function findVariant(drop: Drop, variantId: string): Variant | null {
	for (const product of drop.products) {
		const variant = product.variants.find((v) => v.id === variantId);
		if (variant) return variant;
	}
	return null;
}

function readSource(raw: FormDataEntryValue | null, fallback: ConsentSource): ConsentSource {
	const value = typeof raw === 'string' ? raw : '';
	return isConsentSource(value) ? value : fallback;
}

/**
 * §12 — "bring this finished drop back, in THIS size."
 *
 * Only SOLD_OUT and ARCHIVED drops accept a request, and that is checked here
 * rather than only hidden in the markup: a drop that is still on sale does not
 * need a petition, it needs a cart.
 */
export async function handleRequestDrop(
	event: Pick<RequestEvent, 'request' | 'locals'>,
	defaultSource: ConsentSource
): Promise<DemandActionResult> {
	const data = await event.request.formData();
	const dropSlug = String(data.get('dropSlug') ?? '');
	const variantId = String(data.get('variantId') ?? '');
	const email = normaliseEmail(String(data.get('email') ?? ''));

	const drop = await drops.findBySlug(dropSlug);
	if (!drop) {
		return reject('request', dropSlug, 'form', 'That drop no longer exists.', email, variantId);
	}

	if (drop.state !== 'SOLD_OUT' && drop.state !== 'ARCHIVED') {
		return reject(
			'request',
			dropSlug,
			'form',
			'This drop has not finished yet, so there is nothing to bring back.',
			email,
			variantId
		);
	}

	if (!isValidEmail(email)) {
		return reject(
			'request',
			dropSlug,
			'email',
			'Enter an email address we can reach you on.',
			email,
			variantId
		);
	}

	// A size is required: "how many, in what size" is the only version of this
	// number that can be cut against, and the unique index needs a non-null
	// variant to make re-submission idempotent.
	const variant = variantId ? findVariant(drop, variantId) : null;
	if (!variant) {
		return reject('request', dropSlug, 'size', 'Choose the size you want.', email, variantId);
	}

	// §13: opt-in, not opt-out. No pre-ticked box, and no row without a tick.
	if (data.get('consent') !== 'on') {
		return reject(
			'request',
			dropSlug,
			'consent',
			'Tick the box to let us email you about this drop.',
			email,
			variantId
		);
	}

	const rawNote = String(data.get('note') ?? '').trim();
	const note = rawNote.length > 0 ? rawNote.slice(0, MAX_NOTE) : null;

	const status = await demand.requestDrop({
		dropId: drop.id,
		variantId: variant.id,
		email,
		note,
		consentSource: readSource(data.get('source'), defaultSource),
		// §04: the server's instant, stamped once per request.
		consentedAt: event.locals.now
	});

	return { ok: true, intent: 'request', target: dropSlug, status, email };
}

/**
 * §06 — "Notify-me sits on every sold-out piece and size."
 *
 * Permitted when the drop's state says so, and ALSO on an individual sold-out
 * size of a drop that is otherwise on sale: that is the exact case §06 is
 * describing, and `acceptsNotifyMe(LIVE)` is false.
 */
export async function handleNotifyMe(
	event: Pick<RequestEvent, 'request' | 'locals'>,
	defaultSource: ConsentSource
): Promise<DemandActionResult> {
	const data = await event.request.formData();
	const dropSlug = String(data.get('dropSlug') ?? '');
	const variantId = String(data.get('variantId') ?? '');
	const email = normaliseEmail(String(data.get('email') ?? ''));

	const drop = await drops.findBySlug(dropSlug);
	const variant = drop && variantId ? findVariant(drop, variantId) : null;
	if (!drop || !variant) {
		return reject('notify', variantId, 'form', 'That piece no longer exists.', email, variantId);
	}

	if (!acceptsNotifyMe(drop.state) && !isSizeSoldOut(variant)) {
		return reject(
			'notify',
			variantId,
			'form',
			'This size is on sale right now — add it to your cart instead.',
			email,
			variantId
		);
	}

	if (!isValidEmail(email)) {
		return reject(
			'notify',
			variantId,
			'email',
			'Enter an email address we can reach you on.',
			email,
			variantId
		);
	}

	if (data.get('consent') !== 'on') {
		return reject(
			'notify',
			variantId,
			'consent',
			'Tick the box to let us email you when this size returns.',
			email,
			variantId
		);
	}

	const status = await demand.notifyMe({
		variantId: variant.id,
		email,
		consentSource: readSource(data.get('source'), defaultSource),
		consentedAt: event.locals.now
	});

	return { ok: true, intent: 'notify', target: variantId, status, email };
}

/** §10 India: ten digits starting 6-9. Same rule as the checkout address form. */
const INDIAN_MOBILE = /^[6-9][0-9]{9}$/;

/**
 * A pre-order SIGNUP — name, email, phone, size.
 *
 * Deliberately NOT a §08 reservation: no money is taken, no piece number is
 * allocated, nothing is held. It records that a named person wants a size when
 * the drop opens. Validated against the catalogue like every other handler
 * here — the drop is resolved by slug and the variant must belong to it, so a
 * posted id cannot reach a piece from another drop (§04).
 */
export async function handlePreOrder(
	event: Pick<RequestEvent, 'request' | 'locals'>,
	defaultSource: ConsentSource
): Promise<DemandActionResult> {
	const data = await event.request.formData();
	const dropSlug = String(data.get('dropSlug') ?? '');
	const variantId = String(data.get('variantId') ?? '');
	const name = String(data.get('name') ?? '').trim();
	const email = normaliseEmail(String(data.get('email') ?? ''));
	const phone = String(data.get('phone') ?? '').replace(/[\s-]/g, '');

	const fail_ = (field: DemandField, message: string) => ({
		...reject('preorder', dropSlug, field, message, email, variantId),
		name,
		phone
	});

	const drop = await drops.findBySlug(dropSlug);
	const variant = drop && variantId ? findVariant(drop, variantId) : null;
	if (!drop || !variant) return fail_('form', 'That piece no longer exists.');

	if (!variantId) return fail_('size', 'Choose a size.');
	if (name.length < 2) return fail_('name', 'Tell us who to put the piece aside for.');
	if (name.length > 120) return fail_('name', 'That name is longer than we can store.');
	if (!isValidEmail(email)) return fail_('email', 'Enter an email address we can reach you on.');
	if (!INDIAN_MOBILE.test(phone)) {
		return fail_('phone', 'Ten digits, starting 6, 7, 8 or 9. We ship within India only.');
	}
	if (data.get('consent') !== 'on') {
		return fail_('consent', 'Tick the box so we can contact you about this drop.');
	}

	const status = await demand.preorderSignup({
		dropId: drop.id,
		variantId: variant.id,
		name,
		email,
		phone,
		consentSource: readSource(data.get('source'), defaultSource),
		consentedAt: event.locals.now
	});

	return { ok: true, intent: 'preorder', target: dropSlug, status, email };
}
