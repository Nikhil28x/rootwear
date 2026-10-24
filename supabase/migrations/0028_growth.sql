-- 0028 — Customers and growth: customer notes and consent, coupon details,
-- launch broadcasts, influencer seeding, and the daily digest opt-in.

-- ---------------------------------------------------------------------------
-- Customers: marketing consent and the team's own notes and tags.
-- ---------------------------------------------------------------------------
alter table app.customers
  add column if not exists marketing_email    boolean not null default false,
  add column if not exists marketing_whatsapp boolean not null default false,
  add column if not exists tags               text[] not null default '{}';

create table if not exists app.customer_notes (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references app.customers(id) on delete cascade,
  body         text not null check (length(trim(body)) > 0),
  author       text not null,
  created_at   timestamptz not null default now()
);
create index if not exists customer_notes_customer_idx on app.customer_notes (customer_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Coupons: what each one is for, and who it belongs to (an influencer's code).
-- ---------------------------------------------------------------------------
alter table app.coupons
  add column if not exists description text,
  add column if not exists created_by  text;

-- ---------------------------------------------------------------------------
-- Influencer seeding: pieces sent to creators, whether they posted, and what
-- their code and link sold.
-- ---------------------------------------------------------------------------
create table if not exists app.influencers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  handle      text not null unique,
  platform    text not null default 'instagram' check (platform in ('instagram', 'youtube', 'other')),
  followers   integer check (followers >= 0),
  email       text,
  phone       text,
  address     text,
  notes       text,
  created_at  timestamptz not null default now()
);

create table if not exists app.seedings (
  id             uuid primary key default gen_random_uuid(),
  influencer_id  uuid not null references app.influencers(id) on delete cascade,
  variant_id     text references public.variants(id) on delete set null,
  quantity       integer not null default 1 check (quantity > 0),
  status         text not null default 'planned'
                 check (status in ('planned', 'sent', 'posted', 'no_post')),
  courier_name   text,
  tracking_ref   text,
  sent_at        timestamptz,
  post_url       text,
  posted_at      timestamptz,
  coupon_id      uuid references app.coupons(id) on delete set null,
  utm_campaign   text,
  note           text,
  created_by     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists seedings_influencer_idx on app.seedings (influencer_id, created_at desc);
create trigger seedings_touch before update on app.seedings
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Broadcasts: one message to a chosen audience, by email and/or WhatsApp.
-- Each recipient is an outbox row with context ('broadcast', id), so the
-- broadcast's progress is read from the outbox itself.
-- ---------------------------------------------------------------------------
create table if not exists app.broadcasts (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  drop_id          text references public.drops(id) on delete set null,
  audiences        text[] not null,
  channels         text[] not null,
  email_template   text references app.message_templates(key) on delete set null,
  whatsapp_template text references app.message_templates(key) on delete set null,
  status           text not null default 'draft' check (status in ('draft', 'sending', 'sent')),
  recipients       integer not null default 0,
  created_by       text,
  created_at       timestamptz not null default now(),
  sent_at          timestamptz
);

-- ---------------------------------------------------------------------------
-- The daily digest: who gets it.
-- ---------------------------------------------------------------------------
alter table app.staff add column if not exists daily_digest boolean not null default false;

alter table app.customer_notes enable row level security;
alter table app.influencers    enable row level security;
alter table app.seedings       enable row level security;
alter table app.broadcasts     enable row level security;
create policy customer_notes_staff_read on app.customer_notes
  for select to authenticated using (app.has_permission('customers.view'));
create policy influencers_staff_read on app.influencers
  for select to authenticated using (app.has_permission('marketing.edit'));
create policy seedings_staff_read on app.seedings
  for select to authenticated using (app.has_permission('marketing.edit'));
create policy broadcasts_staff_read on app.broadcasts
  for select to authenticated using (app.has_permission('marketing.edit'));

grant all on app.customer_notes, app.influencers, app.seedings, app.broadcasts to service_role;

-- A free-form broadcast message, alongside the built-in "drop is live".
insert into app.message_templates (key, name, channel, purpose, description, subject, body, wa_template_name, wa_params, system)
values
  ('broadcast_email', 'Broadcast', 'email', 'marketing',
   'A one-off message written in Broadcasts.', '{{subject}}', E'Hi {{name}},\n\n{{message}}\n\nRootwear', null, '{}', true),
  ('broadcast_whatsapp', 'Broadcast', 'whatsapp', 'marketing',
   'A one-off message written in Broadcasts. Meta must approve the template it uses.',
   null, E'Hi {{name}}, {{message}}', 'broadcast', array['name', 'message'], true)
on conflict (key) do nothing;
