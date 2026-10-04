-- 0020 — Unpaid orders give their stock back.
--
-- app.commit_order() decrements public.variants.stock_count the moment an
-- order is placed, before it is paid. Since the cart now outlives an unpaid
-- order (src/lib/server/checkout/place.ts), a buyer who changes their cart or
-- address and checks out again places a NEW order — and every abandoned one
-- used to keep its pieces forever. At a 25-piece drop that is the whole drop.
--
-- Three ways an unpaid order now ends, all through ONE function:
--
--   app.cancel_superseded_orders()  the same cart placed a newer order
--   app.expire_unpaid_orders()      the payment window lapsed (cron, and
--                                   opportunistically at checkout)
--
-- and app.cancel_unpaid_orders() does the work for both: state guard, stock
-- give-back, coupon redemption release, idempotency key release.
--
-- THE PAYMENT WINS. A capture racing a cancellation must never lose money or
-- mark a cancelled order paid. Lock order is what makes this safe:
--
--   app.capture_payment()      payments row  → orders row
--   app.cancel_unpaid_orders() payments rows → orders rows → variants rows
--   app.commit_order()         carts row → cart_lines → variants rows
--
-- Every path takes payments before orders, and variants are always locked in
-- id order, so none of the three can deadlock another. Whichever of capture
-- and cancel takes the payment lock first decides:
--
--   capture first → the order is 'paid' when cancel re-reads it under lock,
--                   and the state guard skips it.
--   cancel first  → capture finds a cancelled order. It does NOT revive it
--                   (the stock may already be in someone else's order); it
--                   records the money in app.refunds as a 'cap_race' refund
--                   for admin to issue and reports 'captured_order_cancelled'.
--
-- Orders have no cart column. "This cart's orders" are the orders placed under
-- idempotency keys that start with the cart's prefix, `cart:<token>:` — the
-- format is owned by src/lib/server/cart/keys.ts and passed in, never rebuilt
-- here.

-- ---------------------------------------------------------------------------
-- The worker. Not callable by the API roles; only the functions below use it.
-- ---------------------------------------------------------------------------
create or replace function app.cancel_unpaid_orders(p_order_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = app, public, pg_temp
as $$
declare
  v_ids uuid[];
begin
  if p_order_ids is null or cardinality(p_order_ids) = 0 then
    return 0;
  end if;

  -- 1. Payments first, in id order: the same lock order app.capture_payment()
  --    uses, so a concurrent capture either finished already or waits for us.
  perform 1
  from app.payments p
  where p.order_id = any(p_order_ids)
  order by p.id
  for update;

  -- 2. The orders, re-checked UNDER the lock. The state guard lives here, in
  --    the locking read, not in an earlier unlocked select: an order paid a
  --    moment ago is skipped, never cancelled.
  select coalesce(array_agg(s.id order by s.id), '{}')
    into v_ids
  from (
    select o.id
    from app.orders o
    where o.id = any(p_order_ids)
      and o.state = 'pending_payment'
      and not exists (
        select 1 from app.payments p
        where p.order_id = o.id
          and p.state in ('authorized', 'captured')
      )
    order by o.id
    for update
  ) s;

  if cardinality(v_ids) = 0 then
    return 0;
  end if;

  -- 3. Stock back, variants locked in id order (the order commit_order uses).
  perform 1
  from public.variants v
  where v.id in (select ol.variant_id from app.order_lines ol where ol.order_id = any(v_ids))
  order by v.id
  for update;

  update public.variants v
     set stock_count = v.stock_count + l.quantity
    from (
      select ol.variant_id, sum(ol.quantity)::integer as quantity
      from app.order_lines ol
      where ol.order_id = any(v_ids)
      group by ol.variant_id
    ) l
   where v.id = l.variant_id;

  update app.orders
     set state = 'cancelled'
   where id = any(v_ids)
     and state = 'pending_payment';

  -- 4. A cancelled order no longer holds a coupon use. A paid order keeps its
  --    redemption; it never reaches this line.
  update app.coupons c
     set used_count = greatest(c.used_count - r.uses, 0)
    from (
      select cr.coupon_id, count(*)::integer as uses
      from app.coupon_redemptions cr
      where cr.order_id = any(v_ids)
      group by cr.coupon_id
    ) r
   where c.id = r.coupon_id;

  delete from app.coupon_redemptions where order_id = any(v_ids);

  -- 5. Release the idempotency key, so the SAME basket checked out again
  --    places a fresh order rather than replaying a cancelled one.
  delete from app.order_idempotency where order_id = any(v_ids);

  return cardinality(v_ids);
end;
$$;

comment on function app.cancel_unpaid_orders(uuid[]) is
  'Cancels the given orders that are still pending_payment with no authorized '
  'or captured payment: stock back to public.variants, coupon redemption and '
  'idempotency key released. Locks payments → orders → variants, the same '
  'order as capture_payment and commit_order. Returns the number cancelled.';

revoke all on function app.cancel_unpaid_orders(uuid[]) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- A cart placed a newer order: its other unpaid orders are superseded.
-- ---------------------------------------------------------------------------
create or replace function app.cancel_superseded_orders(
  p_key_prefix text,
  p_keep_key   text
)
returns integer
language plpgsql
security definer
set search_path = app, public, pg_temp
as $$
declare
  v_keep uuid;
  v_ids  uuid[];
begin
  -- A prefix this short would match other carts' keys. Refuse rather than
  -- cancel somebody else's order.
  if p_key_prefix is null or length(p_key_prefix) < 16 then
    raise exception 'cancel_superseded_orders: key prefix too short';
  end if;

  select i.order_id into v_keep from app.order_idempotency i where i.key = p_keep_key;

  select coalesce(array_agg(distinct i.order_id), '{}')
    into v_ids
  from app.order_idempotency i
  join app.orders o on o.id = i.order_id
  where starts_with(i.key, p_key_prefix)
    and i.key <> p_keep_key
    and (v_keep is null or i.order_id <> v_keep)
    and o.state = 'pending_payment';

  return app.cancel_unpaid_orders(v_ids);
end;
$$;

comment on function app.cancel_superseded_orders(text, text) is
  'Cancels the unpaid orders a cart placed under keys starting p_key_prefix, '
  'except the one under p_keep_key. Paid orders are never touched.';

revoke all on function app.cancel_superseded_orders(text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The payment window lapsed.
-- ---------------------------------------------------------------------------
create or replace function app.expire_unpaid_orders(
  p_older_than interval default interval '30 minutes',
  p_limit      integer  default 500
)
returns integer
language plpgsql
security definer
set search_path = app, public, pg_temp
as $$
declare
  v_ids uuid[];
begin
  select coalesce(array_agg(o.id), '{}')
    into v_ids
  from (
    select o.id
    from app.orders o
    where o.state = 'pending_payment'
      and o.created_at <= now() - p_older_than
    order by o.created_at
    limit greatest(p_limit, 0)
  ) o;

  return app.cancel_unpaid_orders(v_ids);
end;
$$;

comment on function app.expire_unpaid_orders(interval, integer) is
  'Cancels pending_payment orders older than p_older_than and gives their stock '
  'back. Idempotent; a concurrent capture wins. Called by /api/cron/expire-orders '
  'and opportunistically at checkout.';

revoke all on function app.expire_unpaid_orders(interval, integer) from public, anon, authenticated;

-- A partial index so the sweep never scans paid history.
create index if not exists orders_pending_created_idx
  on app.orders (created_at)
  where state = 'pending_payment';

-- ---------------------------------------------------------------------------
-- The double-submit fallback: the newest order this cart placed recently that
-- is still awaiting payment. Public token, or null.
-- ---------------------------------------------------------------------------
create or replace function app.recent_pending_order(
  p_key_prefix text,
  p_since      timestamptz
)
returns text
language sql
stable
security definer
set search_path = app, public, pg_temp
as $$
  select o.public_token
  from app.order_idempotency i
  join app.orders o on o.id = i.order_id
  where length(p_key_prefix) >= 16
    and starts_with(i.key, p_key_prefix)
    and o.state = 'pending_payment'
    and o.created_at >= p_since
  order by o.created_at desc
  limit 1;
$$;

revoke all on function app.recent_pending_order(text, timestamptz) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- app.apply_coupon() — a cart's own unpaid order does not use up its code.
--
-- A limited-use coupon redeemed by an order that is still pending_payment, and
-- that was placed by the cart asking (p_own_key_prefix), is not counted
-- against that cart: the order is either paid (and the cart retired) or
-- cancelled (and the use released) before the cart can redeem again. Every
-- other redemption — any paid order, any other cart's order — still counts.
--
-- Dropped and recreated rather than overloaded: a second signature with a
-- defaulted fourth argument would make every three-argument call ambiguous.
-- app.redeem_coupon() calls it with three arguments and is unaffected.
-- ---------------------------------------------------------------------------
drop function if exists app.apply_coupon(text, bigint, text);

create or replace function app.apply_coupon(
  p_code            text,
  p_subtotal_paise  bigint,
  -- §10: a coupon must NEVER apply to a deposit or a balance payment.
  p_payment_kind    text default 'order',
  p_own_key_prefix  text default null
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
  v_own    integer := 0;
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

  if c.max_uses is not null and p_own_key_prefix is not null and length(p_own_key_prefix) >= 16 then
    select count(distinct cr.order_id)::integer into v_own
    from app.coupon_redemptions cr
    join app.orders o on o.id = cr.order_id
    join app.order_idempotency i on i.order_id = cr.order_id
    where cr.coupon_id = c.id
      and o.state = 'pending_payment'
      and starts_with(i.key, p_own_key_prefix);
  end if;

  if c.max_uses is not null and c.used_count - v_own >= c.max_uses then
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

revoke all on function app.apply_coupon(text, bigint, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- app.capture_payment() — unchanged, except for an order that was cancelled
-- before the money landed. The payment is still recorded as captured (the
-- gateway took it; pretending otherwise loses track of real money), the order
-- stays cancelled, and a 'cap_race' refund row is written for admin to issue.
-- gateway_refund_id stays null until the refund is actually sent.
-- ---------------------------------------------------------------------------
create or replace function app.capture_payment(
  p_gateway_order_id   text,
  p_gateway_payment_id text,
  p_amount_paise       bigint
)
returns app.capture_result
language plpgsql
security definer
set search_path = app, public, pg_temp
as $$
declare
  v_payment app.payments%rowtype;
  v_token   text;
  v_state   app.order_state;
begin
  select * into v_payment
  from app.payments
  where gateway_order_id = p_gateway_order_id
  for update;

  if not found then
    return ('unknown_payment'::text, null::text);
  end if;

  if v_payment.state = 'captured' then
    select o.public_token into v_token from app.orders o where o.id = v_payment.order_id;
    return ('already_captured'::text, v_token);
  end if;

  if v_payment.amount_paise <> p_amount_paise then
    update app.payments set state = 'failed' where id = v_payment.id;
    return ('amount_mismatch'::text, null::text);
  end if;

  update app.payments
     set state = 'captured',
         gateway_payment_id = p_gateway_payment_id
   where id = v_payment.id
     and state <> 'captured';

  if v_payment.order_id is not null then
    update app.orders
       set state = 'paid'
     where id = v_payment.order_id
       and state = 'pending_payment'
    returning public_token into v_token;

    if v_token is null then
      select o.public_token, o.state into v_token, v_state
      from app.orders o where o.id = v_payment.order_id;

      -- Paid after it expired or was superseded. Never silently kept.
      if v_state = 'cancelled' then
        insert into app.refunds (payment_id, amount_paise, reason, state)
        select v_payment.id, p_amount_paise, 'cap_race', 'initiated'
        where p_amount_paise > 0
          and not exists (
            select 1 from app.refunds r
            where r.payment_id = v_payment.id and r.reason = 'cap_race'
          );
        return ('captured_order_cancelled'::text, v_token);
      end if;
    end if;
  end if;

  -- §08: a reservation, its deposit, its balance and its order are ONE record.
  if v_payment.reservation_id is not null then
    update app.reservations
       set state = case when v_payment.kind = 'balance' then 'balance_paid'::app.reservation_state
                        else state end
     where id = v_payment.reservation_id;
  end if;

  return ('captured'::text, v_token);
end;
$$;

comment on function app.capture_payment is
  'RW-100. Idempotent capture driven by the webhook, never by the browser '
  'redirect. Guarded by state in the WHERE clause so a redelivery is a no-op. '
  'A capture against a cancelled order records a cap_race refund and returns '
  'captured_order_cancelled (0020).';

revoke all on function app.capture_payment(text, text, bigint) from public, anon, authenticated;
