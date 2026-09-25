-- 0011 — Coupons and shipping. §10.

-- §10 Coupons: "Field present at cart. Validation SERVER-SIDE; a coupon must
-- NEVER be applicable to a deposit or a balance payment."
create table app.coupons (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique check (code = upper(code) and length(code) between 3 and 32),
  kind           text not null check (kind in ('percent', 'fixed')),
  -- percent: 1-100. fixed: integer PAISE. Never a float, either way.
  value          bigint not null check (value > 0),
  -- Below this subtotal the coupon does not apply.
  min_subtotal_paise bigint not null default 0 check (min_subtotal_paise >= 0),
  -- Caps a percent coupon in absolute terms.
  max_discount_paise bigint check (max_discount_paise > 0),

  valid_from     timestamptz not null default now(),
  valid_until    timestamptz,
  max_uses       integer check (max_uses > 0),
  used_count     integer not null default 0 check (used_count >= 0),
  active         boolean not null default true,

  created_at     timestamptz not null default now(),

  constraint coupons_percent_range
    check (kind <> 'percent' or value between 1 and 100),
  constraint coupons_within_max_uses
    check (max_uses is null or used_count <= max_uses)
);

create table app.coupon_redemptions (
  id          uuid primary key default gen_random_uuid(),
  coupon_id   uuid not null references app.coupons(id) on delete restrict,
  order_id    uuid not null references app.orders(id) on delete restrict,
  customer_id uuid not null references app.customers(id) on delete restrict,
  amount_paise bigint not null check (amount_paise > 0),
  redeemed_at timestamptz not null default now(),
  -- A coupon applies once per order.
  unique (coupon_id, order_id)
);

-- §10: flat India-wide shipping in this phase (§11: Aaron ships all 25 pieces
-- himself via Porter; no courier integration). A table rather than a constant
-- so rates change without a deploy.
create table public.shipping_rates (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  -- Null `max_subtotal_paise` means "and above".
  min_subtotal_paise bigint not null default 0 check (min_subtotal_paise >= 0),
  max_subtotal_paise bigint check (max_subtotal_paise > 0),
  rate_paise    bigint not null check (rate_paise >= 0),
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

insert into public.shipping_rates (name, min_subtotal_paise, max_subtotal_paise, rate_paise)
values ('India — standard', 0, null, 0);

-- §10: "India only. ENFORCE AT THE ADDRESS FORM AND AT ORDER CREATION."
-- Serviceability exceptions, checked at checkout. Empty means all of India is
-- serviceable, which is the current position.
create table public.pincode_exclusions (
  pincode    text primary key check (pincode ~ '^[1-9][0-9]{6}?$' or pincode ~ '^[1-9][0-9]{5}$'),
  reason     text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- app.apply_coupon() — server-side validation. There is no client path that
-- can set a discount; the cart sends a CODE and gets back an AMOUNT.
-- ---------------------------------------------------------------------------
create type app.coupon_status as enum (
  'ok', 'not_found', 'inactive', 'expired', 'not_yet_valid',
  'exhausted', 'below_minimum', 'not_applicable_to_deposit'
);

create type app.coupon_result as (
  status         app.coupon_status,
  coupon_id      uuid,
  discount_paise bigint
);

create or replace function app.apply_coupon(
  p_code            text,
  p_subtotal_paise  bigint,
  -- §10: a coupon must NEVER apply to a deposit or a balance payment.
  p_payment_kind    text default 'order'
)
returns app.coupon_result
language plpgsql
stable
security definer
set search_path = app, public, pg_temp
as $$
declare
  c        app.coupons%rowtype;
  v_amount bigint;
begin
  if p_payment_kind in ('deposit', 'balance') then
    return (('not_applicable_to_deposit')::app.coupon_status, null::uuid, 0::bigint);
  end if;

  select * into c from app.coupons where code = upper(trim(p_code));
  if not found then
    return (('not_found')::app.coupon_status, null::uuid, 0::bigint);
  end if;
  if not c.active then
    return (('inactive')::app.coupon_status, c.id, 0::bigint);
  end if;
  if c.valid_from > now() then
    return (('not_yet_valid')::app.coupon_status, c.id, 0::bigint);
  end if;
  if c.valid_until is not null and c.valid_until < now() then
    return (('expired')::app.coupon_status, c.id, 0::bigint);
  end if;
  if c.max_uses is not null and c.used_count >= c.max_uses then
    return (('exhausted')::app.coupon_status, c.id, 0::bigint);
  end if;
  if p_subtotal_paise < c.min_subtotal_paise then
    return (('below_minimum')::app.coupon_status, c.id, 0::bigint);
  end if;

  -- Integer paise arithmetic throughout. Rounding is floor, which favours the
  -- customer by at most one paise and never over-discounts.
  if c.kind = 'percent' then
    v_amount := (p_subtotal_paise * c.value) / 100;
    if c.max_discount_paise is not null then
      v_amount := least(v_amount, c.max_discount_paise);
    end if;
  else
    v_amount := c.value;
  end if;

  -- A discount can never exceed the subtotal.
  v_amount := least(v_amount, p_subtotal_paise);

  return (('ok')::app.coupon_status, c.id, v_amount);
end;
$$;

revoke all on function app.apply_coupon(text, bigint, text) from public, anon, authenticated;

alter table app.coupons            enable row level security;
alter table app.coupon_redemptions enable row level security;
alter table public.shipping_rates  enable row level security;
alter table public.pincode_exclusions enable row level security;

-- Rates and exclusions are public: the cart shows a shipping estimate.
create policy shipping_public_read on public.shipping_rates
  for select to anon, authenticated using (active);
create policy pincode_public_read on public.pincode_exclusions
  for select to anon, authenticated using (true);

-- Coupon DEFINITIONS are never public — listing them would leak every code.
create policy coupons_owner_all on app.coupons
  for all to authenticated using (app.is_owner()) with check (app.is_owner());
create policy redemptions_owner_read on app.coupon_redemptions
  for select to authenticated using (app.is_owner());
