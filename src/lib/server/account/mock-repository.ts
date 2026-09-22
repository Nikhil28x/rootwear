/**
 * RW-133 — Fixture-backed AccountRepository.
 *
 * Implements exactly the interface the Supabase repository implements, so
 * switching between them is one environment variable and no other change
 * (see ./index.ts). Deliberately async throughout for the same reason.
 *
 * Two derivations are worth stating once, because every screen depends on them:
 *
 *   state   — READ from the stored column on the reservation or the order.
 *             Never inferred from whether a payment row exists (§08). The
 *             payments below feed `depositPaid` / `balancePaid`, which are
 *             REPORTING figures shown next to the state, not the source of it.
 *
 *   price   — READ from the order line's snapshot. A historical order never
 *             re-derives from a live product price (§06), which is why the
 *             pre-order line here still shows the locked tease price while the
 *             open-sale line beside it shows the launch price.
 *
 * Writes mutate the in-memory store, so adding, editing, deleting and
 * re-defaulting an address behave here the way they will against Postgres.
 */
import { parseSku } from '$lib/catalogue/sku';
import { serverNow } from '$lib/server/clock';
import {
	accountFixtures,
	sumPaise,
	type AccountFixtureStore,
	type StoredAddress
} from './fixtures';
import { loadCatalogueIndex, type CatalogueIndex } from './catalogue-index';
import type { AccountRepository } from './repository';
import type {
	AccountCustomer,
	AddressInput,
	AddressWriteResult,
	NotifySubscription,
	OrderDetail,
	OrderLine,
	OrderSummary,
	PreOrder,
	SavedAddress,
	WaitlistSubscription
} from './types';

/** Fixture seed time. Not a drop-state decision — those read event.locals.now. */
function seedInstant(): number {
	return serverNow();
}

async function store(): Promise<AccountFixtureStore> {
	return accountFixtures(seedInstant());
}

function toSavedAddress(row: StoredAddress): SavedAddress {
	return {
		id: row.id,
		label: row.label,
		name: row.name,
		line1: row.line1,
		line2: row.line2,
		city: row.city,
		state: row.state,
		pincode: row.pincode,
		phone: row.phone,
		country: row.country,
		isDefault: row.isDefault,
		updatedAt: row.updatedAt
	};
}

/** §06: the size on an archived line comes from the SNAPSHOT, not the catalogue. */
function sizeFromSku(sku: string) {
	return parseSku(sku)?.size ?? null;
}

function buildOrder(
	db: AccountFixtureStore,
	orderId: string
): { summary: OrderSummary; lines: OrderLine[] } | null {
	const order = db.orders.find((row) => row.id === orderId);
	if (!order) return null;

	const lines = db.orderLines
		.filter((line) => line.orderId === order.id)
		.map<OrderLine>((line) => ({
			id: line.id,
			variantId: line.variantId,
			sku: line.skuSnapshot,
			name: line.nameSnapshot,
			size: sizeFromSku(line.skuSnapshot),
			quantity: line.quantity,
			unitPrice: line.unitPrice,
			lineTotal: sumPaise(Array.from({ length: line.quantity }, () => line.unitPrice)),
			priceSource: line.priceSource,
			pieceNumber: line.pieceNumber,
			reservationId: line.reservationId
		}));

	return {
		summary: {
			id: order.id,
			orderNumber: order.orderNumber,
			state: order.state,
			placedAt: order.createdAt,
			total: order.total,
			itemCount: lines.reduce((n, line) => n + line.quantity, 0),
			publicToken: order.publicToken,
			courierName: order.courierName,
			trackingRef: order.trackingRef
		},
		lines
	};
}

