-- 0027 — Leads: one pipeline for every place a customer can come from.
--
-- Website forms create leads automatically; Instagram DMs are added by hand;
-- Meta lead ads and inbound WhatsApp messages arrive through the Meta
-- webhook. A lead is matched to an order by email or phone and marked won
-- when they pay. UTM tags captured on landing ride along on leads and
-- orders, so a campaign's revenue can be counted.

create table if not exists app.leads (
  id                 uuid primary key default gen_random_uuid(),
  name               text,
  email              text,
  phone              text,
  instagram          text,
  source             text not null check (source in
                     ('website', 'instagram', 'whatsapp', 'meta_ads', 'referral', 'event', 'other')),
  -- What exactly: the form ('notify_me'), the ad, the event's name.
  source_detail      text,
  stage              text not null default 'new' check (stage in
                     ('new', 'contacted', 'interested', 'won', 'lost')),
  owner              text,
  interest           text,
  drop_id            text references public.drops(id) on delete set null,
  next_follow_up_at  timestamptz,
  last_contacted_at  timestamptz,
  -- WhatsApp's 24-hour window opens with the customer's last message.
  last_inbound_at    timestamptz,
  utm                jsonb not null default '{}'::jsonb,
  customer_id        uuid references app.customers(id) on delete set null,
  won_order_id       uuid references app.orders(id) on delete set null,
  lost_reason        text,
  consent_email      boolean not null default false,
  consent_whatsapp   boolean not null default false,
  -- Where it came from in the other system, so a redelivery is not a second lead.
  external_id        text unique,
  created_by         text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint leads_reachable check (email is not null or phone is not null or instagram is not null)
);

create index if not exists leads_stage_idx on app.leads (stage, updated_at desc);
create index if not exists leads_email_idx on app.leads (lower(email));
create index if not exists leads_phone_idx on app.leads (phone);
create index if not exists leads_follow_up_idx on app.leads (next_follow_up_at) where stage not in ('won', 'lost');

create trigger leads_touch before update on app.leads
  for each row execute function app.touch_updated_at();

create table if not exists app.lead_activities (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references app.leads(id) on delete cascade,
  kind        text not null check (kind in
              ('created', 'note', 'call', 'message_in', 'message_out', 'stage', 'assigned', 'form', 'order', 'follow_up')),
  body        text,
  meta        jsonb not null default '{}'::jsonb,
  actor       text,
  created_at  timestamptz not null default now()
);
create index if not exists lead_activities_lead_idx on app.lead_activities (lead_id, created_at desc);

-- Where an order came from: the UTM tags and referrer seen when the
-- shopper first and last landed (from the rw_touch cookie).
alter table app.orders add column if not exists attribution jsonb not null default '{}'::jsonb;

alter table app.leads           enable row level security;
alter table app.lead_activities enable row level security;
create policy leads_staff_read on app.leads
  for select to authenticated using (app.has_permission('leads.view'));
create policy lead_activities_staff_read on app.lead_activities
  for select to authenticated using (app.has_permission('leads.view'));

grant all on app.leads, app.lead_activities to service_role;

-- A free-form email from a lead's page uses this template.
insert into app.message_templates (key, name, channel, purpose, description, subject, body, system)
values ('direct_email', 'Direct email', 'email', 'transactional',
        'A message written by staff on a lead or customer page.',
        '{{subject}}', E'{{message}}', true)
on conflict (key) do nothing;

-- Every form already received becomes a lead, once.
insert into app.leads (name, email, phone, source, source_detail, drop_id, external_id, created_at, consent_email)
select f.name, nullif(lower(f.email), ''), f.phone, 'website', f.kind, f.drop_id, f.tracking_id, f.created_at,
       f.kind in ('notify_me', 'preorder', 'drop_request')
  from app.form_submissions f
 where f.tracking_id is not null and not f.is_spam
on conflict (external_id) do nothing;

insert into app.lead_activities (lead_id, kind, body, created_at)
select l.id, 'form', coalesce(f.subject, f.kind) || coalesce(': ' || f.detail, ''), f.created_at
  from app.leads l join app.form_submissions f on f.tracking_id = l.external_id
 where not exists (select 1 from app.lead_activities a where a.lead_id = l.id);
