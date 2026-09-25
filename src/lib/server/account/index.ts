/**
 * RW-135 — The one place the account data source is chosen.
 *
 * Same switch as src/lib/server/drops/index.ts and src/lib/server/admin/index.ts,
 * on the same environment variable, so the catalogue, the admin area and a
 * customer's own records can never end up reading from two different worlds.
 * CATALOGUE_SOURCE=supabase reads Postgres; anything else (the default) reads
 * the fixtures, which is what lets the whole account area run with no database.
 *
 * Every route under /account imports this and nothing else from the data layer.
 *
 * Resolved per call rather than at import, so flipping the variable in dev
 * takes effect without a restart.
 */
import type { AccountRepository } from './repository';
import { mockAccountRepository } from './mock-repository';
import { supabaseAccountRepository } from './supabase-repository';
import { catalogueSource, isSupabaseConfigured } from '$lib/server/env';

function select(): AccountRepository {
	if (catalogueSource() === 'supabase') {
		if (!isSupabaseConfigured()) {
			throw new Error(
				'CATALOGUE_SOURCE=supabase but PUBLIC_SUPABASE_URL / ' +
					'PUBLIC_SUPABASE_ANON_KEY are not set. See .env.example.'
			);
		}
		return supabaseAccountRepository;
	}
	return mockAccountRepository;
}

/** True when the records on screen are fixtures rather than a real customer's. */
export function usingFixtureRecords(): boolean {
	return catalogueSource() !== 'supabase';
}

export const account: AccountRepository = {
	findCustomerForUser: (userId, email) => select().findCustomerForUser(userId, email),
	listOrders: (customerId) => select().listOrders(customerId),
	findOrder: (customerId, orderNumber) => select().findOrder(customerId, orderNumber),
	listPreOrders: (customerId) => select().listPreOrders(customerId),
	listAddresses: (customerId) => select().listAddresses(customerId),
	createAddress: (customerId, input) => select().createAddress(customerId, input),
	updateAddress: (customerId, addressId, input) =>
		select().updateAddress(customerId, addressId, input),
	deleteAddress: (customerId, addressId) => select().deleteAddress(customerId, addressId),
	setDefaultAddress: (customerId, addressId) => select().setDefaultAddress(customerId, addressId),
	listNotifySubscriptions: (email) => select().listNotifySubscriptions(email),
	unsubscribeNotify: (email, subscriptionId) => select().unsubscribeNotify(email, subscriptionId),
	listWaitlistEntries: (customerId) => select().listWaitlistEntries(customerId),
	withdrawWaitlist: (customerId, entryId) => select().withdrawWaitlist(customerId, entryId)
};

export type { AccountRepository };
export * from './types';
