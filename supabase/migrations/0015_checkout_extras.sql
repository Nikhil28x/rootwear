-- 0015 — Checkout extras: coupon redemption onto a committed order, and the
-- payment capture the webhook performs.
--
-- Both exist for the same reason app.commit_order() exists: PostgREST has no
-- transaction boundary across calls, so anything that must be all-or-nothing
-- has to be one function. Neither adds a table; both close a gap that would
-- otherwise be papered over with a multi-call sequence in TypeScript.

-- ---------------------------------------------------------------------------
-- The cart's coupon CODE.
--
-- A code, never an amount — §10: "Validation SERVER-SIDE; a coupon must NEVER
-- be applicable to a deposit or a balance payment." Storing the code rather
-- than a discount means the cart cannot carry a stale figure across a price
-- change, a lapsed coupon or a changed subtotal: it is re-validated by
-- app.apply_coupon() on every read, exactly like the line prices are.
-- ---------------------------------------------------------------------------
alter table app.carts add column if not exists coupon_code text;

comment on column app.carts.coupon_code is
  'The code the visitor typed. The discount is never stored here — it is '
  'recomputed by app.apply_coupon() on every cart read and written onto the '
  'order only by app.redeem_coupon().';

-- ---------------------------------------------------------------------------
-- app.redeem_coupon() — §10.
--
-- app.commit_order() deliberately takes no amount and applies no discount: it
-- resolves prices and totals from the catalogue alone. The coupon is applied
-- here, AFTER the commit, and re-validated by app.apply_coupon() against the
-- order's OWN stored subtotal — not against any figure the browser sent.
--
-- The order's check constraint (total = subtotal + shipping - discount) is the
-- backstop: an inconsistent discount cannot be written at all.
-- ---------------------------------------------------------------------------
create type app.redeem_status as enum ('redeemed', 'already_redeemed', 'rejected', 'no_order');

create type app.redeem_result as (
  status         app.redeem_status,
  discount_paise bigint
);

create or replace function app.redeem_coupon(
  p_order_id uuid,
  p_code     text
)
returns app.redeem_result
language plpgsql
security definer
set search_path = app, public, pg_temp
as $$
declare
  v_order    app.orders%rowtype;
  v_outcome  app.coupon_result;
begin
  select * into v_order from app.orders where id = p_order_id for update;
  if not found then
    return (('no_order')::app.redeem_status, 0::bigint);
  end if;

  -- Applying the same coupon to the same order twice is a no-op, not a
  -- second discount. unique (coupon_id, order_id) is the hard guarantee;
  -- this is the readable one.
  if exists (select 1 from app.coupon_redemptions where order_id = p_order_id) then
    return (('already_redeemed')::app.redeem_status, v_order.discount_paise);
  end if;

  -- §10: validation is SERVER-SIDE, against the order's own subtotal, and the
  -- payment kind is fixed to 'order' — a deposit or balance never reaches here.
  v_outcome := app.apply_coupon(p_code, v_order.subtotal_paise, 'order');

  if v_outcome.status <> 'ok' or v_outcome.discount_paise <= 0 then
    return (('rejected')::app.redeem_status, 0::bigint);
  end if;

  update app.orders
     set discount_paise = v_outcome.discount_paise,
         total_paise    = v_order.subtotal_paise + v_order.shipping_paise
                            - v_outcome.discount_paise
   where id = p_order_id;

  insert into app.coupon_redemptions (coupon_id, order_id, customer_id, amount_paise)
  values (v_outcome.coupon_id, p_order_id, v_order.customer_id, v_outcome.discount_paise);

  update app.coupons set used_count = used_count + 1 where id = v_outcome.coupon_id;

  return (('redeemed')::app.redeem_status, v_outcome.discount_paise);
end;
$$;

comment on function app.redeem_coupon is
  'RW-104. Re-validates a coupon CODE against the order''s own stored subtotal '
  'and writes the discount, the redemption row and the use count in one '
  'transaction. The client never supplies an amount.';

revoke all on function app.redeem_coupon(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- app.capture_payment() — §04: "THE WEBHOOK IS THE SOURCE OF TRUTH for payment
-- success, not the browser redirect, and webhook handling must be IDEMPOTENT."
--
-- Idempotence lives in the WHERE clause, not in a prior read: the update only
-- fires on a payment that is not already captured, so two concurrent
-- deliveries of the same event cannot both win. The loser is told
-- already_captured and does nothing.
-- ---------------------------------------------------------------------------
create type app.capture_result as (
  status             text,
  order_public_token text
);

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

  -- The gateway is the authority on the amount; a mismatch is recorded as a
  -- failure rather than silently accepted, because a short payment that marks
  -- an order paid is the worst possible outcome here.
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
      select o.public_token into v_token from app.orders o where o.id = v_payment.order_id;
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
  'redirect. Guarded by state in the WHERE clause so a redelivery is a no-op.';

revoke all on function app.capture_payment(text, text, bigint) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Cart holds: the index that makes "units held in OTHER carts" cheap. Without
-- it, every add-to-cart at the drop minute scans app.cart_lines.
-- ---------------------------------------------------------------------------
create index if not exists cart_lines_variant_hold_idx
  on app.cart_lines (variant_id, held_until);
