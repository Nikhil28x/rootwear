-- 0036 — A founder's price: the first N pieces of a product sell cheaper.
--
-- Drop 01 opens with "₹3,600 for the first 10 pieces, as a thank-you to our
-- earliest backers", then the tee goes back to its launch price (₹4,300).
-- The switch has to happen on its own, at the exact piece, so it lives where
-- the price is decided: app.commit_order().
--
--   offer_price_paise  the founder's price, below the launch price
--   offer_pieces       how many pieces sell at it
--   offer_label        short name for the buy bar, e.g. "Founder's price"
--   offer_note         the line under the price on the product page
--
-- All four NULL means no offer. The offer only replaces the LAUNCH price:
-- tease reservations keep their own locked pre-launch price.
--
-- A piece counts as taken once it is on an order that isn't cancelled. An
-- unpaid order holds its piece until it expires (0020 cancels it), then the
-- piece is offered again: exactly how stock already behaves.

alter table public.products
  add column if not exists offer_price_paise bigint check (offer_price_paise > 0),
  add column if not exists offer_pieces      integer check (offer_pieces > 0),
  add column if not exists offer_label       text,
  add column if not exists offer_note        text;

alter table public.products
  drop constraint if exists products_offer_complete;
alter table public.products
  add constraint products_offer_complete check (
    (offer_price_paise is null) = (offer_pieces is null)
    and (offer_price_paise is null or offer_price_paise < launch_price_paise)
  );

comment on column public.products.offer_price_paise is
  'Founder''s price. Charged instead of the launch price for the first offer_pieces pieces.';

-- Order lines can now say they were sold at the founder's price.
alter table app.order_lines drop constraint if exists order_lines_price_source_check;
alter table app.order_lines
  add constraint order_lines_price_source_check
  check (price_source in ('prelaunch_locked', 'launch', 'offer'));

-- ---------------------------------------------------------------------------
-- How many founder's-price pieces are taken. A PostgREST computed column, so
-- the storefront reads it beside the product: products ( …, offer_taken ).
-- ---------------------------------------------------------------------------
create or replace function public.offer_taken(p public.products)
returns integer
language sql
stable
security definer
set search_path = app, public, pg_temp
as $$
  select coalesce(sum(ol.quantity), 0)::integer
  from app.order_lines ol
  join app.orders o on o.id = ol.order_id
  join public.variants v on v.id = ol.variant_id
  where v.product_id = p.id
    and ol.price_source = 'offer'
    and o.state <> 'cancelled';
$$;

revoke all on function public.offer_taken(public.products) from public, anon, authenticated;
grant execute on function public.offer_taken(public.products) to service_role;

-- ---------------------------------------------------------------------------
-- commit_order, now pricing the founder's pieces. Unchanged from 0006 (with
-- 0032's search_path) except where marked OFFER.
-- ---------------------------------------------------------------------------
create or replace function app.commit_order(
  p_idempotency_key text,
  p_cart_token      text,
  p_customer_email  text,
  p_ship_name       text,
  p_ship_line1      text,
  p_ship_line2      text,
  p_ship_city       text,
  p_ship_state      text,
  p_ship_pincode    text,
  p_ship_phone      text,
  p_notes           text,
  p_shipping_paise  bigint default 0
)
returns app.commit_result
language plpgsql
security definer
set search_path = app, public, extensions, pg_temp
as $$
declare
  v_cart_id     uuid;
  v_customer_id uuid;
  v_order_id    uuid;
  v_token       text;
  v_number      text;
  v_subtotal    bigint := 0;
  v_line        record;
  v_price       bigint;
  v_source      text;
  v_launched    boolean;
  v_product     record;
  v_offer_qty   integer;
  v_result      app.commit_result;
