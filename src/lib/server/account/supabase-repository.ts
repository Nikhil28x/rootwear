/**
 * RW-134 — Postgres-backed AccountRepository.
 *
 * Implements exactly the interface the mock implements, so switching between
 * them is one environment variable and no other change (./index.ts).
 *
 * WHICH CLIENT, AND WHY: every table read here lives in the `app` schema,
 * which is deliberately NOT exposed through PostgREST (0001). The browser
 * cannot reach these rows at all, and the anon client cannot either — so the
 * service client is the only way in, and it BYPASSES RLS.
 *
 * That places the whole burden of "whose records are these" on this file. The
 * rule it follows, without exception: every query filters on the customer id
 * the caller passed in, and that id came from a VALIDATED JWT upstream
 * (hooks.server.ts `safeGetSession`, then ./session.ts). A method that reads
 * `app.orders` without an `.eq('customer_id', …)` is a customer-data leak, so
 * the filter is written first in every builder below, never appended.
 *
 * WHY THE JOIN HAPPENS IN TYPESCRIPT: PostgREST cannot embed across schemas,
 * and a reservation in `app` needs its garment from `public`. ./catalogue-index
 * stitches the two through the same catalogue seam the storefront uses, so the
 * fixture path and this path cannot drift in how they describe a piece.
 *
 * NOT EXERCISED in this phase — the app runs on fixtures until
 * CATALOGUE_SOURCE=supabase. Written now so the switch is a config change.
 */
import { parseSku } from '$lib/catalogue/sku';
import { paise, ZERO, type Paise } from '$lib/money';
import { getServiceClient } from '$lib/server/db/clients';
import { loadCatalogueIndex } from './catalogue-index';
import type { AccountRepository } from './repository';
import type {
	AccountCustomer,
	AddressInput,
	AddressWriteResult,
	NotifySubscription,
	OrderDetail,
	OrderLine,
	OrderState,
	OrderSummary,
	PreOrder,
	ReservationState,
	SavedAddress,
	WaitlistSubscription
} from './types';

/** Postgres unique-violation. The one-default index raises this. */
const UNIQUE_VIOLATION = '23505';

function money(value: number | string | null | undefined): Paise {
	return paise(Math.round(Number(value ?? 0)));
}

function ms(value: string | null | undefined): number | null {
	return value ? Date.parse(value) : null;
}

function msOr(value: string | null | undefined, fallback: number): number {
	return ms(value) ?? fallback;
}

/* -------------------------------------------------------------------------- */
/* Row shapes, transcribed from the migrations                                  */
/* -------------------------------------------------------------------------- */

type CustomerRow = {
	id: string;
	user_id: string | null;
	email: string;
	phone: string | null;
	created_at: string;
};

type AddressRow = {
	id: string;
	customer_id: string;
	label: string;
	name: string;
	line1: string;
	line2: string | null;
	city: string;
	state: string;
	pincode: string;
	phone: string;
	country: string;
	is_default: boolean;
	updated_at: string;
};

type OrderRow = {
	id: string;
	order_number: string;
	state: OrderState;
	subtotal_paise: number;
	shipping_paise: number;
	discount_paise: number;
	tax_paise: number;
	total_paise: number;
	ship_name: string;
	ship_line1: string;
	ship_line2: string | null;
	ship_city: string;
	ship_state: string;
	ship_pincode: string;
	ship_phone: string;
	ship_country: string;
	notes: string | null;
	courier_name: string | null;
	tracking_ref: string | null;
	dispatched_at: string | null;
	delivered_at: string | null;
	public_token: string;
	created_at: string;
};

type OrderLineRow = {
	id: string;
	order_id: string;
	variant_id: string;
	reservation_id: string | null;
	quantity: number;
	unit_price_paise: number;
	price_source: 'prelaunch_locked' | 'launch';
	piece_number: number | null;
	sku_snapshot: string;
	name_snapshot: string;
};

type ReservationRow = {
	id: string;
	drop_id: string;
	variant_id: string;
	state: ReservationState;
	piece_number: number | null;
	locked_price_paise: number;
	deposit_paise: number;
	balance_paise: number;
	dispatch_date: string | null;
	balance_due_by: string | null;
	cancellation_rule: string;
	created_at: string;
};

type PaymentRow = {
	reservation_id: string | null;
	kind: 'deposit' | 'balance' | 'order';
	amount_paise: number;
	state: string;
};

type NotifyRow = {
	id: string;
	variant_id: string;
	email: string;
	consented_at: string;
	notified_at: string | null;
};

