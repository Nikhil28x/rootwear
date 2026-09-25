/**
 * RW-131 — §10 address rules, enforced server-side with per-field messages.
 *
 * "India only, enforced at the address form AND at order creation, not just in
 *  copy. Pincode ^[1-9][0-9]{5}$. Phone ^[6-9][0-9]{9}$."
 *
 * Two deliberate choices:
 *
 * 1. NORMALISE, then validate. People paste "+91 98765 43210" and "560 001".
 *    Rejecting those as malformed is a self-inflicted support ticket, so the
 *    separators and the +91 / leading-zero trunk prefix are stripped first and
 *    the cleaned value is what gets stored and re-displayed.
 *
 * 2. A DIFFERENT message per failure, never one shared "invalid" string.
 *    "A pincode is six digits" and "No Indian pincode begins with 0" send the
 *    customer to different corrections, and a regex name sends them nowhere.
 *
 * The same regexes are check constraints on `app.addresses` (0010), so a bug
 * here cannot write a row the database would not also accept.
 */
import type { AddressInput, SavedAddress } from './types';
import {
	EMPTY_ADDRESS,
	INDIAN_STATES,
	type AddressField,
	type AddressFieldErrors,
	type RawAddress
} from '$lib/components/account/address-shape';

/**
 * The states list and the form shapes live in a client-safe module, because
 * the form component needs them in the browser and SvelteKit refuses — rightly
 * — to bundle anything under src/lib/server into client code. They are
 * re-exported here so server callers have one import for the whole subject.
 */
export { EMPTY_ADDRESS, INDIAN_STATES };
export type { AddressField, AddressFieldErrors, RawAddress };

export const PINCODE_PATTERN = /^[1-9][0-9]{5}$/;
export const PHONE_PATTERN = /^[6-9][0-9]{9}$/;

/** §10: the one allowed ship-to country, and the column check agrees. */
export const ALLOWED_COUNTRY = 'IN' as const;

export type AddressValidation =
	| { readonly ok: true; readonly value: AddressInput; readonly raw: RawAddress }
	| { readonly ok: false; readonly errors: AddressFieldErrors; readonly raw: RawAddress };

function text(form: FormData, key: string): string {
	const value = form.get(key);
	return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

/** Digits only. Strips spaces, dashes, brackets — and the +91 / 0 trunk prefix. */
export function normalisePhone(input: string): string {
	let digits = input.replace(/[^\d]/g, '');
	if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
	if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
	return digits;
}

export function normalisePincode(input: string): string {
	return input.replace(/[^\d]/g, '');
}

export function readAddressForm(form: FormData): RawAddress {
	return {
		label: text(form, 'label') || 'Home',
		name: text(form, 'name'),
		line1: text(form, 'line1'),
		line2: text(form, 'line2'),
		city: text(form, 'city'),
		state: text(form, 'state'),
		pincode: normalisePincode(text(form, 'pincode')),
		phone: normalisePhone(text(form, 'phone')),
		// Present as a hidden field so a tampered post is REJECTED rather than
		// silently coerced to IN — §10 wants the refusal to be visible.
		country: (text(form, 'country') || ALLOWED_COUNTRY).toUpperCase(),
		isDefault: form.get('isDefault') === 'on' || form.get('isDefault') === 'true'
	};
}

export function validateAddress(form: FormData): AddressValidation {
	const raw = readAddressForm(form);
	const errors: AddressFieldErrors = {};

	if (raw.label.length > 40) errors.label = 'Keep the label under 40 characters.';

	if (!raw.name) {
		errors.name = 'Enter the name the courier should ask for.';
	} else if (raw.name.length > 120) {
		errors.name = 'That name is too long for a shipping label.';
	}

	if (!raw.line1) {
		errors.line1 = 'Enter the flat or house number and the street.';
	} else if (raw.line1.length > 160) {
		errors.line1 = 'Split this across the two address lines.';
	}

	if (raw.line2.length > 160) errors.line2 = 'Split this across the two address lines.';

	if (!raw.city) errors.city = 'Enter the city or town.';

	if (!raw.state) {
		errors.state = 'Choose your state or union territory.';
	} else if (!INDIAN_STATES.includes(raw.state)) {
		errors.state = 'Choose a state or union territory from the list.';
	}

	if (!raw.pincode) {
		errors.pincode = 'Enter your six-digit pincode.';
	} else if (raw.pincode.startsWith('0')) {
		errors.pincode = 'No Indian pincode begins with 0. Check the first digit.';
	} else if (raw.pincode.length !== 6) {
		errors.pincode = `A pincode is exactly six digits — you entered ${raw.pincode.length}.`;
	} else if (!PINCODE_PATTERN.test(raw.pincode)) {
		errors.pincode = 'That is not a valid Indian pincode.';
	}

	if (!raw.phone) {
		errors.phone = 'Enter a mobile number the courier can call.';
	} else if (raw.phone.length !== 10) {
		errors.phone = `An Indian mobile number is ten digits — you entered ${raw.phone.length}.`;
	} else if (!PHONE_PATTERN.test(raw.phone)) {
		errors.phone = 'Indian mobile numbers begin with 6, 7, 8 or 9.';
	}

	// §10 is a hard rule, not a preference: we do not ship outside India, and the
	// column check on app.addresses would reject the row anyway.
	if (raw.country !== ALLOWED_COUNTRY) {
		errors.country = 'We ship within India only. This address cannot be saved.';
	}

	if (Object.keys(errors).length > 0) return { ok: false, errors, raw };

	return {
		ok: true,
		raw,
		value: {
			label: raw.label,
			name: raw.name,
			line1: raw.line1,
			line2: raw.line2 || null,
			city: raw.city,
			state: raw.state,
			pincode: raw.pincode,
			phone: raw.phone,
			country: ALLOWED_COUNTRY,
			isDefault: raw.isDefault
		}
	};
}

/**
 * A saved address, in the shape the form renders. Used when opening an edit,
 * so the boxes start with exactly what is stored rather than a fresh guess.
 */
export function rawFromSaved(address: SavedAddress): RawAddress {
	return {
		label: address.label,
		name: address.name,
		line1: address.line1,
		line2: address.line2 ?? '',
		city: address.city,
		state: address.state,
		pincode: address.pincode,
		phone: address.phone,
		country: address.country,
		isDefault: address.isDefault
	};
}
