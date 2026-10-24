-- 0023 — Messaging: templates and an outbox for email and WhatsApp.
--
-- Every customer message goes through app.message_outbox. Nothing calls a
-- provider directly from a request handler and forgets about it: the row is
-- written first, then sent, so a provider outage leaves a queued row that the
-- cron retries rather than a message that silently never happened.
--
-- Templates are editable from /admin/messages. WhatsApp templates must ALSO be
-- approved by Meta under the same name; the body stored here is the preview
-- and the source of the ordered parameters, not what Meta sends.

create table if not exists app.message_templates (
  key               text primary key,
  name              text not null,
  channel           text not null check (channel in ('email', 'whatsapp')),
  -- 'transactional' may be sent to anyone with an order; 'marketing' only to
  -- people who opted in (§13 consent).
  purpose           text not null default 'transactional'
                    check (purpose in ('transactional', 'marketing')),
  description       text not null default '',
  subject           text,
  body              text not null,
  -- WhatsApp only: the approved template's name and language, and the order
  -- in which variables fill {{1}}, {{2}}, ... in Meta's copy.
  wa_template_name  text,
  wa_language       text not null default 'en',
  wa_params         text[] not null default '{}',
  active            boolean not null default true,
  -- Built-in templates are referenced by code and cannot be deleted.
  system            boolean not null default false,
  updated_at        timestamptz not null default now(),
  updated_by        text
);

create trigger message_templates_touch before update on app.message_templates
  for each row execute function app.touch_updated_at();

do $$ begin
  create type app.outbox_status as enum
    ('queued', 'sending', 'sent', 'delivered', 'read', 'failed', 'cancelled', 'skipped');
exception when duplicate_object then null; end $$;

create table if not exists app.message_outbox (
  id                   uuid primary key default gen_random_uuid(),
  channel              text not null check (channel in ('email', 'whatsapp')),
  purpose              text not null default 'transactional'
                       check (purpose in ('transactional', 'marketing')),
  recipient            text not null,
  recipient_name       text,
  template_key         text references app.message_templates(key) on delete set null,
  -- Rendered at enqueue so the log shows exactly what was sent, even if the
  -- template is edited afterwards.
  subject              text,
  body                 text not null,
  variables            jsonb not null default '{}'::jsonb,
  status               app.outbox_status not null default 'queued',
  attempts             integer not null default 0,
  max_attempts         integer not null default 5,
  next_attempt_at      timestamptz not null default now(),
  last_error           text,
  provider             text,
  provider_message_id  text,
  -- What this message is about, for the timeline on that record.
  context_type         text,
  context_id           text,
  created_by           text,
  created_at           timestamptz not null default now(),
  sent_at              timestamptz,
  delivered_at         timestamptz,
  read_at              timestamptz
);

create index if not exists message_outbox_due_idx
  on app.message_outbox (next_attempt_at) where status = 'queued';
create index if not exists message_outbox_context_idx
  on app.message_outbox (context_type, context_id, created_at desc);
create index if not exists message_outbox_recent_idx
  on app.message_outbox (created_at desc);
create index if not exists message_outbox_provider_idx
  on app.message_outbox (provider_message_id) where provider_message_id is not null;

-- Claims due rows for sending. SKIP LOCKED lets two cron runs overlap without
-- sending the same message twice.
create or replace function app.claim_outbox(p_limit integer default 20)
returns setof app.message_outbox
language sql
security definer
set search_path = app, public, pg_temp
as $$
  update app.message_outbox o
     set status = 'sending', attempts = o.attempts + 1
   where o.id in (
     select id from app.message_outbox
      where status = 'queued' and next_attempt_at <= now()
      order by next_attempt_at
      limit p_limit
      for update skip locked
   )
  returning o.*;
$$;

-- A row stuck in 'sending' (the process died mid-send) goes back to the queue
-- after ten minutes rather than staying stuck forever.
create or replace function app.requeue_stuck_outbox()
returns integer
language sql
security definer
set search_path = app, public, pg_temp
as $$
  with moved as (
    update app.message_outbox
       set status = 'queued', next_attempt_at = now()
     where status = 'sending'
       and coalesce(sent_at, created_at) < now() - interval '10 minutes'
       and attempts < max_attempts
    returning 1
  )
  select count(*)::integer from moved;
$$;

revoke all on function app.claim_outbox(integer) from public, anon, authenticated;
revoke all on function app.requeue_stuck_outbox() from public, anon, authenticated;
grant execute on function app.claim_outbox(integer) to service_role;
grant execute on function app.requeue_stuck_outbox() to service_role;

alter table app.message_templates enable row level security;
alter table app.message_outbox    enable row level security;
create policy message_templates_staff_read on app.message_templates
  for select to authenticated using (app.has_permission('messages.view'));
create policy message_outbox_staff_read on app.message_outbox
  for select to authenticated using (app.has_permission('messages.view'));

-- ---------------------------------------------------------------------------
-- Built-in templates. {{name}} placeholders are filled at enqueue; the email
-- body is plain text with blank-line paragraphs, wrapped in the house layout.
-- ---------------------------------------------------------------------------
insert into app.message_templates
  (key, name, channel, purpose, description, subject, body, wa_template_name, wa_params, system)