type WaitlistRow = {
	id: string;
	variant_id: string;
	position: number;
	state: 'waiting' | 'offered' | 'converted' | 'expired' | 'withdrawn';
	offered_at: string | null;
	created_at: string;
};

const ORDER_COLUMNS =
	'id, order_number, state, subtotal_paise, shipping_paise, discount_paise, tax_paise, ' +
	'total_paise, ship_name, ship_line1, ship_line2, ship_city, ship_state, ship_pincode, ' +
	'ship_phone, ship_country, notes, courier_name, tracking_ref, dispatched_at, delivered_at, ' +
	'public_token, created_at';

const ADDRESS_COLUMNS =
	'id, customer_id, label, name, line1, line2, city, state, pincode, phone, country, ' +
	'is_default, updated_at';

/* -------------------------------------------------------------------------- */

function toAddress(row: AddressRow): SavedAddress {
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
		isDefault: row.is_default,
		updatedAt: msOr(row.updated_at, 0)
	};
}

function toLine(row: OrderLineRow): OrderLine {
	const unitPrice = money(row.unit_price_paise);
	return {
		id: row.id,
		variantId: row.variant_id,
		sku: row.sku_snapshot,
		name: row.name_snapshot,
		// §06: the size comes from the SNAPSHOT, so a catalogue edit cannot
		// rewrite what a historical order says was shipped.
		size: parseSku(row.sku_snapshot)?.size ?? null,
		quantity: row.quantity,
		unitPrice,
		lineTotal: paise(unitPrice * row.quantity),
		priceSource: row.price_source,
		pieceNumber: row.piece_number,
		reservationId: row.reservation_id
	};
}

function toSummary(order: OrderRow, lines: OrderLineRow[]): OrderSummary {
	return {
		id: order.id,
		orderNumber: order.order_number,
		state: order.state,
		placedAt: msOr(order.created_at, 0),
		total: money(order.total_paise),
		itemCount: lines.reduce((n, line) => n + line.quantity, 0),
		publicToken: order.public_token,
		courierName: order.courier_name,
		trackingRef: order.tracking_ref
	};
}

/** Clears any other default first, so the partial unique index never fires. */
async function clearOtherDefaults(customerId: string, exceptId: string | null): Promise<void> {
	let query = getServiceClient()
		.from('addresses')
		.update({ is_default: false })
		.eq('customer_id', customerId)
		.eq('is_default', true);

	if (exceptId) query = query.neq('id', exceptId);
	await query;
}

function addressPayload(input: AddressInput) {
	return {
		label: input.label,
		name: input.name,
		line1: input.line1,
		line2: input.line2,
		city: input.city,
		state: input.state,
		pincode: input.pincode,
		phone: input.phone,
		country: input.country
	};
}

