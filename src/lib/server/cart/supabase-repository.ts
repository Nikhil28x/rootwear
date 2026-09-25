/**
 * Postgres-backed CartRepository.
 *
 * WRITTEN BUT NOT EXERCISED: the default is CATALOGUE_SOURCE=mock, so nothing
 * here runs until a database is configured. It is kept honest by being the
 * only other implementation of the same interface — every route calls the
 * interface, so the swap is an environment variable and nothing else.
 *
 * Everything below goes through the SERVICE client because the `app` schema is
 * not exposed through PostgREST at all (§04: nothing the browser can write to
 * orders, payments or carts). The justification is the one in db/clients.ts:
 * the server is acting as the SYSTEM here — committing an order, holding
 * stock, processing a gateway callback — not as the visitor.
 *
 * public.shipping_rates and public.pincode_exclusions are catalogue data and
 * are read through the catalogue client.
 */
import type { CartRepository, CommitInput } from './repository';
import type {
	CommitOutcome,
	CommitStatus,
	CouponOutcome,
	CouponStatus,
	OrderLineRecord,
	OrderRecord,
	OrderState,
	PaymentIntentRecord,
	PaymentKind,
	PriceSource,
	ReservationRecord,
	SavedAddress,
	ShippingEstimate,
	StoredCart,
	StoredCartLine
} from './types';
import { getCatalogueClient, getServiceClient } from '$lib/server/db/clients';
import { ZERO, paise, type Paise } from '$lib/money';
import type { Size } from '$lib/drop/sizes';

const asPaise = (value: number | string | null | undefined): Paise =>
	paise(Math.trunc(Number(value ?? 0)));

const iso = (ms: number) => new Date(ms).toISOString();

/** Postgres unique_violation — here it means "someone else got there first". */
const UNIQUE_VIOLATION = '23505';

type CartRow = {
	id: string;
	token: string;
	customer_id: string | null;
	coupon_code: string | null;
	expires_at: string;
};

type LineRow = { variant_id: string; quantity: number; held_until: string };

function toCart(row: CartRow): StoredCart {
	return {
		id: row.id,
		token: row.token,
		customerId: row.customer_id,
		couponCode: row.coupon_code,
		expiresAtMs: Date.parse(row.expires_at)
	};
}