values
  ('order_confirmed_email', 'Order confirmed', 'email', 'transactional',
   'Sent when payment is captured.',
   'Order {{order_number}} confirmed',
   E'Hi {{name}},\n\nThanks for your order. We have your payment of {{total}} and your piece is being prepared.\n\nOrder: {{order_number}}\nTrack it any time: {{order_url}}\n\nWe will write again when it ships.\n\nRootwear',
   null, '{}', true),
  ('order_confirmed_whatsapp', 'Order confirmed', 'whatsapp', 'transactional',
   'Sent when payment is captured.',
   null,
   E'Hi {{name}}, your Rootwear order {{order_number}} is confirmed. Total paid: {{total}}. Track it here: {{order_url}}',
   'order_confirmed', array['name', 'order_number', 'total', 'order_url'], true),
  ('order_dispatched_email', 'Order dispatched', 'email', 'transactional',
   'Sent when an order is marked dispatched.',
   'Order {{order_number}} is on its way',
   E'Hi {{name}},\n\nYour order {{order_number}} has left us with {{courier}}.\n\nTracking reference: {{tracking_ref}}\nOrder page: {{order_url}}\n\nRootwear',
   null, '{}', true),
  ('order_dispatched_whatsapp', 'Order dispatched', 'whatsapp', 'transactional',
   'Sent when an order is marked dispatched.',
   null,
   E'Hi {{name}}, your Rootwear order {{order_number}} has shipped with {{courier}}. Tracking: {{tracking_ref}}. Details: {{order_url}}',
   'order_dispatched', array['name', 'order_number', 'courier', 'tracking_ref', 'order_url'], true),
  ('order_delivered_email', 'Order delivered', 'email', 'transactional',
   'Sent when an order is marked delivered.',
   'Order {{order_number}} delivered',
   E'Hi {{name}},\n\nOur records show order {{order_number}} has been delivered. If anything is wrong with it, reply to this email.\n\nRootwear',
   null, '{}', true),
  ('balance_due_email', 'Balance due', 'email', 'transactional',
   'Sent when a pre-order balance is requested.',
   'Your balance for {{drop_name}} is due',
   E'Hi {{name}},\n\nYour piece from {{drop_name}} is ready. The balance of {{balance}} is due by {{due_by}}.\n\nPay here: {{pay_url}}\n\nRootwear',
   null, '{}', true),
  ('balance_due_whatsapp', 'Balance due', 'whatsapp', 'transactional',
   'Sent when a pre-order balance is requested.',
   null,
   E'Hi {{name}}, your {{drop_name}} piece is ready. Balance of {{balance}} is due by {{due_by}}. Pay here: {{pay_url}}',
   'balance_due', array['name', 'drop_name', 'balance', 'due_by', 'pay_url'], true),
  ('refund_issued_email', 'Refund issued', 'email', 'transactional',
   'Sent when a refund is processed.',
   'Refund of {{amount}} for order {{order_number}}',
   E'Hi {{name}},\n\nWe have refunded {{amount}} for order {{order_number}}. Banks usually take 5–7 working days to show it.\n\nRootwear',
   null, '{}', true),
  ('cart_recovery_email', 'Cart reminder', 'email', 'marketing',
   'Sent to a checkout that was started but not paid.',
   'Your {{drop_name}} piece is still in your cart',
   E'Hi {{name}},\n\nYou left {{items}} in your cart. Editions are small and pieces are not held for long.\n\nFinish your order: {{cart_url}}\n\nRootwear',
   null, '{}', true),
  ('cart_recovery_whatsapp', 'Cart reminder', 'whatsapp', 'marketing',
   'Sent to a checkout that was started but not paid.',
   null,
   E'Hi {{name}}, you left {{items}} in your Rootwear cart. Finish your order here: {{cart_url}}',
   'cart_reminder', array['name', 'items', 'cart_url'], true),
  ('drop_live_email', 'Drop is live', 'email', 'marketing',
   'Sent to the waitlist and notify-me list when a drop opens.',
   '{{drop_name}} is live',
   E'Hi {{name}},\n\n{{drop_name}} is open now. You asked to hear first.\n\nShop the drop: {{drop_url}}\n\nRootwear',
   null, '{}', true),
  ('drop_live_whatsapp', 'Drop is live', 'whatsapp', 'marketing',
   'Sent to the waitlist and notify-me list when a drop opens.',
   null,
   E'Hi {{name}}, {{drop_name}} is live now. Shop it here: {{drop_url}}',
   'drop_live', array['name', 'drop_name', 'drop_url'], true),
  ('staff_invite_email', 'Staff invitation', 'email', 'transactional',
   'Sent when someone is added to the team.',
   'You have been added to Rootwear admin',
   E'Hi {{name}},\n\n{{invited_by}} added you to the Rootwear admin. They will send you a temporary password separately — it is never sent by email.\n\nSign in: {{login_url}}\n\nChange the password after you sign in, from Your account.',
   null, '{}', true),
  ('daily_digest_email', 'Daily digest', 'email', 'transactional',
   'The morning summary sent to staff.',
   'Rootwear today: {{headline}}',
   E'{{summary}}',
   null, '{}', true)
on conflict (key) do nothing;

grant all on app.message_templates, app.message_outbox to service_role;
