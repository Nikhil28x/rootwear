-- 0017 — Pre-order interest.
--
-- A pre-order SIGNUP is not a §08 reservation: no money changes hands, no
-- piece number is allocated, nothing is held. It records that a named person
-- wants a given size when the drop opens, which is what the storefront's
-- pre-order mode collects.
--
-- Kept separate from app.reservations deliberately. A reservation is a
-- financial record with a locked price and a cancellation rule attached; a
-- signup is a lead. Collapsing the two would make the §12 pre-order ledger
-- report a number that has no money behind it.

create table app.preorder_signups (
  id          uuid primary key default gen_random_uuid(),
  drop_id     text not null references public.drops(id) on delete cascade,
  variant_id  text not null references public.variants(id) on delete restrict,

  name        text not null check (length(btrim(name)) between 2 and 120),
  email       text not null,
  -- §10 India: ten digits, starting 6-9. Same rule as the address form, so a
  -- signup can become an order without re-validating.
  phone       text not null check (phone ~ '^[6-9][0-9]{9}$'),

  -- Set when the person was signed in, so admin can link it to their account.
  customer_id uuid references app.customers(id) on delete set null,

  -- §13: opt-in consent captured AND LOGGED at the point of signup.
  consented_at   timestamptz not null default now(),
  consent_source text not null default 'drop_preorder',

  -- Set when this signup is converted into a real reservation or order.
  converted_at timestamptz,

  created_at  timestamptz not null default now(),

  -- One signup per person per size. Re-submitting is idempotent rather than a
  -- second row inflating the count admin reads.
  unique (variant_id, email)
);

create index preorder_open_idx on app.preorder_signups (drop_id, variant_id)
  where converted_at is null;

alter table app.preorder_signups enable row level security;

-- §12: this carries customer records, so it is owner-only. Trone's layout role
-- is excluded, and no anon policy exists at all.
create policy preorder_owner_read on app.preorder_signups
  for select to authenticated using (app.is_owner());

create policy preorder_self_read on app.preorder_signups
  for select to authenticated using (customer_id = app.current_customer_id());

-- Extend the demand board so admin reads signups beside requests and waitlist,
-- rather than having a second screen for the same question.
drop view if exists app.demand_board;

create view app.demand_board as
select
  d.id            as drop_id,
  d.slug          as drop_slug,
  d.name          as drop_name,
  d.state         as drop_state,
  v.id            as variant_id,
  v.size          as size,
  count(distinct dr.id) filter (where dr.fulfilled_at is null) as requests,
  count(distinct nr.id) filter (where nr.notified_at is null)  as notify_me,
  count(distinct w.id)  filter (where w.state = 'waiting')     as waitlist,
  count(distinct ps.id) filter (where ps.converted_at is null) as preorder_signups
from public.drops d
join public.products p on p.drop_id = d.id
join public.variants v on v.product_id = p.id
left join app.drop_requests    dr on dr.drop_id = d.id and dr.variant_id = v.id
left join app.notify_requests  nr on nr.variant_id = v.id
left join app.waitlist_entries w  on w.variant_id = v.id
left join app.preorder_signups ps on ps.variant_id = v.id
group by d.id, d.slug, d.name, d.state, v.id, v.size;
