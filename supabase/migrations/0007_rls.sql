-- 0007 — Row Level Security.
--
-- §04: "ROW-LEVEL SECURITY ON EVERY CUSTOMER-FACING TABLE."
--
-- Two layers, because RLS alone is one policy mistake away from a leak:
--   1. The `app` schema is not exposed through PostgREST, so the browser
--      cannot address orders, reservations, payments or customers at all.
--   2. RLS is still enabled on every one of those tables, deny-by-default,
--      so a future decision to expose the schema does not silently open it.
--
-- §12 role split: Aaron has full access; Trone has LAYOUT ACCESS ONLY with
-- "NO ACCESS TO ORDERS, CUSTOMER RECORDS OR PAYOUTS". That split is enforced
-- here in the database, not merely by hiding nav items.

-- ---------------------------------------------------------------------------
-- Staff roles
-- ---------------------------------------------------------------------------
create table app.staff (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  -- 'owner'  = Aaron: drops, products, stock, orders, reservations, reports.
  -- 'layout' = Trone: page layout, banners, copy, navigation. Nothing else.
  role     text not null check (role in ('owner', 'layout')),
  created_at timestamptz not null default now()
);

alter table app.staff enable row level security;

create or replace function app.is_owner()
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_temp
as $$
  select exists (
    select 1 from app.staff s
    where s.user_id = (select auth.uid()) and s.role = 'owner'
  );
$$;

create or replace function app.is_staff()
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_temp
as $$
  select exists (select 1 from app.staff s where s.user_id = (select auth.uid()));
$$;

-- The customer row belonging to the caller, if any.
create or replace function app.current_customer_id()
returns uuid
language sql
stable
security definer
set search_path = app, public, pg_temp
as $$
  select c.id from app.customers c where c.user_id = (select auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Catalogue (public schema) — anon may READ published rows only.
-- ---------------------------------------------------------------------------
alter table public.drops             enable row level security;
alter table public.products          enable row level security;
alter table public.product_images    enable row level security;
alter table public.variants          enable row level security;
alter table public.price_history     enable row level security;
alter table public.drop_state_events enable row level security;

-- §06: every drop state stays publicly visible — sold-out and archived pages
-- stay up. What gates visibility is PUBLICATION, not state: an unpublished
-- drop must not leak through the anon key before its reveal.
create policy drops_public_read on public.drops
  for select to anon, authenticated
  using (published_at is not null and published_at <= now());

create policy products_public_read on public.products
  for select to anon, authenticated
  using (exists (
    select 1 from public.drops d
    where d.id = products.drop_id
      and d.published_at is not null and d.published_at <= now()
  ));

create policy product_images_public_read on public.product_images
  for select to anon, authenticated
  using (exists (
    select 1 from public.products p join public.drops d on d.id = p.drop_id
    where p.id = product_images.product_id
      and d.published_at is not null and d.published_at <= now()
  ));

create policy variants_public_read on public.variants
  for select to anon, authenticated
  using (exists (
    select 1 from public.products p join public.drops d on d.id = p.drop_id
    where p.id = variants.product_id
      and d.published_at is not null and d.published_at <= now()
  ));

-- §06: archived drops keep their PRICE HISTORY, and it is public.
create policy price_history_public_read on public.price_history
  for select to anon, authenticated
  using (exists (
    select 1 from public.products p join public.drops d on d.id = p.drop_id
    where p.id = price_history.product_id
      and d.published_at is not null and d.published_at <= now()
  ));

-- State events are an operational audit trail, not storefront content.
create policy drop_state_events_owner_read on public.drop_state_events
  for select to authenticated
  using (app.is_owner());

-- WRITES to the catalogue: owner only. Trone's 'layout' role gets no write
-- here — §12 gives layout access to pages and banners, not product listings.
create policy drops_owner_write on public.drops
  for all to authenticated using (app.is_owner()) with check (app.is_owner());
create policy products_owner_write on public.products
  for all to authenticated using (app.is_owner()) with check (app.is_owner());
create policy product_images_owner_write on public.product_images
  for all to authenticated using (app.is_owner()) with check (app.is_owner());
create policy variants_owner_write on public.variants
  for all to authenticated using (app.is_owner()) with check (app.is_owner());
create policy price_history_owner_write on public.price_history
  for all to authenticated using (app.is_owner()) with check (app.is_owner());

-- ---------------------------------------------------------------------------
-- Transactional tables (app schema) — deny by default.
--
-- No anon policy exists anywhere below, so the anon key reads NOTHING here
-- even if the schema were exposed. Writes are service-role only: the service
-- role bypasses RLS, and no policy grants write to anon or authenticated.
-- ---------------------------------------------------------------------------
alter table app.customers        enable row level security;
alter table app.reservations     enable row level security;
alter table app.waitlist_entries enable row level security;
alter table app.notify_requests  enable row level security;
alter table app.carts            enable row level security;
alter table app.cart_lines       enable row level security;
alter table app.orders           enable row level security;
alter table app.order_lines      enable row level security;
alter table app.payments         enable row level security;
alter table app.refunds          enable row level security;
alter table app.webhook_events   enable row level security;
alter table app.order_idempotency enable row level security;

-- A signed-in customer may READ their own records. Nothing more — not write.
create policy customers_self_read on app.customers
  for select to authenticated
  using (user_id = (select auth.uid()) or app.is_owner());

create policy reservations_self_read on app.reservations
  for select to authenticated
  using (customer_id = app.current_customer_id() or app.is_owner());

create policy orders_self_read on app.orders
  for select to authenticated
  using (customer_id = app.current_customer_id() or app.is_owner());

create policy order_lines_self_read on app.order_lines
  for select to authenticated
  using (exists (
    select 1 from app.orders o
    where o.id = order_lines.order_id
      and (o.customer_id = app.current_customer_id() or app.is_owner())
  ));

create policy waitlist_self_read on app.waitlist_entries
  for select to authenticated
  using (customer_id = app.current_customer_id() or app.is_owner());

-- §12: payments, refunds and the webhook ledger are PAYOUT data. Owner only —
-- Trone's layout role is excluded, and customers never read them directly.
create policy payments_owner_read on app.payments
  for select to authenticated using (app.is_owner());
create policy refunds_owner_read on app.refunds
  for select to authenticated using (app.is_owner());
create policy webhook_events_owner_read on app.webhook_events
  for select to authenticated using (app.is_owner());

create policy staff_self_read on app.staff
  for select to authenticated
  using (user_id = (select auth.uid()) or app.is_owner());

-- Deliberately NO policies on app.carts, app.cart_lines or
-- app.order_idempotency: they are server-only, reached with the service-role
-- key, and RLS-enabled with zero policies means deny-all for everyone else.
