-- 0004 — Carts, orders, payments. All in `app`.
--
-- §04: "NEVER ACCEPT A PRICE FROM THE CLIENT. Order total is recomputed
-- server-side from the drop's own price at the moment of order creation."

-- §10 Cart hold: stock held for a fixed number of minutes from add-to-cart,
-- released automatically, so a full cart cannot block a sale indefinitely.
create table app.carts (
  id           uuid primary key default gen_random_uuid(),
  -- Guest carts are the norm (§10: guest checkout on, accounts optional).
  customer_id  uuid references app.customers(id) on delete set null,
  -- Opaque cookie token. Never a customer id, never guessable.
  token        text not null unique,
  expires_at   timestamptz not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger carts_touch before update on app.carts
  for each row execute function app.touch_updated_at();

create table app.cart_lines (
  id          uuid primary key default gen_random_uuid(),
  cart_id     uuid not null references app.carts(id) on delete cascade,
  variant_id  text not null references public.variants(id) on delete restrict,
  quantity    integer not null check (quantity > 0),
  -- §10: the hold window. Expired holds are swept by the scheduled job.
  held_until  timestamptz not null,
  created_at  timestamptz not null default now(),
  unique (cart_id, variant_id)
  --
  -- DELIBERATELY NO price column. Price is resolved server-side on every read
  -- and snapshotted only at order creation. A price captured at add-to-cart
  -- would charge a stale figure if the drop crossed its launch instant while
  -- the item sat in the cart.
);

create index cart_lines_hold_idx on app.cart_lines (held_until);

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------
create table app.orders (
  id            uuid primary key default gen_random_uuid(),
  -- Human-facing reference, used by the §11 Track Order page.
  order_number  text not null unique,
  customer_id   uuid not null references app.customers(id) on delete restrict,
  state         app.order_state not null default 'pending_payment',

  -- Recomputed server-side at creation. bigint paise throughout.
  subtotal_paise  bigint not null check (subtotal_paise >= 0),
  shipping_paise  bigint not null default 0 check (shipping_paise >= 0),
  discount_paise  bigint not null default 0 check (discount_paise >= 0),
  total_paise     bigint not null check (total_paise >= 0),

  -- §10: displayed prices are INCLUSIVE. If registered, the invoice shows the
  -- break-up and the GSTIN. Stored for the invoice, not added to the total.
  tax_paise       bigint not null default 0 check (tax_paise >= 0),

  -- §10: India only, enforced at the address form AND at order creation.
  ship_country    text not null default 'IN' check (ship_country = 'IN'),
  ship_name       text not null,
  ship_line1      text not null,
  ship_line2      text,
  ship_city       text not null,
  ship_state      text not null,
  ship_pincode    text not null check (ship_pincode ~ '^[1-9][0-9]{5}$'),
  ship_phone      text not null,
  -- §10: order-notes field.
  notes           text,

  -- §11: tracking reference, entered by hand in this phase (no carrier API).
  courier_name     text,
  tracking_ref     text,
  dispatched_at    timestamptz,
  delivered_at     timestamptz,

  -- Token for the order-confirmation URL, so /order/<token> is not enumerable.
  public_token    text not null unique,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint orders_total_is_consistent
    check (total_paise = subtotal_paise + shipping_paise - discount_paise)
);

create index orders_customer_idx on app.orders (customer_id, created_at desc);
create trigger orders_touch before update on app.orders
  for each row execute function app.touch_updated_at();

create table app.order_lines (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references app.orders(id) on delete restrict,
  variant_id    text not null references public.variants(id) on delete restrict,
  -- A pre-order line points at the reservation it fulfils, so the customer
  -- sees ONE continuous record (§08).
  reservation_id uuid references app.reservations(id) on delete restrict,
  quantity      integer not null check (quantity > 0),

  -- §08/§06 PRICE SNAPSHOT. Never join to a live product price to render a
  -- historical order: the drop's price changes at launch and the archive must
  -- keep price history intact.
  unit_price_paise  bigint not null check (unit_price_paise >= 0),
  -- Which price this was, for the invoice and for audit.
  price_source      text not null check (price_source in ('prelaunch_locked', 'launch')),
  -- The physical numbered piece this line delivers.
  piece_number      integer,

  -- Denormalised for the invoice, which must survive a catalogue edit.
  sku_snapshot      text not null,
  name_snapshot     text not null
);

create index order_lines_order_idx on app.order_lines (order_id);

-- ---------------------------------------------------------------------------
-- Payments — §04: "THE WEBHOOK IS THE SOURCE OF TRUTH for payment success,
-- not the browser redirect. Webhook handling must be IDEMPOTENT."
-- ---------------------------------------------------------------------------
create table app.payments (
  id                  uuid primary key default gen_random_uuid(),
  -- A payment settles either an order or a reservation deposit/balance.
  order_id            uuid references app.orders(id) on delete restrict,
  reservation_id      uuid references app.reservations(id) on delete restrict,
  kind                text not null check (kind in ('deposit', 'balance', 'order')),

  gateway             text not null default 'razorpay',
  gateway_order_id    text,
  gateway_payment_id  text unique,

  amount_paise        bigint not null check (amount_paise >= 0),
  state               text not null default 'created'
                        check (state in ('created', 'authorized', 'captured', 'failed', 'refunded')),

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint payments_target_present
    check (order_id is not null or reservation_id is not null)
);

create trigger payments_touch before update on app.payments
  for each row execute function app.touch_updated_at();

-- RW-099 — the idempotency ledger. A duplicate webhook delivery must not
-- create a second order. Razorpay times out around 5s and redelivers, so the
-- handler inserts here, returns 200, and processes asynchronously.
create table app.webhook_events (
  -- Razorpay's x-razorpay-event-id. The primary key IS the idempotency key.
  event_id      text primary key,
  gateway       text not null default 'razorpay',
  event_type    text not null,
  payload       jsonb not null,
  received_at   timestamptz not null default now(),
  processed_at  timestamptz,
  process_error text
);

create index webhook_events_unprocessed_idx on app.webhook_events (received_at)
  where processed_at is null;

-- §08 Refunds, including the automatic one when a reservation loses the cap race.
create table app.refunds (
  id                 uuid primary key default gen_random_uuid(),
  payment_id         uuid not null references app.payments(id) on delete restrict,
  amount_paise       bigint not null check (amount_paise > 0),
  reason             text not null check (reason in ('cap_race', 'cancellation', 'defect', 'admin')),
  gateway_refund_id  text unique,
  state              text not null default 'initiated'
                       check (state in ('initiated', 'processed', 'failed')),
  created_at         timestamptz not null default now()
);