export const supabaseAccountRepository: AccountRepository = {
	/**
	 * Resolve, then LINK, then create — in that order.
	 *
	 * §10 offers the account after the purchase, so the common case is a
	 * customer row that already exists with this email and no `user_id`.
	 * Matching on email and writing the link is what attaches a guest's order
	 * history to the account they create afterwards. Only when neither lookup
	 * finds anything is a fresh row written, because every signed-in customer
	 * needs a record for an address to hang off.
	 */
	async findCustomerForUser(userId: string, email: string): Promise<AccountCustomer | null> {
		const db = getServiceClient();
		const columns = 'id, user_id, email, phone, created_at';

		const byUser = await db
			.from('customers')
			.select(columns)
			.eq('user_id', userId)
			.maybeSingle<CustomerRow>();

		if (byUser.data) {
			const row = byUser.data;
			return {
				id: row.id,
				userId: row.user_id,
				email: row.email,
				phone: row.phone,
				createdAt: msOr(row.created_at, 0)
			};
		}

		if (!email) return null;

		const byEmail = await db
			.from('customers')
			.select(columns)
			.ilike('email', email)
			.maybeSingle<CustomerRow>();

		if (byEmail.data) {
			const row = byEmail.data;
			if (!row.user_id) {
				await db.from('customers').update({ user_id: userId }).eq('id', row.id);
			}
			return {
				id: row.id,
				userId: row.user_id ?? userId,
				email: row.email,
				phone: row.phone,
				createdAt: msOr(row.created_at, 0)
			};
		}

		const created = await db
			.from('customers')
			.insert({ user_id: userId, email })
			.select(columns)
			.maybeSingle<CustomerRow>();

		if (!created.data) return null;

		const row = created.data;
		return {
			id: row.id,
			userId: row.user_id,
			email: row.email,
			phone: row.phone,
			createdAt: msOr(row.created_at, 0)
		};
	},

	async listOrders(customerId: string): Promise<OrderSummary[]> {
		const db = getServiceClient();

		const { data: orders } = await db
			.from('orders')
			.select(ORDER_COLUMNS)
			.eq('customer_id', customerId)
			.order('created_at', { ascending: false })
			.returns<OrderRow[]>();

		const rows = orders ?? [];
		if (rows.length === 0) return [];

		const { data: lines } = await db
			.from('order_lines')
			.select(
				'id, order_id, variant_id, reservation_id, quantity, unit_price_paise, ' +
					'price_source, piece_number, sku_snapshot, name_snapshot'
			)
			.in(
				'order_id',
				rows.map((row) => row.id)
			)
			.returns<OrderLineRow[]>();

		const byOrder = new Map<string, OrderLineRow[]>();
		for (const line of lines ?? []) {
			const bucket = byOrder.get(line.order_id) ?? [];
			bucket.push(line);
			byOrder.set(line.order_id, bucket);
		}

		return rows.map((order) => toSummary(order, byOrder.get(order.id) ?? []));
	},

	async findOrder(customerId: string, orderNumber: string): Promise<OrderDetail | null> {
		const db = getServiceClient();

		// BOTH filters. The order number is human-facing and therefore guessable;
		// it never authorises a read on its own.
		const { data: order } = await db
			.from('orders')
			.select(ORDER_COLUMNS)
			.eq('customer_id', customerId)
			.eq('order_number', orderNumber)
			.maybeSingle<OrderRow>();

		if (!order) return null;

		const { data: lines } = await db
			.from('order_lines')
			.select(
				'id, order_id, variant_id, reservation_id, quantity, unit_price_paise, ' +
					'price_source, piece_number, sku_snapshot, name_snapshot'
			)
			.eq('order_id', order.id)
			.returns<OrderLineRow[]>();

		const lineRows = lines ?? [];

		return {
			...toSummary(order, lineRows),
			subtotal: money(order.subtotal_paise),
			shipping: money(order.shipping_paise),
			discount: money(order.discount_paise),
			tax: money(order.tax_paise),
			notes: order.notes,
			dispatchedAt: ms(order.dispatched_at),
			deliveredAt: ms(order.delivered_at),
			shipTo: {
				name: order.ship_name,
				line1: order.ship_line1,
				line2: order.ship_line2,
				city: order.ship_city,
				state: order.ship_state,
				pincode: order.ship_pincode,
				phone: order.ship_phone,
				country: order.ship_country
			},
			lines: lineRows.map(toLine)
		};
	},

	async listPreOrders(customerId: string): Promise<PreOrder[]> {
		const db = getServiceClient();

		const { data: reservations } = await db
			.from('reservations')
			.select(
				'id, drop_id, variant_id, state, piece_number, locked_price_paise, deposit_paise, ' +
					'balance_paise, dispatch_date, balance_due_by, cancellation_rule, created_at'
			)
			.eq('customer_id', customerId)
			.order('created_at', { ascending: false })
			.returns<ReservationRow[]>();

		const rows = reservations ?? [];
		if (rows.length === 0) return [];

		const ids = rows.map((row) => row.id);

		// Captured payments only. These are REPORTING figures beside the state;
		// §08 forbids inferring the state from them.
		const { data: payments } = await db
			.from('payments')
			.select('reservation_id, kind, amount_paise, state')
			.in('reservation_id', ids)
			.eq('state', 'captured')
			.returns<PaymentRow[]>();

		// §08: the order a reservation became is the SAME record, reached
		// through the order line that carries its id.
		const { data: closingLines } = await db
			.from('order_lines')
			.select('order_id, reservation_id')
			.in('reservation_id', ids)
			.returns<Array<{ order_id: string; reservation_id: string | null }>>();

		const orderIds = [...new Set((closingLines ?? []).map((line) => line.order_id))];
		const { data: closingOrders } = orderIds.length
			? await db
					.from('orders')
					.select('id, order_number')
					.eq('customer_id', customerId)
					.in('id', orderIds)
					.returns<Array<{ id: string; order_number: string }>>()
			: { data: [] as Array<{ id: string; order_number: string }> };

		const orderNumberById = new Map((closingOrders ?? []).map((o) => [o.id, o.order_number]));
		const orderNumberByReservation = new Map<string, string>();
		for (const line of closingLines ?? []) {
			const number = orderNumberById.get(line.order_id);
			if (line.reservation_id && number) orderNumberByReservation.set(line.reservation_id, number);
		}

		const paidByReservation = new Map<string, { deposit: Paise; balance: Paise }>();
		for (const payment of payments ?? []) {
			if (!payment.reservation_id) continue;
			const bucket = paidByReservation.get(payment.reservation_id) ?? {
				deposit: ZERO,
				balance: ZERO
			};
			const amount = money(payment.amount_paise);
			if (payment.kind === 'deposit') bucket.deposit = paise(bucket.deposit + amount);
			if (payment.kind === 'balance') bucket.balance = paise(bucket.balance + amount);
			paidByReservation.set(payment.reservation_id, bucket);
		}

		const catalogue = await loadCatalogueIndex();

		return rows.map<PreOrder>((row) => {
			const facts = catalogue.byVariantId(row.variant_id);
			const paid = paidByReservation.get(row.id) ?? { deposit: ZERO, balance: ZERO };

			return {
				id: row.id,
				state: row.state,
				dropSlug: facts?.dropSlug ?? '',
				dropName: facts?.dropName ?? 'This drop',
				dropNumber: facts?.dropNumber ?? 0,
				productName: facts?.productName ?? 'Reserved piece',
				sku: facts?.sku ?? null,
				size: facts?.size ?? null,
				pieceNumber: row.piece_number,
				editionSize: facts?.editionSize ?? 0,
				lockedPrice: money(row.locked_price_paise),
				deposit: money(row.deposit_paise),
				balance: money(row.balance_paise),
				depositPaid: paid.deposit,
				balancePaid: paid.balance,
				dispatchDate: row.dispatch_date,
				balanceDueBy: ms(row.balance_due_by),
				cancellationRule: row.cancellation_rule,
				createdAt: msOr(row.created_at, 0),
				orderNumber: orderNumberByReservation.get(row.id) ?? null
			};
		});
	},

	async listAddresses(customerId: string): Promise<SavedAddress[]> {
		const { data } = await getServiceClient()
			.from('addresses')
			.select(ADDRESS_COLUMNS)
			.eq('customer_id', customerId)
			.order('is_default', { ascending: false })
			.order('updated_at', { ascending: false })
			.returns<AddressRow[]>();

		return (data ?? []).map(toAddress);
	},

	async createAddress(customerId: string, input: AddressInput): Promise<AddressWriteResult> {
		const db = getServiceClient();

		const { count } = await db
			.from('addresses')
			.select('id', { count: 'exact', head: true })
			.eq('customer_id', customerId);

		if ((count ?? 0) >= 12) return { ok: false, reason: 'limit' };

		// The customer's first address is their default whether they ticked the
		// box or not: checkout needs something to preselect.
		const isDefault = input.isDefault || (count ?? 0) === 0;
		if (isDefault) await clearOtherDefaults(customerId, null);

		const { data, error } = await db
			.from('addresses')
			.insert({ customer_id: customerId, ...addressPayload(input), is_default: isDefault })
			.select(ADDRESS_COLUMNS)
			.maybeSingle<AddressRow>();

		if (error) {
			// The one-default index fired despite the clear above — two tabs, or
			// two requests. Reported, not thrown: a 500 here loses the typing.
			return { ok: false, reason: error.code === UNIQUE_VIOLATION ? 'conflict' : 'not_found' };
		}
		if (!data) return { ok: false, reason: 'not_found' };

		return { ok: true, address: toAddress(data) };
	},

	async updateAddress(
		customerId: string,
		addressId: string,
		input: AddressInput
	): Promise<AddressWriteResult> {
		const db = getServiceClient();

		if (input.isDefault) await clearOtherDefaults(customerId, addressId);

		const patch = input.isDefault
			? { ...addressPayload(input), is_default: true }
			: addressPayload(input);

		const { data, error } = await db
			.from('addresses')
			.update(patch)
			.eq('id', addressId)
			.eq('customer_id', customerId)
			.select(ADDRESS_COLUMNS)
			.maybeSingle<AddressRow>();

		if (error) {
			return { ok: false, reason: error.code === UNIQUE_VIOLATION ? 'conflict' : 'not_found' };
		}
		if (!data) return { ok: false, reason: 'not_found' };

		return { ok: true, address: toAddress(data) };
	},

	async deleteAddress(customerId: string, addressId: string): Promise<boolean> {
		const db = getServiceClient();

		const { data } = await db
			.from('addresses')
			.delete()
			.eq('id', addressId)
			.eq('customer_id', customerId)
			.select('id, is_default')
			.maybeSingle<{ id: string; is_default: boolean }>();

		if (!data) return false;

		if (data.is_default) {
			const { data: survivor } = await db
				.from('addresses')
				.select('id')
				.eq('customer_id', customerId)
				.order('updated_at', { ascending: false })
				.limit(1)
				.maybeSingle<{ id: string }>();

			if (survivor) {
				await db.from('addresses').update({ is_default: true }).eq('id', survivor.id);
			}
		}

		return true;
	},

	async setDefaultAddress(customerId: string, addressId: string): Promise<boolean> {
		const db = getServiceClient();

		// Confirm ownership BEFORE clearing anything, or a bad id would leave the
		// customer with no default at all.
		const { data: target } = await db
			.from('addresses')
			.select('id')
			.eq('id', addressId)
			.eq('customer_id', customerId)
			.maybeSingle<{ id: string }>();

		if (!target) return false;

		await clearOtherDefaults(customerId, addressId);

		const { error } = await db
			.from('addresses')
			.update({ is_default: true })
			.eq('id', addressId)
			.eq('customer_id', customerId);

		return !error;
	},

	async listNotifySubscriptions(email: string): Promise<NotifySubscription[]> {
		if (!email) return [];

		const { data } = await getServiceClient()
			.from('notify_requests')
			.select('id, variant_id, email, consented_at, notified_at')
			.ilike('email', email)
			.order('consented_at', { ascending: false })
			.returns<NotifyRow[]>();

		const rows = data ?? [];
		if (rows.length === 0) return [];

		const catalogue = await loadCatalogueIndex();

		return rows.map<NotifySubscription>((row) => {
			const facts = catalogue.byVariantId(row.variant_id);
			return {
				id: row.id,
				variantId: row.variant_id,
				sku: facts?.sku ?? null,
				size: facts?.size ?? null,
				dropSlug: facts?.dropSlug ?? null,
				dropName: facts?.dropName ?? null,
				productName: facts?.productName ?? null,
				consentedAt: msOr(row.consented_at, 0),
				notifiedAt: ms(row.notified_at)
			};
		});
	},

	/**
	 * §13: an unsubscribe is honoured by REMOVING the consent record, because
	 * the row is the consent. Keeping a tombstone would leave a marketing
	 * address on file that the customer believes they have withdrawn.
	 */
	async unsubscribeNotify(email: string, subscriptionId: string): Promise<boolean> {
		if (!email) return false;

		const { data } = await getServiceClient()
			.from('notify_requests')
			.delete()
			.eq('id', subscriptionId)
			.ilike('email', email)
			.select('id')
			.maybeSingle<{ id: string }>();

		return Boolean(data);
	},

	async listWaitlistEntries(customerId: string): Promise<WaitlistSubscription[]> {
		const { data } = await getServiceClient()
			.from('waitlist_entries')
			.select('id, variant_id, position, state, offered_at, created_at')
			.eq('customer_id', customerId)
			.order('position', { ascending: true })
			.returns<WaitlistRow[]>();

		const rows = data ?? [];
		if (rows.length === 0) return [];

		const catalogue = await loadCatalogueIndex();

		return rows.map<WaitlistSubscription>((row) => {
			const facts = catalogue.byVariantId(row.variant_id);
			return {
				id: row.id,
				variantId: row.variant_id,
				size: facts?.size ?? null,
				dropSlug: facts?.dropSlug ?? null,
				dropName: facts?.dropName ?? null,
				productName: facts?.productName ?? null,
				position: row.position,
				state: row.state,
				joinedAt: msOr(row.created_at, 0),
				offeredAt: ms(row.offered_at)
			};
		});
	},

	/**
	 * §06: nothing is deleted. Giving up a place is a STATE CHANGE, which keeps
	 * the queue's history intact and keeps `position` stable for everyone
	 * behind — renumbering a queue is how people lose their place.
	 */
	async withdrawWaitlist(customerId: string, entryId: string): Promise<boolean> {
		const { data } = await getServiceClient()
			.from('waitlist_entries')
			.update({ state: 'withdrawn' })
			.eq('id', entryId)
			.eq('customer_id', customerId)
			.select('id')
			.maybeSingle<{ id: string }>();

		return Boolean(data);
	}
};
