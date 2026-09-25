/**
 * The address carried between /checkout/information and /checkout/review.
 *
 * Kept in an httpOnly, SameSite=Lax cookie rather than a database row, for two
 * reasons: a guest checkout (§10) has no customer record to hang it on until
 * the order commits, and an abandoned checkout should leave nothing behind but
 * a cookie the browser will drop on its own.
 *
 * It is NOT trusted on the way back in. `readShipTo` re-runs the full §10 rule
 * set — India only, pincode, phone — and returns null if anything fails, so a
 * hand-edited cookie cannot put a bad address on an order. The review action
 * validates it a third time before commit. §10: "enforce at the address form
 * AND at order creation, not just in copy."
 *
 * Writing a cookie means this module must never be reached from a `load` on a
 * prerenderable route. It is only used by the two checkout surfaces, which are
 * dynamic by definition.
 */
import type { Cookies } from '@sveltejs/kit';
import { validateAddress, hasErrors, type AddressValues } from '$lib/checkout/address';
import type { ShipTo } from './types';

export const SHIP_COOKIE = 'rw_ship';

/** Long enough to finish a checkout, short enough not to linger. */
const MAX_AGE = 60 * 60 * 2;

export function writeShipTo(cookies: Cookies, values: AddressValues): void {
	cookies.set(SHIP_COOKIE, JSON.stringify(values), {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: MAX_AGE
	});
}

export function clearShipTo(cookies: Cookies): void {
	cookies.delete(SHIP_COOKIE, { path: '/' });
}

/** The raw values, for re-filling the form. Never used to place an order. */
export function readShipValues(cookies: Cookies): AddressValues | null {
	const raw = cookies.get(SHIP_COOKIE);
	if (!raw) return null;

	try {
		const parsed = JSON.parse(raw) as Partial<AddressValues>;
		return {
			email: String(parsed.email ?? ''),
			name: String(parsed.name ?? ''),
			line1: String(parsed.line1 ?? ''),
			line2: String(parsed.line2 ?? ''),
			city: String(parsed.city ?? ''),
			state: String(parsed.state ?? ''),
			pincode: String(parsed.pincode ?? ''),
			phone: String(parsed.phone ?? ''),
			notes: String(parsed.notes ?? ''),
			country: String(parsed.country ?? '')
		};
	} catch {
		return null;
	}
}

/**
 * The validated address, or null. Re-runs §10 in full: a cookie is visitor
 * input like any other, and this is the last read before app.commit_order().
 */
export function readShipTo(cookies: Cookies): ShipTo | null {
	const values = readShipValues(cookies);
	if (!values) return null;
	if (hasErrors(validateAddress(values))) return null;

	return {
		email: values.email,
		name: values.name,
		line1: values.line1,
		line2: values.line2 || null,
		city: values.city,
		state: values.state,
		pincode: values.pincode,
		phone: values.phone,
		notes: values.notes || null
	};
}
