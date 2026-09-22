import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { cartRepository, loadCart, readCartToken } from '$lib/server/cart';
import { readShipValues, writeShipTo } from '$lib/server/cart/ship-session';
import {
	EMPTY_ADDRESS,
	SHIP_COUNTRY,
	normalisePhone,
	normalisePincode,
	validateAddress,
	hasErrors,
	type AddressErrors,
	type AddressValues
} from '$lib/checkout/address';
import { LAUNCH_INSTANT } from '$lib/drop/schedule';
import { COD_ENABLED } from '$lib/config/commerce';
import { paymentProvider } from '$lib/server/payments';
import type { SavedAddress } from '$lib/server/cart/types';

/**
 * §03 template 07 — "Address and pincode rules, Razorpay primary, secondary
 * gateway as a configurable option, pre-order dispatch note, order-notes
 * field."
 *
 * §10 is enforced HERE AND AT ORDER CREATION, which is two places on purpose:
 * India only, pincode ^[1-9][0-9]{5}$ checked against public.pincode_exclusions,
 * phone ^[6-9][0-9]{9}$. The browser check in $lib/checkout/address.ts is a
 * courtesy that saves a round trip; this one is the rule.
 */

const field = (data: FormData, key: string) => (data.get(key) ?? '').toString().trim();

export const load: PageServerLoad = async ({ cookies, locals }) => {
	const cart = await loadCart(cookies, locals.now);

	// Nothing to check out. Sending them to the cart is the honest destination:
	// it explains the empty state rather than showing an address form for air.
	if (cart.lines.length === 0) redirect(303, '/cart');

	// §10: a signed-in visitor may pick a saved address. Read through THIS
	// module's own repository — the account area owns its own tree, and two
	// routes reaching into each other's data layer is how they drift.
	let saved: SavedAddress[] = [];
	const { user } = await locals.safeGetSession();
	if (user) {
		const customerId = await cartRepository.findCustomerIdForUser(user.id);
		if (customerId) saved = await cartRepository.listAddresses(customerId);
	}

	const previous = readShipValues(cookies);
	const provider = paymentProvider();

	return {
		cart,
		saved,
		values: previous ?? { ...EMPTY_ADDRESS, email: user?.email ?? '' },
		launchInstant: LAUNCH_INSTANT,
		serverNow: locals.now,
		/** §10: COD is off for Drop 01. The toggle exists either way. */
		codEnabled: COD_ENABLED,
		payment: {
			name: provider.name,
			/** RW-005 is open: say so rather than offering a handoff that throws. */
			configured: provider.isConfigured
		}
	};
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const data = await request.formData();

		const values: AddressValues = {
			email: field(data, 'email').toLowerCase(),
			name: field(data, 'name'),
			line1: field(data, 'line1'),
			line2: field(data, 'line2'),
			city: field(data, 'city'),
			state: field(data, 'state'),
			// A pasted "+91 98765 43210" becomes something the pattern accepts,
			// rather than an error the visitor has to decode.
			pincode: normalisePincode(field(data, 'pincode')),
			phone: normalisePhone(field(data, 'phone')),
			notes: field(data, 'notes'),
			/**
			 * §10 — the posted country is COMPARED, never adopted. Coercing it to
			 * 'IN' would let a tampered post through silently and leave the rule
			 * unenforced in the one place it is supposed to bite; validateAddress
			 * refuses anything that is not India. An absent field is the form's
			 * own hidden input missing, which is a bad request, not India.
			 */
			country: field(data, 'country') || 'unstated'
		};

		const errors: AddressErrors = validateAddress(values);

		// §10: serviceability is DATA, not a pattern, so it is checked against
		// public.pincode_exclusions and only ever server-side.
		if (!errors.pincode) {
			const exclusion = await cartRepository.pincodeExclusion(values.pincode);
			if (exclusion) errors.pincode = exclusion;
		}

		// A cart that emptied while the form was open must not become an order.
		const token = readCartToken(cookies);
		const cart = token ? await cartRepository.findCart(token) : null;
		const lines = cart ? await cartRepository.listLines(cart.id) : [];
		if (lines.length === 0) {
			return fail(409, {
				values,
				errors,
				problem: 'Your cart is empty — nothing was saved.'
			});
		}

		if (hasErrors(errors)) {
			// The visitor's own words come back with the errors. Retyping an
			// address because one field was wrong is the worst thing a form does.
			return fail(400, { values, errors, problem: '' });
		}

		writeShipTo(cookies, values);
		redirect(303, '/checkout/review');
	}
};
