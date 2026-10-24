-- 0025 — Orders for the CMS: notes, invoices and credit notes, returns,
-- refunds with a reason and an author, fulfilment timestamps.

-- ---------------------------------------------------------------------------
-- Fulfilment timestamps, so the order timeline can say when each step was.
-- ---------------------------------------------------------------------------
alter table app.orders
  add column if not exists packed_at     timestamptz,
  add column if not exists cancelled_at  timestamptz,
  add column if not exists cancel_reason text;

-- ---------------------------------------------------------------------------
-- Internal notes on an order. Never shown to the customer.
-- ---------------------------------------------------------------------------
create table if not exists app.order_notes (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references app.orders(id) on delete cascade,
  body        text not null check (length(trim(body)) > 0),
  author      text not null,
  created_at  timestamptz not null default now()
);
create index if not exists order_notes_order_idx on app.order_notes (order_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Refunds: who issued them, why, and the option of a return as the reason.
-- ---------------------------------------------------------------------------
alter table app.refunds drop constraint if exists refunds_reason_check;
alter table app.refunds
  add constraint refunds_reason_check
  check (reason in ('cap_race', 'cancellation', 'defect', 'admin', 'return', 'goodwill'));
alter table app.refunds
  add column if not exists note       text,
  add column if not exists created_by text;

-- ---------------------------------------------------------------------------
-- Document numbers: one gapless series per kind per financial year
-- (April to March), e.g. RW/26-27/0001 and RW/CN/26-27/0001. The counter
-- row is locked while the next number is taken, so two invoices issued at
-- the same moment never share a number.
-- ---------------------------------------------------------------------------
create table if not exists app.document_sequences (
  series  text primary key,
  last    integer not null default 0
);

create or replace function app.next_document_number(p_series text)
returns integer
language plpgsql
security definer
set search_path = app, public, pg_temp
as $$
declare
  v_next integer;
begin
  insert into app.document_sequences (series, last) values (p_series, 1)
  on conflict (series) do update set last = app.document_sequences.last + 1
  returning last into v_next;
  return v_next;
end;
$$;

revoke all on function app.next_document_number(text) from public, anon, authenticated;
grant execute on function app.next_document_number(text) to service_role;

-- ---------------------------------------------------------------------------
-- Invoices and credit notes. Frozen at issue: the seller, buyer, lines and
-- totals are stored as they were, so a reprint next year shows the same
-- document even if the business address or a product's name changes.
-- ---------------------------------------------------------------------------
create table if not exists app.invoices (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references app.orders(id) on delete restrict,
  kind            text not null check (kind in ('invoice', 'credit_note')),
  number          text not null unique,
  refund_id       uuid references app.refunds(id) on delete restrict,
  issued_at       timestamptz not null default now(),
  gst_registered  boolean not null,
  seller          jsonb not null,
  buyer           jsonb not null,
  lines           jsonb not null,
  totals          jsonb not null,
  created_by      text
);

create unique index if not exists invoices_one_per_order
  on app.invoices (order_id) where kind = 'invoice';
create unique index if not exists credit_notes_one_per_refund
  on app.invoices (refund_id) where kind = 'credit_note';
create index if not exists invoices_issued_idx on app.invoices (issued_at desc);

-- ---------------------------------------------------------------------------
-- Returns and exchanges. §returns: defects only, so every return carries a
-- reason; an exchange records the size sent back out.
-- ---------------------------------------------------------------------------
create table if not exists app.returns (
  id                   uuid primary key default gen_random_uuid(),
  order_id             uuid not null references app.orders(id) on delete restrict,
  -- [{ "order_line_id": "...", "quantity": 1 }]
  lines                jsonb not null,
  reason               text not null check (reason in
                       ('defect', 'wrong_item', 'damaged_in_transit', 'size_exchange', 'other')),
  detail               text,
  outcome              text not null check (outcome in ('refund', 'exchange', 'repair', 'none')),
  status               text not null default 'requested'
                       check (status in ('requested', 'received', 'completed', 'rejected')),
  exchange_variant_id  text references public.variants(id) on delete restrict,
  refund_id            uuid references app.refunds(id) on delete set null,
  restocked            boolean not null default false,
  courier_name         text,
  tracking_ref         text,
  created_by           text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists returns_order_idx on app.returns (order_id);
create index if not exists returns_open_idx on app.returns (status) where status in ('requested', 'received');

create trigger returns_touch before update on app.returns
  for each row execute function app.touch_updated_at();

alter table app.order_notes        enable row level security;
alter table app.document_sequences enable row level security;
alter table app.invoices           enable row level security;
alter table app.returns            enable row level security;

create policy order_notes_staff_read on app.order_notes
  for select to authenticated using (app.has_permission('orders.view'));
create policy invoices_staff_read on app.invoices
  for select to authenticated using (app.has_permission('finance.view') or app.has_permission('orders.view'));
create policy invoices_self_read on app.invoices
  for select to authenticated
  using (exists (select 1 from app.orders o where o.id = invoices.order_id and o.customer_id = app.current_customer_id()));
create policy returns_staff_read on app.returns
  for select to authenticated using (app.has_permission('orders.view'));

grant all on app.order_notes, app.document_sequences, app.invoices, app.returns to service_role;