begin
  -- Idempotent replay: a retried submit returns the SAME order.
  select o.id, o.public_token, o.order_number
    into v_order_id, v_token, v_number
  from app.order_idempotency i
  join app.orders o on o.id = i.order_id
  where i.key = p_idempotency_key;

  if found then
    return (('replayed')::app.commit_status, v_order_id, v_token, v_number);
  end if;

  select c.id into v_cart_id
  from app.carts c
  where c.token = p_cart_token
  for update;

  if not found then
    return (('empty_cart')::app.commit_status, null::uuid, null::text, null::text);
  end if;

  insert into app.customers (email)
  values (lower(p_customer_email))
  on conflict (lower(email)) do update set updated_at = now()
  returning id into v_customer_id;

  -- Lock every variant in the cart, in a stable order, then verify stock.
  for v_line in
    select cl.variant_id, cl.quantity
    from app.cart_lines cl
    where cl.cart_id = v_cart_id
    order by cl.variant_id
    for update
  loop
    perform 1 from public.variants v where v.id = v_line.variant_id for update;

    if (select v.stock_count - v.reserved_count
          from public.variants v where v.id = v_line.variant_id) < v_line.quantity then
      return (('out_of_stock')::app.commit_status, null::uuid, null::text, null::text);
    end if;
  end loop;

  if not exists (select 1 from app.cart_lines where cart_id = v_cart_id) then
    return (('empty_cart')::app.commit_status, null::uuid, null::text, null::text);
  end if;

  -- OFFER: lock each product with an offer, in id order, after the variants.
  -- Two checkouts racing for the last founder's piece queue here, so the
  -- second one counts the first one's line and pays the launch price.
  perform 1
  from public.products p
  where p.offer_price_paise is not null
    and p.id in (
      select v.product_id from app.cart_lines cl
      join public.variants v on v.id = cl.variant_id
      where cl.cart_id = v_cart_id
    )
  order by p.id
  for update;

  v_token  := encode(gen_random_bytes(24), 'hex');
  v_number := 'RW' || to_char(now(), 'YYMMDD') || '-' || upper(substr(v_token, 1, 5));

  insert into app.orders (
    customer_id, order_number, public_token, state,
    subtotal_paise, shipping_paise, discount_paise, total_paise,
    ship_name, ship_line1, ship_line2, ship_city, ship_state, ship_pincode,
    ship_phone, notes
  ) values (
    v_customer_id, v_number, v_token, 'pending_payment',
    0, p_shipping_paise, 0, p_shipping_paise,
    p_ship_name, p_ship_line1, p_ship_line2, p_ship_city, p_ship_state,
    p_ship_pincode, p_ship_phone, p_notes
  )
  returning id into v_order_id;

  -- Price is resolved HERE, from the product record. The client never
  -- supplies or influences it. Mirrors resolvePrice() and buildCartView() in
  -- src/lib/server/cart/pricing.ts.
  for v_line in
    select cl.variant_id, cl.quantity
    from app.cart_lines cl
    where cl.cart_id = v_cart_id
    order by cl.variant_id
  loop
    select p.*, d.state as drop_state, d.launch_instant
      into v_product
    from public.variants v
    join public.products p on p.id = v.product_id
    join public.drops d on d.id = p.drop_id
    where v.id = v_line.variant_id;

    v_launched := v_product.drop_state in ('LIVE','PARTIAL','RE_DROP')
                  or now() >= v_product.launch_instant;

    -- OFFER: at launch, the founder's pieces still left go first. The count
    -- includes lines this order has already written. A line that crosses
    -- the last founder's piece is split: some at the offer, the rest at launch.
    v_offer_qty := 0;
    if v_launched and v_product.offer_price_paise is not null then
      v_offer_qty := least(
        v_line.quantity,
        greatest(0, v_product.offer_pieces - public.offer_taken(
          (select p from public.products p where p.id = v_product.id)
        ))
      );
    end if;

    if v_offer_qty > 0 then
      insert into app.order_lines (
        order_id, variant_id, quantity, unit_price_paise, price_source,
        sku_snapshot, name_snapshot
      )
      select v_order_id, v.id, v_offer_qty, v_product.offer_price_paise, 'offer',
             v.sku, v_product.name
      from public.variants v
      where v.id = v_line.variant_id;

      v_subtotal := v_subtotal + (v_product.offer_price_paise * v_offer_qty);
    end if;

    if v_line.quantity > v_offer_qty then
      v_price  := case when v_launched then v_product.launch_price_paise
                       else v_product.prelaunch_price_paise end;
      v_source := case when v_launched then 'launch' else 'prelaunch_locked' end;

      insert into app.order_lines (
        order_id, variant_id, quantity, unit_price_paise, price_source,
        sku_snapshot, name_snapshot
      )
      select v_order_id, v.id, v_line.quantity - v_offer_qty, v_price, v_source,
             v.sku, v_product.name
      from public.variants v
      where v.id = v_line.variant_id;

      v_subtotal := v_subtotal + (v_price * (v_line.quantity - v_offer_qty));
    end if;

    update public.variants
       set stock_count = stock_count - v_line.quantity
     where id = v_line.variant_id;
  end loop;

  update app.orders
     set subtotal_paise = v_subtotal,
         total_paise = v_subtotal + p_shipping_paise
   where id = v_order_id;

  insert into app.order_idempotency (key, order_id)
  values (p_idempotency_key, v_order_id);

  delete from app.cart_lines where cart_id = v_cart_id;

  return (('committed')::app.commit_status, v_order_id, v_token, v_number);
end;
$$;

revoke all on function app.commit_order(
  text, text, text, text, text, text, text, text, text, text, text, bigint
) from public, anon, authenticated;
