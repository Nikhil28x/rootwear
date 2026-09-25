-- 0003 — Edition units, reservations and the waitlist. All in `app`.
--
-- §08 Records: "A reservation, its deposit, its balance payment and its final
-- order are ONE CONTINUOUS RECORD — the customer sees one thing in
-- /account/pre-orders, and admin sees one row with a clear state."

-- Customers. Optional: §10 keeps guest checkout on and offers an account
-- AFTER purchase rather than before, so a reservation need not have a user.
create table app.customers (
  id          uuid primary key default gen_random_uuid(),
  -- Null for guests. Links to Supabase Auth when an account is created.
  user_id     uuid unique references auth.users(id) on delete set null,
  email       text not null,
  phone       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index customers_email_idx on app.customers (lower(email));
create trigger customers_touch before update on app.customers
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- §08 — the reservation. ONE row carries tease -> deposit -> balance -> dispatch.
-- ---------------------------------------------------------------------------
create table app.reservations (
  id             uuid primary key default gen_random_uuid(),
  drop_id        text not null references public.drops(id) on delete restrict,
  variant_id     text not null references public.variants(id) on delete restrict,
  customer_id    uuid not null references app.customers(id) on delete restrict,

  -- §06/§08: state is explicit and exhaustive. It is NEVER inferred from the
  -- presence or absence of payment rows.
  state          app.reservation_state not null default 'pending_payment',

  -- §08: "a piece number allocated ON PAYMENT CONFIRMATION — never before."
  -- Null until app.reserve_piece() claims one. Unique per drop (below).
  piece_number   integer check (piece_number > 0),

  -- §08: the terms IN FORCE when the reservation was created, copied onto the
  -- row so a later config change cannot rewrite what the customer agreed to.
  locked_price_paise  bigint not null check (locked_price_paise >= 0),
  deposit_paise       bigint not null check (deposit_paise >= 0),
  balance_paise       bigint not null check (balance_paise >= 0),
  dispatch_date       date,
  -- §15 blocking open item RW-007: the cancellation rule is a consumer-law
  -- exposure, so the exact wording shown to this customer is stored with them.
  cancellation_rule   text not null,

  balance_due_by  timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- deposit + balance must equal the locked price, to the paise. This is the
  -- database-level guarantee behind src/lib/money.ts splitByPercent().
  constraint reservations_split_is_exact
    check (deposit_paise + balance_paise = locked_price_paise),

  -- A piece number exists if and only if the reservation got past payment.
  constraint reservations_piece_only_when_confirmed
    check (
      (piece_number is null and state in ('pending_payment', 'refunded_cap_race'))
      or (piece_number is not null and state not in ('pending_payment', 'refunded_cap_race'))
    )
);

-- RW-108: the last line of defence. Even a logic bug cannot double-allocate.
create unique index reservations_piece_unique
  on app.reservations (drop_id, piece_number)
  where piece_number is not null;

create index reservations_customer_idx on app.reservations (customer_id, created_at desc);
create index reservations_variant_idx on app.reservations (variant_id, state);

create trigger reservations_touch before update on app.reservations
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- §08 Overflow — "the visitor joins a WAITLIST, with no money taken. The
-- waitlist is ORDERED and is the queue for any release."
-- ---------------------------------------------------------------------------
create table app.waitlist_entries (
  id           uuid primary key default gen_random_uuid(),
  drop_id      text not null references public.drops(id) on delete restrict,
  variant_id   text not null references public.variants(id) on delete restrict,
  customer_id  uuid not null references app.customers(id) on delete restrict,
  -- Assigned by the database under a unique constraint, never by counting
  -- rows in application code — the same race that threatens piece numbers
  -- threatens queue positions (RW-114).
  position     integer not null check (position > 0),
  state        text not null default 'waiting'
                 check (state in ('waiting', 'offered', 'converted', 'expired', 'withdrawn')),
  offered_at   timestamptz,
  created_at   timestamptz not null default now(),

  unique (variant_id, position),
  -- A repeat join by the same customer and size does not create a second place.
  unique (variant_id, customer_id)
);

create index waitlist_queue_idx on app.waitlist_entries (variant_id, position)
  where state = 'waiting';

-- §07 / §13 — notify-me, with size interest recorded, feeding the demand board.
create table app.notify_requests (
  id           uuid primary key default gen_random_uuid(),
  variant_id   text not null references public.variants(id) on delete restrict,
  email        text not null,
  -- §13: "Opt-in consent is captured and logged at the point of signup."
  consented_at timestamptz not null default now(),
  consent_source text not null,
  notified_at  timestamptz,
  created_at   timestamptz not null default now(),
  unique (variant_id, email)
);