export const mockAccountRepository: AccountRepository = {
	async findCustomerForUser(userId: string, email: string): Promise<AccountCustomer | null> {
		const db = await store();
		// §10: the account is claimed AFTER the purchases exist, so the fixture
		// customer attaches to whoever is signed in rather than demanding a match.
		db.customer.userId = userId;
		if (email) db.customer.email = email;
		return {
			id: db.customer.id,
			userId: db.customer.userId,
			email: db.customer.email,
			phone: db.customer.phone,
			createdAt: db.customer.createdAt
		};
	},

	async listOrders(customerId: string): Promise<OrderSummary[]> {
		const db = await store();
		return db.orders
			.filter((order) => order.customerId === customerId)
			.map((order) => buildOrder(db, order.id))
			.filter((built): built is NonNullable<typeof built> => built !== null)
			.map((built) => built.summary)
			.sort((a, b) => b.placedAt - a.placedAt);
	},

	async findOrder(customerId: string, orderNumber: string): Promise<OrderDetail | null> {
		const db = await store();
		// Scoped by BOTH: an order number alone never authorises a read.
		const order = db.orders.find(
			(row) => row.orderNumber === orderNumber && row.customerId === customerId
		);
		if (!order) return null;

		const built = buildOrder(db, order.id);
		if (!built) return null;

		return {
			...built.summary,
			subtotal: order.subtotal,
			shipping: order.shipping,
			discount: order.discount,
			tax: order.tax,
			notes: order.notes,
			dispatchedAt: order.dispatchedAt,
			deliveredAt: order.deliveredAt,
			shipTo: {
				name: order.shipName,
				line1: order.shipLine1,
				line2: order.shipLine2,
				city: order.shipCity,
				state: order.shipState,
				pincode: order.shipPincode,
				phone: order.shipPhone,
				country: order.shipCountry
			},
			lines: built.lines
		};
	},

	async listPreOrders(customerId: string): Promise<PreOrder[]> {
		const db = await store();
		const catalogue: CatalogueIndex = await loadCatalogueIndex();

		return db.reservations
			.filter((row) => row.customerId === customerId)
			.map<PreOrder>((row) => {
				const facts = catalogue.byVariantId(row.variantId);
				const captured = db.payments.filter(
					(payment) => payment.reservationId === row.id && payment.state === 'captured'
				);
				// §08: the reservation and the order it became are ONE record.
				const closingLine = db.orderLines.find((line) => line.reservationId === row.id);
				const closingOrder = closingLine
					? (db.orders.find((order) => order.id === closingLine.orderId) ?? null)
					: null;

				return {
					id: row.id,
					state: row.state,
					dropSlug: facts?.dropSlug ?? '',
					dropName: facts?.dropName ?? 'This drop',
					dropNumber: facts?.dropNumber ?? 0,
					productName: facts?.productName ?? 'Reserved piece',
					sku: facts?.sku ?? null,
					size: facts?.size ?? null,
					pieceNumber: row.pieceNumber,
					editionSize: facts?.editionSize ?? 0,
					lockedPrice: row.lockedPrice,
					deposit: row.deposit,
					balance: row.balance,
					depositPaid: sumPaise(captured.filter((p) => p.kind === 'deposit').map((p) => p.amount)),
					balancePaid: sumPaise(captured.filter((p) => p.kind === 'balance').map((p) => p.amount)),
					dispatchDate: row.dispatchDate,
					balanceDueBy: row.balanceDueBy,
					cancellationRule: row.cancellationRule,
					createdAt: row.createdAt,
					orderNumber: closingOrder?.orderNumber ?? null
				};
			})
			.sort((a, b) => b.createdAt - a.createdAt);
	},

	async listAddresses(customerId: string): Promise<SavedAddress[]> {
		const db = await store();
		return db.addresses
			.filter((row) => row.customerId === customerId)
			.sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || b.updatedAt - a.updatedAt)
			.map(toSavedAddress);
	},

	async createAddress(customerId: string, input: AddressInput): Promise<AddressWriteResult> {
		const db = await store();
		const mine = db.addresses.filter((row) => row.customerId === customerId);

		// A soft cap, so a runaway form cannot fill the book.
		if (mine.length >= 12) return { ok: false, reason: 'limit' };

		const now = seedInstant();
		// Exactly one default per customer. The partial unique index in 0010
		// enforces it; this clears the other one FIRST so the write never races
		// into that conflict.
		const isDefault = input.isDefault || mine.length === 0;
		if (isDefault) for (const row of mine) row.isDefault = false;

		const row: StoredAddress = {
			id: `address-${db.nextId++}`,
			customerId,
			label: input.label,
			name: input.name,
			line1: input.line1,
			line2: input.line2,
			city: input.city,
			state: input.state,
			pincode: input.pincode,
			phone: input.phone,
			country: input.country,
			isDefault,
			createdAt: now,
			updatedAt: now
		};

		db.addresses.push(row);
		return { ok: true, address: toSavedAddress(row) };
	},

	async updateAddress(
		customerId: string,
		addressId: string,
		input: AddressInput
	): Promise<AddressWriteResult> {
		const db = await store();
		const row = db.addresses.find(
			(candidate) => candidate.id === addressId && candidate.customerId === customerId
		);
		if (!row) return { ok: false, reason: 'not_found' };

		if (input.isDefault) {
			for (const other of db.addresses) {
				if (other.customerId === customerId && other.id !== row.id) other.isDefault = false;
			}
		}

		row.label = input.label;
		row.name = input.name;
		row.line1 = input.line1;
		row.line2 = input.line2;
		row.city = input.city;
		row.state = input.state;
		row.pincode = input.pincode;
		row.phone = input.phone;
		row.country = input.country;
		// A customer cannot un-default the only default by clearing the box —
		// there would then be none, and checkout has nothing to preselect.
		row.isDefault = input.isDefault || row.isDefault;
		row.updatedAt = seedInstant();

		return { ok: true, address: toSavedAddress(row) };
	},

	async deleteAddress(customerId: string, addressId: string): Promise<boolean> {
		const db = await store();
		const index = db.addresses.findIndex(
			(row) => row.id === addressId && row.customerId === customerId
		);
		if (index === -1) return false;

		const [removed] = db.addresses.splice(index, 1);

		// Deleting the default promotes the most recently touched survivor, so
		// the customer is never left with a book and no default.
		if (removed.isDefault) {
			const survivors = db.addresses
				.filter((row) => row.customerId === customerId)
				.sort((a, b) => b.updatedAt - a.updatedAt);
			if (survivors[0]) survivors[0].isDefault = true;
		}

		return true;
	},

	async setDefaultAddress(customerId: string, addressId: string): Promise<boolean> {
		const db = await store();
		const target = db.addresses.find(
			(row) => row.id === addressId && row.customerId === customerId
		);
		if (!target) return false;

		for (const row of db.addresses) {
			if (row.customerId === customerId) row.isDefault = row.id === target.id;
		}
		target.updatedAt = seedInstant();
		return true;
	},

	async listNotifySubscriptions(email: string): Promise<NotifySubscription[]> {
		const db = await store();
		const catalogue = await loadCatalogueIndex();
		const key = email.toLowerCase();

		return db.notifies
			.filter((row) => row.email.toLowerCase() === key)
			.map<NotifySubscription>((row) => {
				const facts = catalogue.byVariantId(row.variantId);
				return {
					id: row.id,
					variantId: row.variantId,
					sku: facts?.sku ?? null,
					size: facts?.size ?? null,
					dropSlug: facts?.dropSlug ?? null,
					dropName: facts?.dropName ?? null,
					productName: facts?.productName ?? null,
					consentedAt: row.consentedAt,
					notifiedAt: row.notifiedAt
				};
			})
			.sort((a, b) => b.consentedAt - a.consentedAt);
	},

	async unsubscribeNotify(email: string, subscriptionId: string): Promise<boolean> {
		const db = await store();
		const key = email.toLowerCase();
		const index = db.notifies.findIndex(
			(row) => row.id === subscriptionId && row.email.toLowerCase() === key
		);
		if (index === -1) return false;
		db.notifies.splice(index, 1);
		return true;
	},

	async listWaitlistEntries(customerId: string): Promise<WaitlistSubscription[]> {
		const db = await store();
		const catalogue = await loadCatalogueIndex();

		return db.waitlist
			.filter((row) => row.customerId === customerId)
			.map<WaitlistSubscription>((row) => {
				const facts = catalogue.byVariantId(row.variantId);
				return {
					id: row.id,
					variantId: row.variantId,
					size: facts?.size ?? null,
					dropSlug: facts?.dropSlug ?? null,
					dropName: facts?.dropName ?? null,
					productName: facts?.productName ?? null,
					position: row.position,
					state: row.state,
					joinedAt: row.createdAt,
					offeredAt: row.offeredAt
				};
			})
			.sort((a, b) => a.position - b.position);
	},

	async withdrawWaitlist(customerId: string, entryId: string): Promise<boolean> {
		const db = await store();
		const row = db.waitlist.find(
			(candidate) => candidate.id === entryId && candidate.customerId === customerId
		);
		if (!row) return false;
		// §06: nothing is deleted. The place is given up by state, and the row
		// stays, so the queue's history remains readable.
		row.state = 'withdrawn';
		return true;
	}
};
