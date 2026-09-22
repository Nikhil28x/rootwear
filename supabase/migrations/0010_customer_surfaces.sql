-- 0010 — Contact, saved addresses, and the drop-request demand signal.

-- §11: "Support channels: email and Instagram DM." The contact form is an
-- additional channel, and submissions are stored so nothing is lost in a inbox.
create table app.contact_submissions (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text not null,
  subject    text not null default '',
  message    text not null,
  -- Set when the sender was signed in, so admin can link it to their orders.
  customer_id uuid references app.customers(id) on delete set null,
  -- Lightweight spam signal; a filled honeypot is stored, never shown.
  is_spam    boolean not null default false,
  status     text not null default 'new'
               check (status in ('new', 'in_progress', 'closed')),
  created_at timestamptz not null default now()
);

create index contact_open_idx on app.contact_submissions (created_at desc)
  where status <> 'closed' and not is_spam;

-- §10 / §12 — saved addresses. India only, enforced at the column level as
-- well as at the form, per §10 "enforce at the address form AND at order
-- creation, not just in copy".
create table app.addresses (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references app.customers(id) on delete cascade,
  label        text not null default 'Home',
  name         text not null,
  line1        text not null,
  line2        text,
  city         text not null,
  state        text not null,
  pincode      text not null check (pincode ~ '^[1-9][0-9]{5}$'),
  phone        text not null check (phone ~ '^[6-9][0-9]{9}$'),
  country      text not null default 'IN' check (country = 'IN'),
  is_default   boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger addresses_touch before update on app.addresses
  for each row execute function app.touch_updated_at();

-- Exactly one default per customer.
create unique index addresses_one_default_idx on app.addresses (customer_id)
  where is_default;

-- ---------------------------------------------------------------------------
-- DROP REQUESTS — the demand board for archived drops.
--
-- A visitor browsing the archive can ask for a finished drop to come back.
-- No money is taken. Admin reads the counts to decide what to re-cut, which is
-- §12's "Demand board — the input to the next cut and to any re-drop".
-- ---------------------------------------------------------------------------
create table app.drop_requests (
  id          uuid primary key default gen_random_uuid(),
  drop_id     text not null references public.drops(id) on delete cascade,
  -- Size interest is the actionable part: "how many, and in what size".
  variant_id  text references public.variants(id) on delete set null,
  email       text not null,
  customer_id uuid references app.customers(id) on delete set null,
  note        text,
  -- §13: opt-in consent captured AND LOGGED at the point of signup.
  consented_at   timestamptz not null default now(),
  consent_source text not null default 'drop_archive',
  -- Set when this request is converted into a re-drop notification.
  fulfilled_at   timestamptz,
  created_at     timestamptz not null default now(),

  -- One request per person per drop-and-size. Re-submitting is idempotent.
  unique (drop_id, variant_id, email)
);

create index drop_requests_demand_idx on app.drop_requests (drop_id, variant_id)
  where fulfilled_at is null;

-- The demand board itself. §12: "notify-me and waitlist counts by size".
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
  count(distinct w.id)  filter (where w.state = 'waiting')     as waitlist
from public.drops d
join public.products p on p.drop_id = d.id
join public.variants v on v.product_id = p.id
left join app.drop_requests   dr on dr.drop_id = d.id and dr.variant_id = v.id
left join app.notify_requests nr on nr.variant_id = v.id
left join app.waitlist_entries w on w.variant_id = v.id
group by d.id, d.slug, d.name, d.state, v.id, v.size;

alter table app.contact_submissions enable row level security;
alter table app.addresses           enable row level security;
alter table app.drop_requests       enable row level security;

-- Customers manage their own addresses; staff never edit them silently.
create policy addresses_self_all on app.addresses
  for all to authenticated
  using (customer_id = app.current_customer_id())
  with check (customer_id = app.current_customer_id());

create policy addresses_owner_read on app.addresses
  for select to authenticated using (app.is_owner());

-- §12: contact submissions and demand are OWNER data. Trone's layout role is
-- excluded — these carry customer records.
create policy contact_owner_read on app.contact_submissions
  for select to authenticated using (app.is_owner());

create policy drop_requests_owner_read on app.drop_requests
  for select to authenticated using (app.is_owner());

create policy drop_requests_self_read on app.drop_requests
  for select to authenticated using (customer_id = app.current_customer_id());
