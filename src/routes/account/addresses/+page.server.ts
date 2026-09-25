import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { account } from '$lib/server/account';
import { resolveAccountAuth } from '$lib/server/account/session';
import {
	EMPTY_ADDRESS,
	rawFromSaved,
	validateAddress,
	type AddressFieldErrors,
	type RawAddress
} from '$lib/server/account/address-validation';
import type { SavedAddress } from '$lib/server/account/types';

/**
 * RW-145 — §03 template 08: saved addresses. §10 governs what may be saved.
 *
 * "India only, enforced at the address form AND at order creation, not just in
 *  copy. Pincode ^[1-9][0-9]{5}$. Phone ^[6-9][0-9]{9}$."
 *
 * THE VALIDATION IS HERE, not in the component. A client-side check is a
 * convenience for the person typing; this is the one that decides, and the
 * same regexes are check constraints on `app.addresses` (0010), so a bug in
 * either layer still cannot write a row the database would accept.
 *
 * ONE FORM ON THE PAGE AT A TIME, opened through ?new / ?edit / ?delete rather
 * than rendered inline beside every card. Two reasons, and the first is not
 * cosmetic: ui/Field.svelte derives input ids from the field name, so five
 * inline edit forms would put `id="f-pincode"` on the page five times and
 * detach every label from its input. The second is that it makes the whole
 * screen — add, edit, delete, set default — work with JavaScript off, because
 * each state is a URL.
 *
 * DELETING ASKS FIRST. An address is typed once and used for years; a
 * one-click delete beside each card is a mis-tap away from losing it.
 */
type Mode =
	| { readonly kind: 'list' }
	| { readonly kind: 'new' }
	| { readonly kind: 'edit'; readonly address: SavedAddress }
	| { readonly kind: 'delete'; readonly address: SavedAddress };

function resolveMode(url: URL, addresses: SavedAddress[]): Mode {
	if (url.searchParams.get('new') !== null) return { kind: 'new' };

	const editId = url.searchParams.get('edit');
	if (editId) {
		const address = addresses.find((row) => row.id === editId);
		// An id that is not on this account falls back to the list rather than
		// erroring: it is almost always a stale tab, not an attack.
		if (address) return { kind: 'edit', address };
	}

	const deleteId = url.searchParams.get('delete');
	if (deleteId) {
		const address = addresses.find((row) => row.id === deleteId);
		if (address) return { kind: 'delete', address };
	}

	return { kind: 'list' };
}

export const load: PageServerLoad = async (event) => {
	const auth = await resolveAccountAuth(event);
	if (auth.status !== 'signed_in') redirect(303, '/account/login');

	const customerId = auth.customer?.id ?? null;
	const addresses = customerId ? await account.listAddresses(customerId) : [];
	const mode = resolveMode(event.url, addresses);

	const values: RawAddress =
		mode.kind === 'edit' ? rawFromSaved(mode.address) : { ...EMPTY_ADDRESS };

	return {
		addresses,
		// A customer with no record yet can read the page but has nowhere to
		// write to. Saying so beats a form that fails on submit.
		linked: customerId !== null,
		mode: mode.kind,
		editing: mode.kind === 'edit' || mode.kind === 'delete' ? mode.address : null,
		values
	};
};

type Failure = {
	errors: AddressFieldErrors;
	values: RawAddress;
	failure: string;
};

function refuse(status: number, detail: Failure) {
	return fail(status, detail);
}

/** One sentence per way a write can be refused for a reason that is not a field. */
const REASONS: Record<'not_found' | 'conflict' | 'limit', string> = {
	not_found: 'That address is no longer on your account. It may have been deleted in another tab.',
	conflict:
		'Another address was made the default at the same moment. Nothing was lost — open the ' +
		'address you want and set it again.',
	limit: 'You have as many saved addresses as we keep. Delete one you no longer use first.'
};

export const actions: Actions = {
	create: async (event) => {
		const auth = await resolveAccountAuth(event);
		if (auth.status !== 'signed_in') redirect(303, '/account/login');

		const customerId = auth.customer?.id ?? null;
		const form = await event.request.formData();
		const checked = validateAddress(form);

		if (!customerId) {
			return refuse(409, {
				errors: {},
				values: checked.raw,
				failure:
					'This account is not linked to a customer record yet, so there is nowhere to save an address.'
			});
		}

		if (!checked.ok) {
			return refuse(400, { errors: checked.errors, values: checked.raw, failure: '' });
		}

		const written = await account.createAddress(customerId, checked.value);
		if (!written.ok) {
			return refuse(written.reason === 'limit' ? 409 : 400, {
				errors: {},
				values: checked.raw,
				failure: REASONS[written.reason]
			});
		}

		// A clean URL after a successful write, and no re-post on refresh.
		redirect(303, '/account/addresses?saved=1');
	},

	update: async (event) => {
		const auth = await resolveAccountAuth(event);
		if (auth.status !== 'signed_in') redirect(303, '/account/login');

		const customerId = auth.customer?.id ?? null;
		const form = await event.request.formData();
		const addressId = String(form.get('id') ?? '');
		const checked = validateAddress(form);

		if (!customerId || !addressId) {
			return refuse(400, {
				errors: {},
				values: checked.raw,
				failure: REASONS.not_found
			});
		}

		if (!checked.ok) {
			return refuse(400, { errors: checked.errors, values: checked.raw, failure: '' });
		}

		const written = await account.updateAddress(customerId, addressId, checked.value);
		if (!written.ok) {
			return refuse(written.reason === 'not_found' ? 404 : 409, {
				errors: {},
				values: checked.raw,
				failure: REASONS[written.reason]
			});
		}

		redirect(303, '/account/addresses?saved=1');
	},

	delete: async (event) => {
		const auth = await resolveAccountAuth(event);
		if (auth.status !== 'signed_in') redirect(303, '/account/login');

		const customerId = auth.customer?.id ?? null;
		const form = await event.request.formData();
		const addressId = String(form.get('id') ?? '');

		if (!customerId || !addressId) {
			return refuse(400, { errors: {}, values: { ...EMPTY_ADDRESS }, failure: REASONS.not_found });
		}

		const removed = await account.deleteAddress(customerId, addressId);
		if (!removed) {
			return refuse(404, { errors: {}, values: { ...EMPTY_ADDRESS }, failure: REASONS.not_found });
		}

		redirect(303, '/account/addresses?deleted=1');
	},

	/**
	 * NOT named `default`: SvelteKit reserves that for the unnamed action, and
	 * a page cannot export it alongside named ones.
	 */
	setDefault: async (event) => {
		const auth = await resolveAccountAuth(event);
		if (auth.status !== 'signed_in') redirect(303, '/account/login');

		const customerId = auth.customer?.id ?? null;
		const form = await event.request.formData();
		const addressId = String(form.get('id') ?? '');

		if (!customerId || !addressId) {
			return refuse(400, { errors: {}, values: { ...EMPTY_ADDRESS }, failure: REASONS.not_found });
		}

		// The partial unique index on app.addresses allows exactly one default
		// per customer. The repository clears the old one first; if two tabs
		// race it anyway, the conflict is reported rather than thrown as a 500.
		const changed = await account.setDefaultAddress(customerId, addressId);
		if (!changed) {
			return refuse(409, { errors: {}, values: { ...EMPTY_ADDRESS }, failure: REASONS.conflict });
		}

		redirect(303, '/account/addresses?saved=1');
	}
};
