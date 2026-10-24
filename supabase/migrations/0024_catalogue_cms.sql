-- 0024 — Catalogue for the CMS: editable sizes, colourways, several products
-- per drop, draft products, size charts, stock movements, tax fields.
--
-- §09 began with one axis (XS–XL) and no colour, deliberately, for Drop 01.
-- Later drops need XXL and up, colourways and more than one piece per drop,
-- so the axis is now data the owner edits rather than an enum in a migration.
-- Drop 01's rows are unchanged: same sizes, no colourway, same SKUs.

-- ---------------------------------------------------------------------------
-- Sizes: a shared list the product editor picks from, in display order.
-- ---------------------------------------------------------------------------
create table if not exists public.sizes (
  code        text primary key check (code ~ '^[A-Z0-9]{1,5}$'),
  label       text not null,
  sort_order  integer not null,
  created_at  timestamptz not null default now()
);

insert into public.sizes (code, label, sort_order) values
  ('XXS', 'XXS', 10), ('XS', 'XS', 20), ('S', 'S', 30), ('M', 'M', 40),
  ('L', 'L', 50), ('XL', 'XL', 60), ('XXL', 'XXL', 70), ('3XL', '3XL', 80),
  ('4XL', '4XL', 90), ('5XL', '5XL', 100), ('OS', 'One size', 200)
on conflict (code) do nothing;

alter table public.sizes enable row level security;
create policy sizes_public_read on public.sizes for select to anon, authenticated using (true);
create policy sizes_owner_write on public.sizes
  for all to authenticated using (app.is_owner()) with check (app.is_owner());

-- The enum becomes text constrained by the sizes table. demand_board reads
-- variants.size, so it is dropped and recreated around the type change.
drop view if exists app.demand_board;

alter table public.variants alter column size type text using size::text;
alter table public.variants
  add constraint variants_size_fkey foreign key (size) references public.sizes(code) on update cascade;

alter table public.products alter column model_worn_size type text using model_worn_size::text;
alter table public.products
  add constraint products_model_size_fkey foreign key (model_worn_size) references public.sizes(code) on update cascade;

drop type if exists public.garment_size;

-- ---------------------------------------------------------------------------
-- Colourways: optional per product. A product with none behaves as before.
-- ---------------------------------------------------------------------------
create table if not exists public.colourways (
  id          text primary key,
  product_id  text not null references public.products(id) on delete cascade,
  name        text not null,
  -- Two to four letters, used in the SKU: RW-D02-TEE-BLK-XL.
  code        text not null check (code ~ '^[A-Z]{2,4}$'),
  swatch      text check (swatch is null or swatch ~ '^#[0-9a-fA-F]{6}$'),
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (product_id, code)
);

create index if not exists colourways_product_idx on public.colourways (product_id, position);

alter table public.colourways enable row level security;
create policy colourways_public_read on public.colourways
  for select to anon, authenticated
  using (exists (
    select 1 from public.products p join public.drops d on d.id = p.drop_id
     where p.id = colourways.product_id and d.published_at is not null
  ));
create policy colourways_owner_write on public.colourways
  for all to authenticated using (app.is_owner()) with check (app.is_owner());

alter table public.variants add column if not exists colourway_id text
  references public.colourways(id) on delete restrict;

-- One variant per (product, colour, size); "no colour" counts as one colour.
alter table public.variants drop constraint if exists variants_product_id_size_key;
create unique index if not exists variants_product_colour_size_idx
  on public.variants (product_id, coalesce(colourway_id, ''), size);

