/**
 * RW-130 — The account repository seam.
 *
 * Mirrors src/lib/server/drops/: an interface here, a fixture implementation
 * and a Postgres implementation beside it, and one `index.ts` that chooses.
 * Every route under /account imports ONLY this interface, which is what lets
 * the whole area run today against fixtures with no database configured.
 *
 * Under src/lib/server, so it can never be bundled into client code.
 *
 * Every method takes the customer id explicitly. Nothing here derives identity
 * from ambient state: the caller has already established WHO is asking, via a
 * validated JWT (hooks.server.ts `safeGetSession`), and passes it in. That
 * makes an accidental cross-customer read a visible mistake at the call site
 * rather than an invisible one inside a query.
 */
import type {
	AccountCustomer,
	AddressInput,
	AddressWriteResult,
	NotifySubscription,
	OrderDetail,
	OrderSummary,
	PreOrder,
	SavedAddress,
	WaitlistSubscription
} from './types';

export interface AccountRepository {
	/**
	 * §10: an account is offered AFTER purchase, so the auth user may exist
	 * before the link to the customer record does. Resolve by `user_id` first,
	 * then fall back to email — that is how a guest's order history attaches
	 * to the account they create afterwards — and only if neither matches,
	 * create the record, because a signed-in customer with nowhere to save an
	 * address is an account that does not work. Returns null only when the
	 * record could neither be found nor written.
	 */
	findCustomerForUser(userId: string, email: string): Promise<AccountCustomer | null>;

	listOrders(customerId: string): Promise<OrderSummary[]>;
	/** Scoped by customer id as well as order number: the number alone never authorises. */
	findOrder(customerId: string, orderNumber: string): Promise<OrderDetail | null>;

	/** §08: one row per reservation, carrying deposit, balance, piece and state. */
	listPreOrders(customerId: string): Promise<PreOrder[]>;

	listAddresses(customerId: string): Promise<SavedAddress[]>;
	createAddress(customerId: string, input: AddressInput): Promise<AddressWriteResult>;
	updateAddress(
		customerId: string,
		addressId: string,
		input: AddressInput
	): Promise<AddressWriteResult>;
	deleteAddress(customerId: string, addressId: string): Promise<boolean>;
	/** Exactly one default per customer — a partial unique index enforces it. */
	setDefaultAddress(customerId: string, addressId: string): Promise<boolean>;

	/** Notify-me is keyed by EMAIL: guests subscribe without ever having an account. */
	listNotifySubscriptions(email: string): Promise<NotifySubscription[]>;
	unsubscribeNotify(email: string, subscriptionId: string): Promise<boolean>;

	listWaitlistEntries(customerId: string): Promise<WaitlistSubscription[]>;
	withdrawWaitlist(customerId: string, entryId: string): Promise<boolean>;
}
