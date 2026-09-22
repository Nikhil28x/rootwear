/**
 * RW-131 — The address form's shared vocabulary.
 *
 * This lives OUTSIDE src/lib/server deliberately. The states list and the
 * shapes below are needed by the form component in the browser as well as by
 * the validator on the server, and SvelteKit refuses — correctly — to bundle
 * anything under src/lib/server into client code. Keeping one definition here
 * is what stops a second, drifting copy of the states list appearing in the
 * component.
 *
 * The validation RULES stay server-side, in
 * src/lib/server/account/address-validation.ts. Nothing here decides whether
 * an address is acceptable; §10 is enforced where it cannot be edited.
 */

/**
 * States and union territories, for the form's select. A free-text state field
 * produces "Karnataka", "karnatka" and "KA" in the same column, which makes
 * the shipping-rate lookup (0011) unreliable.
 */
export const INDIAN_STATES: readonly string[] = [
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
];

/** What the form posted, cleaned but not yet judged — echoed back on failure. */
export type RawAddress = {
	label: string;
	name: string;
	line1: string;
	line2: string;
	city: string;
	state: string;
	pincode: string;
	phone: string;
	country: string;
	isDefault: boolean;
};

export type AddressField = keyof RawAddress;

/** One message per field. §10 asks for specific errors, never a shared "invalid". */
export type AddressFieldErrors = Partial<Record<AddressField, string>>;

/** An empty form, and the shape a failed submit is echoed back in. */
export const EMPTY_ADDRESS: RawAddress = {
	label: 'Home',
	name: '',
	line1: '',
	line2: '',
	city: '',
	state: '',
	pincode: '',
	phone: '',
	country: 'IN',
	isDefault: false
};
