-- 0026 — Abandoned checkout recovery.
--
-- A cart has no name or contact until the shopper submits the checkout
-- form, which creates a pending_payment order. That order, unpaid and then
-- expired, is the abandoned checkout we can follow up. One row here per
-- order followed up: when the reminder went, when its link was opened, and
-- the order it turned into.

create table if not exists app.checkout_recovery (
  order_id            uuid primary key references app.orders(id) on delete cascade,
  sent_at             timestamptz,
  sent_by             text,
  channels            text[] not null default '{}',
  clicked_at          timestamptz,
  recovered_order_id  uuid references app.orders(id) on delete set null,
  dismissed_at        timestamptz,
  created_at          timestamptz not null default now()
);

create index if not exists orders_customer_created_idx on app.orders (customer_id, created_at desc);
create index if not exists carts_created_idx on app.carts (created_at desc);

alter table app.checkout_recovery enable row level security;
create policy checkout_recovery_staff_read on app.checkout_recovery
  for select to authenticated using (app.has_permission('carts.view'));

grant all on app.checkout_recovery to service_role;