export const supabaseCartRepository: CartRepository = {
	async findCart(token: string): Promise<StoredCart | null> {
		const { data, error } = await getServiceClient()
			.from('carts')
			.select('id, token, customer_id, coupon_code, expires_at')
			.eq('token', token)
			.maybeSingle();

		if (error) throw new Error(`findCart failed: ${error.message}`);
		return data ? toCart(data as unknown as CartRow) : null;
	},

	async createCart(token: string, nowMs: number): Promise<StoredCart> {
		const expiresAt = iso(nowMs + 30 * 24 * 60 * 60 * 1000);
		const { data, error } = await getServiceClient()
			.from('carts')
			.insert({ token, expires_at: expiresAt })
			.select('id, token, customer_id, coupon_code, expires_at')
			.single();

		// Two requests minting the same token is not a real scenario (the token
		// is 32 random bytes), but the unique constraint is what decides, not us.
		if (error) {
			if (error.code === UNIQUE_VIOLATION) {
				const existing = await this.findCart(token);
				if (existing) return existing;
			}
			throw new Error(`createCart failed: ${error.message}`);
		}
		return toCart(data as unknown as CartRow);
	},

	async listLines(cartId: string): Promise<StoredCartLine[]> {
		const { data, error } = await getServiceClient()
			.from('cart_lines')
			// NOTE the absence of a price column. That is by design — see types.ts.
			.select('variant_id, quantity, held_until')
			.eq('cart_id', cartId)
			.order('variant_id');

		if (error) throw new Error(`listLines failed: ${error.message}`);
		return (data as unknown as LineRow[]).map((row) => ({
			variantId: row.variant_id,
			quantity: row.quantity,
			heldUntilMs: Date.parse(row.held_until)
		}));
	},

	async addLine(cartId, variantId, quantity, heldUntilMs) {
		const client = getServiceClient();
		const { data, error } = await client
			.from('cart_lines')
			.select('quantity')
			.eq('cart_id', cartId)
			.eq('variant_id', variantId)
			.maybeSingle();

		if (error) throw new Error(`addLine read failed: ${error.message}`);

		const next = ((data as { quantity: number } | null)?.quantity ?? 0) + quantity;

		// unique (cart_id, variant_id) makes this an upsert rather than a
		// select-then-insert race.
		const { error: writeError } = await client.from('cart_lines').upsert(
			{
				cart_id: cartId,
				variant_id: variantId,
				quantity: next,
				// Adding re-stamps the hold: the visitor just showed intent.
				held_until: iso(heldUntilMs)
			},
			{ onConflict: 'cart_id,variant_id' }
		);

		if (writeError) throw new Error(`addLine failed: ${writeError.message}`);
	},

	async setQuantity(cartId, variantId, quantity, heldUntilMs) {
		if (quantity <= 0) return this.removeLine(cartId, variantId);

		const { error } = await getServiceClient()
			.from('cart_lines')
			.update({ quantity, held_until: iso(heldUntilMs) })
			.eq('cart_id', cartId)
			.eq('variant_id', variantId);

		if (error) throw new Error(`setQuantity failed: ${error.message}`);
	},

	async removeLine(cartId, variantId) {
		const { error } = await getServiceClient()
			.from('cart_lines')
			.delete()
			.eq('cart_id', cartId)
			.eq('variant_id', variantId);

		if (error) throw new Error(`removeLine failed: ${error.message}`);
	},

	async renewHold(cartId, heldUntilMs) {
		const { error } = await getServiceClient()
			.from('cart_lines')
			.update({ held_until: iso(heldUntilMs) })
			.eq('cart_id', cartId);

		if (error) throw new Error(`renewHold failed: ${error.message}`);
	},

	async countHoldsElsewhere(variantId, nowMs, exceptCartId) {
		// Only LIVE holds count. An expired hold releases itself — §10 — so
		// there is no sweeper to wait for and no row to delete.
		const { data, error } = await getServiceClient()
			.from('cart_lines')
			.select('quantity')
			.eq('variant_id', variantId)
			.gt('held_until', iso(nowMs))
			.neq('cart_id', exceptCartId);

		if (error) throw new Error(`countHoldsElsewhere failed: ${error.message}`);
		return (data as unknown as { quantity: number }[]).reduce((n, row) => n + row.quantity, 0);
	},

	async committedUnits() {
		// app.commit_order() decrements public.variants.stock_count inside the
		// same transaction, so the catalogue read already accounts for every
		// committed unit. Nothing to add here.
		return 0;
	},

	async setCoupon(cartId, code) {
		const { error } = await getServiceClient()
			.from('carts')
			.update({ coupon_code: code })
			.eq('id', cartId);

		if (error) throw new Error(`setCoupon failed: ${error.message}`);
	},

	async validateCoupon(code: string, subtotal: Paise, kind: PaymentKind): Promise<CouponOutcome> {
		// §10: validation is SERVER-SIDE and the refusal on a deposit or a
		// balance lives inside the function, not in a branch out here.
		const { data, error } = await getServiceClient().rpc('apply_coupon', {
			p_code: code,
			p_subtotal_paise: subtotal,
			p_payment_kind: kind
		});

		if (error) throw new Error(`validateCoupon failed: ${error.message}`);

		const row = data as unknown as {
			status: CouponStatus;
			coupon_id: string | null;
			discount_paise: number | string;
		};

		return {
			status: row.status,
			couponId: row.coupon_id,
			discount: asPaise(row.discount_paise)
		};
	},

	async shippingFor(subtotal: Paise): Promise<ShippingEstimate> {
		const { data, error } = await getCatalogueClient()
			.from('shipping_rates')
			.select('name, rate_paise, min_subtotal_paise, max_subtotal_paise')
			.eq('active', true)
			.lte('min_subtotal_paise', subtotal)
			.order('min_subtotal_paise', { ascending: false });

		if (error) throw new Error(`shippingFor failed: ${error.message}`);

		const rows = (data ?? []) as unknown as {
			name: string;
			rate_paise: number | string;
			max_subtotal_paise: number | string | null;
		}[];

		// Null max_subtotal_paise means "and above". The band is chosen here
		// rather than in SQL because a null upper bound is not expressible as a
		// PostgREST filter without losing the open-ended row.
		const band = rows.find(
			(row) => row.max_subtotal_paise === null || subtotal <= Number(row.max_subtotal_paise)
		);

		if (!band) return { label: 'Shipping', rate: ZERO };
		return { label: band.name, rate: asPaise(band.rate_paise) };
	},

	async pincodeExclusion(pincode: string): Promise<string | null> {
		const { data, error } = await getCatalogueClient()
			.from('pincode_exclusions')
			.select('reason')
			.eq('pincode', pincode)
			.maybeSingle();

		if (error) throw new Error(`pincodeExclusion failed: ${error.message}`);
		return (data as { reason: string } | null)?.reason ?? null;
	},

	async listAddresses(customerId: string): Promise<SavedAddress[]> {
		const { data, error } = await getServiceClient()
			.from('addresses')
			.select('id, label, name, line1, line2, city, state, pincode, phone, is_default')
			.eq('customer_id', customerId)
			.order('is_default', { ascending: false })
			.order('created_at', { ascending: false });

		if (error) throw new Error(`listAddresses failed: ${error.message}`);

		return (data ?? []).map((row) => {
			const address = row as unknown as SavedAddress;
			return {
				id: address.id,
				label: address.label,
				name: address.name,
				line1: address.line1,
				line2: address.line2,
				city: address.city,
				state: address.state,
				pincode: address.pincode,
				phone: address.phone
			};
		});
	},

	async findCustomerIdForUser(userId: string): Promise<string | null> {
		const { data, error } = await getServiceClient()
			.from('customers')
			.select('id')
			.eq('user_id', userId)
			.maybeSingle();

		if (error) throw new Error(`findCustomerIdForUser failed: ${error.message}`);
		return (data as { id: string } | null)?.id ?? null;
	},

	async attachCartToCustomer(cartId: string, customerId: string) {
		const { error } = await getServiceClient()
			.from('carts')
			.update({ customer_id: customerId })
			.eq('id', cartId);

		if (error) throw new Error(`attachCartToCustomer failed: ${error.message}`);
	},

	async commitOrder(input: CommitInput): Promise<CommitOutcome> {
		// ONE function, ONE transaction. It takes no amount: the total is
		// recomputed server-side from the drop's own price (§04).
		const { data, error } = await getServiceClient().rpc('commit_order', {
			p_idempotency_key: input.idempotencyKey,
			p_cart_token: input.cartToken,
			p_customer_email: input.ship.email,
			p_ship_name: input.ship.name,
			p_ship_line1: input.ship.line1,
			p_ship_line2: input.ship.line2,
			p_ship_city: input.ship.city,
			p_ship_state: input.ship.state,
			p_ship_pincode: input.ship.pincode,
			p_ship_phone: input.ship.phone,
			p_notes: input.ship.notes,
			p_shipping_paise: input.shipping
		});

		if (error) throw new Error(`commitOrder failed: ${error.message}`);

		const row = data as unknown as {
			status: CommitStatus;
			order_id: string | null;
			public_token: string | null;
			order_number: string | null;
		};

		// §10: the coupon is applied AFTER the commit, re-validated against the
		// order's own stored subtotal. A rejected code simply yields no discount;
		// it never blocks an order the customer has already placed.
		if (row.status === 'committed' && row.order_id && input.couponCode) {
			const { error: redeemError } = await getServiceClient().rpc('redeem_coupon', {
				p_order_id: row.order_id,
				p_code: input.couponCode
			});
			if (redeemError) console.error('[cart] redeem_coupon failed', redeemError.message);
		}

		return {
			status: row.status,
			orderId: row.order_id,
			publicToken: row.public_token,
			orderNumber: row.order_number
		};
	},

	async findOrderByToken(token: string): Promise<OrderRecord | null> {
		const client = getServiceClient();

		const { data, error } = await client
			.from('orders')
			.select(
				'id, order_number, public_token, state, subtotal_paise, shipping_paise, ' +
					'discount_paise, total_paise, ship_name, ship_line1, ship_line2, ship_city, ' +
					'ship_state, ship_pincode, ship_phone, notes, courier_name, tracking_ref, ' +
					'created_at, customer_id'
			)
			.eq('public_token', token)
			.maybeSingle();

		if (error) throw new Error(`findOrderByToken failed: ${error.message}`);
		if (!data) return null;

		const order = data as unknown as Record<string, string | number | null>;

		const [{ data: lineRows }, { data: customer }] = await Promise.all([
			client
				.from('order_lines')
				.select(
					'sku_snapshot, name_snapshot, quantity, unit_price_paise, price_source, piece_number, variant_id'
				)
				.eq('order_id', order.id as string),
			client
				.from('customers')
				.select('email')
				.eq('id', order.customer_id as string)
				.maybeSingle()
		]);

		const { data: sizeRows } = await getCatalogueClient()
			.from('variants')
			.select('id, size')
			.in(
				'id',
				((lineRows ?? []) as unknown as { variant_id: string }[]).map((row) => row.variant_id)
			);

		const sizeOf = new Map(
			((sizeRows ?? []) as unknown as { id: string; size: Size }[]).map((row) => [row.id, row.size])
		);

		const lines: OrderLineRecord[] = ((lineRows ?? []) as unknown as Record<string, never>[]).map(
			(row) => {
				const line = row as unknown as {
					sku_snapshot: string;
					name_snapshot: string;
					quantity: number;
					unit_price_paise: number | string;
					price_source: PriceSource;
					piece_number: number | null;
					variant_id: string;
				};
				return {
					sku: line.sku_snapshot,
					name: line.name_snapshot,
					size: sizeOf.get(line.variant_id) ?? null,
					quantity: line.quantity,
					// §06: the PRICE SNAPSHOT, never a join to a live product price.
					unitPrice: asPaise(line.unit_price_paise),
					priceSource: line.price_source,
					pieceNumber: line.piece_number
				};
			}
		);

		return {
			id: order.id as string,
			orderNumber: order.order_number as string,
			publicToken: order.public_token as string,
			state: order.state as OrderState,
			email: ((customer as { email: string } | null)?.email ?? '') as string,
			subtotal: asPaise(order.subtotal_paise),
			shipping: asPaise(order.shipping_paise),
			discount: asPaise(order.discount_paise),
			total: asPaise(order.total_paise),
			ship: {
				email: ((customer as { email: string } | null)?.email ?? '') as string,
				name: order.ship_name as string,
				line1: order.ship_line1 as string,
				line2: (order.ship_line2 as string | null) ?? null,
				city: order.ship_city as string,
				state: order.ship_state as string,
				pincode: order.ship_pincode as string,
				phone: order.ship_phone as string,
				notes: (order.notes as string | null) ?? null
			},
			lines,
			courierName: (order.courier_name as string | null) ?? null,
			trackingRef: (order.tracking_ref as string | null) ?? null,
			placedAtMs: Date.parse(order.created_at as string),
			hasPreOrderLine: lines.some((line) => line.priceSource === 'prelaunch_locked')
		};
	},

	async recordPaymentIntent(input) {
		const { error } = await getServiceClient().from('payments').insert({
			order_id: input.orderId,
			reservation_id: input.reservationId,
			kind: input.kind,
			gateway: input.gateway,
			gateway_order_id: input.gatewayOrderId,
			amount_paise: input.amount
		});

		if (error) throw new Error(`recordPaymentIntent failed: ${error.message}`);
	},

	async capturePayment(input) {
		// §04: idempotence lives in the function's WHERE clause, not in a read
		// out here — two concurrent deliveries cannot both win.
		const { data, error } = await getServiceClient().rpc('capture_payment', {
			p_gateway_order_id: input.gatewayOrderId,
			p_gateway_payment_id: input.gatewayPaymentId,
			p_amount_paise: input.amount
		});

		if (error) throw new Error(`capturePayment failed: ${error.message}`);

		const row = data as unknown as { status: string; order_public_token: string | null };
		if (row.status === 'amount_mismatch') {
			throw new Error('capturePayment refused: the gateway amount did not match the payment.');
		}

		return {
			orderPublicToken: row.order_public_token,
			alreadyCaptured: row.status === 'already_captured'
		};
	},

	async findPaymentIntent(input): Promise<PaymentIntentRecord | null> {
		let query = getServiceClient()
			.from('payments')
			.select('id, gateway, gateway_order_id, amount_paise, kind')
			.not('gateway_order_id', 'is', null)
			.order('created_at', { ascending: false })
			.limit(1);

		query = input.orderId
			? query.eq('order_id', input.orderId)
			: query.eq('reservation_id', input.reservationId ?? '');

		const { data, error } = await query.maybeSingle();
		if (error) throw new Error(`findPaymentIntent failed: ${error.message}`);
		if (!data) return null;

		const row = data as unknown as {
			id: string;
			gateway: string;
			gateway_order_id: string;
			amount_paise: number | string;
			kind: PaymentKind;
		};

		return {
			id: row.id,
			gateway: row.gateway,
			gatewayOrderId: row.gateway_order_id,
			amount: asPaise(row.amount_paise),
			kind: row.kind
		};
	},

	async findReservation(id: string): Promise<ReservationRecord | null> {
		const client = getServiceClient();
		const { data, error } = await client
			.from('reservations')
			.select(
				'id, drop_id, variant_id, state, piece_number, locked_price_paise, deposit_paise, ' +
					'balance_paise, balance_due_by, dispatch_date, cancellation_rule, customer_id'
			)
			.eq('id', id)
			.maybeSingle();

		if (error) throw new Error(`findReservation failed: ${error.message}`);
		if (!data) return null;

		const row = data as unknown as Record<string, string | number | null>;

		const [{ data: customer }, { data: variant }] = await Promise.all([
			client
				.from('customers')
				.select('email')
				.eq('id', row.customer_id as string)
				.maybeSingle(),
			getCatalogueClient()
				.from('variants')
				.select('size, products(name, drops(slug, name))')
				.eq('id', row.variant_id as string)
				.maybeSingle()
		]);

		const catalogue = variant as unknown as {
			size: Size;
			products: { name: string; drops: { slug: string; name: string } } | null;
		} | null;

		return {
			id: row.id as string,
			dropSlug: catalogue?.products?.drops?.slug ?? '',
			dropName: catalogue?.products?.drops?.name ?? '',
			productName: catalogue?.products?.name ?? '',
			size: (catalogue?.size ?? 'M') as Size,
			state: row.state as string,
			pieceNumber: (row.piece_number as number | null) ?? null,
			lockedPrice: asPaise(row.locked_price_paise),
			deposit: asPaise(row.deposit_paise),
			balance: asPaise(row.balance_paise),
			balanceDueByMs: row.balance_due_by ? Date.parse(row.balance_due_by as string) : null,
			dispatchDate: (row.dispatch_date as string | null) ?? null,
			cancellationRule: row.cancellation_rule as string,
			email: ((customer as { email: string } | null)?.email ?? '') as string
		};
	},

	async recordWebhookEvent(input) {
		// app.webhook_events.event_id IS the idempotency key. The insert either
		// wins or loses; losing means this delivery is a duplicate (§04).
		const { error } = await getServiceClient().from('webhook_events').insert({
			event_id: input.eventId,
			gateway: input.gateway,
			event_type: input.eventType,
			payload: input.payload
		});

		if (error) {
			if (error.code === UNIQUE_VIOLATION) return false;
			throw new Error(`recordWebhookEvent failed: ${error.message}`);
		}
		return true;
	},

	async markWebhookProcessed(eventId, errorMessage) {
		const { error } = await getServiceClient()
			.from('webhook_events')
			.update({ processed_at: new Date().toISOString(), process_error: errorMessage })
			.eq('event_id', eventId);

		if (error) throw new Error(`markWebhookProcessed failed: ${error.message}`);
	}
};