alter table public.product_images add column if not exists colourway_id text
  references public.colourways(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Products: draft/active/archived, order within the drop, size chart, tax.
-- ---------------------------------------------------------------------------
alter table public.products
  add column if not exists status      text not null default 'active'
                                       check (status in ('draft', 'active', 'archived')),
  add column if not exists position    integer not null default 0,
  -- [{ "size": "M", "chest_cm": 116, "length_cm": 72 }, ...]
  add column if not exists size_chart  jsonb not null default '[]'::jsonb,
  add column if not exists fit_note    text,
  -- The style part of the SKU: RW-D01-TEE-M (§09 convention).
  add column if not exists style_code  text check (style_code is null or style_code ~ '^[A-Z]{2,5}$'),
  -- GST: HSN 6109 is knitted T-shirts. Rates are stored per product because
  -- apparel GST depends on the selling price.
  add column if not exists hsn_code    text not null default '6109',
  add column if not exists gst_rate    numeric(5,2) not null default 5
                                       check (gst_rate >= 0 and gst_rate <= 28);

update public.products set style_code = 'TEE' where id = 'product-01-tee' and style_code is null;

-- Drop 01's size chart, so the guide reads from the record from now on.
update public.products
   set size_chart = '[{"size":"XS","chest_cm":104,"length_cm":68},{"size":"S","chest_cm":110,"length_cm":70},{"size":"M","chest_cm":116,"length_cm":72},{"size":"L","chest_cm":122,"length_cm":74},{"size":"XL","chest_cm":128,"length_cm":76}]'::jsonb
 where id = 'product-01-tee' and size_chart = '[]'::jsonb;

-- ---------------------------------------------------------------------------
-- Drops: a secret link for previewing an unpublished drop on the storefront.
-- ---------------------------------------------------------------------------
alter table public.drops add column if not exists preview_token text unique;

-- ---------------------------------------------------------------------------
-- Stock movements: every manual change to stock, with a reason. Sales are
-- read from order lines; this is the record of everything else.
-- ---------------------------------------------------------------------------
create table if not exists app.stock_movements (
  id           uuid primary key default gen_random_uuid(),
  variant_id   text not null references public.variants(id) on delete cascade,
  delta        integer not null,
  stock_after  integer not null,
  reason       text not null check (reason in
               ('initial', 'restock', 'correction', 'damaged', 'sample', 'gifted', 'returned', 'cancelled')),
  note         text,
  actor        text,
  created_at   timestamptz not null default now()
);

create index if not exists stock_movements_variant_idx
  on app.stock_movements (variant_id, created_at desc);

alter table app.stock_movements enable row level security;
create policy stock_movements_staff_read on app.stock_movements
  for select to authenticated using (app.has_permission('catalogue.view'));

-- Applies a stock change atomically and records it. The row is locked so a
-- sale committing at the same moment cannot be lost under the adjustment.
create or replace function app.adjust_stock(
  p_variant_id text,
  p_delta      integer,
  p_reason     text,
  p_note       text,
  p_actor      text
)
returns integer
language plpgsql
security definer
set search_path = app, public, pg_temp
as $$
declare
  v_stock    integer;
  v_reserved integer;
begin
  select stock_count, reserved_count into v_stock, v_reserved
    from public.variants where id = p_variant_id for update;
  if not found then
    raise exception 'No such variant %', p_variant_id using errcode = 'P0002';
  end if;

  if v_stock + p_delta < v_reserved then
    raise exception 'Stock cannot go below the % pieces already reserved.', v_reserved
      using errcode = 'P0001';
  end if;

  update public.variants set stock_count = v_stock + p_delta where id = p_variant_id;

  insert into app.stock_movements (variant_id, delta, stock_after, reason, note, actor)
  values (p_variant_id, p_delta, v_stock + p_delta, p_reason, p_note, p_actor);

  return v_stock + p_delta;
end;
$$;

revoke all on function app.adjust_stock(text, integer, text, text, text) from public, anon, authenticated;
grant execute on function app.adjust_stock(text, integer, text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Order lines remember the colour, size and tax treatment as sold, so an
-- invoice reprinted next year still says what was bought and at what rate.
-- Filled by trigger so app.commit_order needs no change.
-- ---------------------------------------------------------------------------
alter table app.order_lines
  add column if not exists variant_snapshot text,
  add column if not exists hsn_snapshot     text,
  add column if not exists gst_rate_snapshot numeric(5,2);

create or replace function app.snapshot_order_line()
returns trigger
language plpgsql
set search_path = app, public, pg_temp
as $$
begin
  select concat_ws(' / ', c.name, v.size), p.hsn_code, p.gst_rate
    into new.variant_snapshot, new.hsn_snapshot, new.gst_rate_snapshot
    from public.variants v
    join public.products p on p.id = v.product_id
    left join public.colourways c on c.id = v.colourway_id
   where v.id = new.variant_id;
  return new;
end;
$$;

drop trigger if exists order_lines_snapshot on app.order_lines;
create trigger order_lines_snapshot before insert on app.order_lines
  for each row execute function app.snapshot_order_line();

update app.order_lines ol
   set variant_snapshot = v.size, hsn_snapshot = p.hsn_code, gst_rate_snapshot = p.gst_rate
  from public.variants v join public.products p on p.id = v.product_id
 where v.id = ol.variant_id and ol.variant_snapshot is null;

-- ---------------------------------------------------------------------------
-- demand_board, as in 0017, now carrying the colourway.
-- ---------------------------------------------------------------------------
create view app.demand_board as
select
  d.id            as drop_id,
  d.slug          as drop_slug,
  d.name          as drop_name,
  d.state         as drop_state,
  v.id            as variant_id,
  v.size          as size,
  c.name          as colourway,
  count(distinct dr.id) filter (where dr.fulfilled_at is null) as requests,
  count(distinct nr.id) filter (where nr.notified_at is null)  as notify_me,
  count(distinct w.id)  filter (where w.state = 'waiting')     as waitlist,
  count(distinct ps.id) filter (where ps.converted_at is null) as preorder_signups
from public.drops d
join public.products p on p.drop_id = d.id
join public.variants v on v.product_id = p.id
left join public.colourways c on c.id = v.colourway_id
left join app.drop_requests    dr on dr.drop_id = d.id and dr.variant_id = v.id
left join app.notify_requests  nr on nr.variant_id = v.id
left join app.waitlist_entries w  on w.variant_id = v.id
left join app.preorder_signups ps on ps.variant_id = v.id
group by d.id, d.slug, d.name, d.state, v.id, v.size, c.name;

-- ---------------------------------------------------------------------------
-- Image storage. Supabase keeps buckets in storage.buckets; the guard lets
-- this migration run on a plain Postgres (the test cluster) too.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public)
    values ('catalogue', 'catalogue', true)
    on conflict (id) do nothing;
  end if;
end $$;

grant all on public.sizes, public.colourways to service_role;
grant select on public.sizes, public.colourways to anon, authenticated;
grant all on app.stock_movements to service_role;
grant select on app.demand_board to service_role;
