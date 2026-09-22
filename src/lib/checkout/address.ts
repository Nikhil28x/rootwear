/**
 * §10 — the address rules, in ONE module so the form and the server cannot
 * disagree.
 *
 * "India only. ENFORCE AT THE ADDRESS FORM AND AT ORDER CREATION, not just in
 *  copy. Pincode ^[1-9][0-9]{5}$. Phone ^[6-9][0-9]{9}$."
 *
 * This file has no `$lib/server` import, so the same functions run in the
 * browser for instant feedback and on the server as the decision. The client
 * check is a courtesy; the server check is the rule, and the server runs it
 * again on every submission regardless of what the browser concluded.
 *
 * The pincode is also checked against public.pincode_exclusions server-side —
 * that cannot happen here, because serviceability is data, not a pattern.
 */

/** §10 — the only country this build ships to. Locked, not merely defaulted. */
export const SHIP_COUNTRY = 'IN' as const;
export const SHIP_COUNTRY_LABEL = 'India';

/** §10 verbatim. Six digits, never starting with zero. */
export const PINCODE_PATTERN = '^[1-9][0-9]{5}$';
/** §10 verbatim. Ten digits, Indian mobile series only. */
export const PHONE_PATTERN = '^[6-9][0-9]{9}$';

const PINCODE = new RegExp(PINCODE_PATTERN);
const PHONE = new RegExp(PHONE_PATTERN);

/**
 * Deliberately permissive, and the same expression the contact form uses. A
 * pattern that insists on a TLD it has heard of rejects real addresses; the
 * address is confirmed by whether the confirmation email arrives.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** The 36 states and union territories, so the field is a select, not free text. */
export const INDIAN_STATES = [
	'Andaman and Nicobar Islands',
	'Andhra Pradesh',
	'Arunachal Pradesh',
	'Assam',
	'Bihar',
	'Chandigarh',
	'Chhattisgarh',
	'Dadra and Nagar Haveli and Daman and Diu',
	'Delhi',
	'Goa',
	'Gujarat',
	'Haryana',
	'Himachal Pradesh',
	'Jammu and Kashmir',
	'Jharkhand',
	'Karnataka',
	'Kerala',
	'Ladakh',
	'Lakshadweep',
	'Madhya Pradesh',
	'Maharashtra',
	'Manipur',
	'Meghalaya',
	'Mizoram',
	'Nagaland',
	'Odisha',
	'Puducherry',
	'Punjab',
	'Rajasthan',
	'Sikkim',
	'Tamil Nadu',
	'Telangana',
	'Tripura',
	'Uttar Pradesh',
	'Uttarakhand',
	'West Bengal'
] as const;

export const STATE_OPTIONS = INDIAN_STATES.map((state) => ({ value: state, label: state }));

export type AddressValues = {
	email: string;
	name: string;
	line1: string;
	line2: string;
	city: string;
	state: string;
	pincode: string;
	phone: string;
	notes: string;
	country: string;
};

export type AddressErrors = Partial<Record<keyof AddressValues, string>>;

export const EMPTY_ADDRESS: AddressValues = {
	email: '',
	name: '',
	line1: '',
	line2: '',
	city: '',
	state: '',
	pincode: '',
	phone: '',
	notes: '',
	country: SHIP_COUNTRY
};

const LIMITS = {
	email: 254,
	name: 120,
	line1: 200,
	line2: 200,
	city: 80,
	pincode: 6,
	phone: 10,
	/** §10: an order-notes field, not an essay. */
	notes: 500
} as const;

/**
 * The whole rule set. Returns a field-keyed map so every message can be
 * attached to its own control and announced — §A11Y: errors are announced, not
 * merely coloured.
 */
export function validateAddress(values: AddressValues): AddressErrors {
	const errors: AddressErrors = {};

	if (!values.email) errors.email = 'We need an address to send your confirmation to.';
	else if (values.email.length > LIMITS.email || !EMAIL.test(values.email)) {
		errors.email = 'That does not look like an email address we could reach you at.';
	}

	if (!values.name) errors.name = 'Tell us who to address the parcel to.';
	else if (values.name.length > LIMITS.name) errors.name = 'That name is too long for a label.';

	if (!values.line1) errors.line1 = 'We need a street address.';
	else if (values.line1.length > LIMITS.line1) errors.line1 = 'Shorten this to fit a label.';

	if (values.line2.length > LIMITS.line2) errors.line2 = 'Shorten this to fit a label.';

	if (!values.city) errors.city = 'We need a town or city.';
	else if (values.city.length > LIMITS.city) errors.city = 'That is longer than a city name.';

	if (!values.state) errors.state = 'Pick your state or union territory.';
	else if (!(INDIAN_STATES as readonly string[]).includes(values.state)) {
		errors.state = 'Pick a state or union territory from the list.';
	}

	if (!values.pincode) errors.pincode = 'We need a six-digit pincode.';
	else if (!PINCODE.test(values.pincode)) {
		errors.pincode = 'A pincode is six digits and does not start with a zero.';
	}

	if (!values.phone) errors.phone = 'The courier needs a number to call on delivery.';
	else if (!PHONE.test(values.phone)) {
		errors.phone = 'An Indian mobile number is ten digits starting 6, 7, 8 or 9.';
	}

	if (values.notes.length > LIMITS.notes) {
		errors.notes = `Keep notes under ${LIMITS.notes} characters.`;
	}

	// §10: India only, and refused here as well as at order creation. A posted
	// country field is never trusted — it is compared, not adopted.
	if (values.country !== SHIP_COUNTRY) {
		errors.country = 'We ship within India only at the moment.';
	}

	return errors;
}

export function hasErrors(errors: AddressErrors): boolean {
	return Object.keys(errors).length > 0;
}

/** Digits only, so a pasted "+91 98765 43210" becomes something valid. */
export function normalisePhone(raw: string): string {
	const digits = raw.replace(/\D/g, '');
	return digits.startsWith('91') && digits.length === 12 ? digits.slice(2) : digits;
}

export function normalisePincode(raw: string): string {
	return raw.replace(/\D/g, '').slice(0, 6);
}
