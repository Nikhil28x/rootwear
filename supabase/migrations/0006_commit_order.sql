-- 0006 — app.commit_order(): the whole order commit as ONE transaction.
--
-- Why one function rather than a sequence of client calls: PostgREST has no
-- transaction boundary across calls. A six-call REST commit (check stock,
-- decrement, insert order, insert lines, mark cart, ...) has five places it
-- can die half-done, which at a 25-piece drop minute means orphaned orders and
-- stranded pieces. Everything below commits or nothing does.
--
-- §04: "NEVER ACCEPT A PRICE FROM THE CLIENT. Order total is recomputed
-- server-side from the drop's own price at the moment of order creation."
-- There is deliberately NO amount parameter on this function.

create table app.order_idempotency (
  key        text primary key,
  order_id   uuid not null references app.orders(id) on delete restrict,
  created_at timestamptz not null default now()
);

create type app.commit_status as enum ('committed', 'replayed', 'out_of_stock', 'empty_cart');

create type app.commit_result as (
  status       app.commit_status,
  order_id     uuid,
  public_token text,
  order_number text
);

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
set search_path = app, public, pg_temp
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

  -- Customer, created or matched on email (guest checkout stays on, §10).
  insert into app.customers (email)
  values (lower(p_customer_email))
  on conflict (lower(email)) do update set updated_at = now()
  returning id into v_customer_id;

  -- Lock every variant in the cart, in a stable order, then verify stock.
  -- Ordering by variant_id prevents deadlock between two concurrent commits.
  for v_line in
    select cl.variant_id, cl.quantity
    from app.cart_lines cl
    where cl.cart_id = v_cart_id
    order by cl.variant_id
    for update
  loop
    perform 1 from public.variants v where v.id = v_line.variant_id for update;

    -- §08: reserved pieces are already allocated and are NOT sellable. Only
    -- unreserved stock goes on open sale.
    if (select v.stock_count - v.reserved_count
          from public.variants v where v.id = v_line.variant_id) < v_line.quantity then
      return (('out_of_stock')::app.commit_status, null::uuid, null::text, null::text);
    end if;
  end loop;

  if not exists (select 1 from app.cart_lines where cart_id = v_cart_id) then
    return (('empty_cart')::app.commit_status, null::uuid, null::text, null::text);
  end if;

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

  -- Price is resolved HERE, from the product record, against the drop's own
  -- launch instant. The client never supplies or influences it.
  for v_line in
    select cl.variant_id, cl.quantity
    from app.cart_lines cl
    where cl.cart_id = v_cart_id
    order by cl.variant_id
  loop
    select (now() >= d.launch_instant),
           case when now() >= d.launch_instant
                then p.launch_price_paise else p.prelaunch_price_paise end,
           case when now() >= d.launch_instant then 'launch' else 'prelaunch_locked' end
      into v_launched, v_price, v_source
    from public.variants v
    join public.products p on p.id = v.product_id
    join public.drops d on d.id = p.drop_id
    where v.id = v_line.variant_id;

    insert into app.order_lines (
      order_id, variant_id, quantity, unit_price_paise, price_source,
      sku_snapshot, name_snapshot
    )
    select v_order_id, v.id, v_line.quantity, v_price, v_source, v.sku, p.name
    from public.variants v
    join public.products p on p.id = v.product_id
    where v.id = v_line.variant_id;

    update public.variants
       set stock_count = stock_count - v_line.quantity
     where id = v_line.variant_id;

    v_subtotal := v_subtotal + (v_price * v_line.quantity);
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

comment on function app.commit_order is
  'RW-101. One transaction: lock cart and variants, verify unreserved stock, '
  'resolve price server-side from the drop launch instant, snapshot it onto '
  'each order line, decrement stock, commit. Takes no amount parameter — the '
  'client cannot supply a price.';

revoke all on function app.commit_order from public, anon, authenticated;
