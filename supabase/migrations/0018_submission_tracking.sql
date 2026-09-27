-- 0018 — A human-facing receipt for every customer lead form.
--
-- The underlying records remain in their purpose-built tables so demand,
-- contact workflow and consent history keep their existing constraints. This
-- migration gives each record one immutable Rootwear reference and exposes a
-- read-only owner inbox that brings the four form types together.

create sequence if not exists app.submission_tracking_seq;

create or replace function app.next_submission_tracking_id(p_prefix text)
returns text
language sql
volatile
set search_path = app, public, pg_temp
as $$
  select 'RW-' || upper(regexp_replace(p_prefix, '[^A-Za-z0-9]', '', 'g')) || '-' ||
         lpad(nextval('app.submission_tracking_seq')::text, 7, '0');
$$;

revoke all on function app.next_submission_tracking_id(text) from public, anon, authenticated;
grant execute on function app.next_submission_tracking_id(text) to service_role;
grant usage, select on sequence app.submission_tracking_seq to service_role;

alter table app.contact_submissions add column if not exists tracking_id text;
alter table app.drop_requests       add column if not exists tracking_id text;
alter table app.notify_requests     add column if not exists tracking_id text;
alter table app.preorder_signups    add column if not exists tracking_id text;

update app.contact_submissions
set tracking_id = app.next_submission_tracking_id('CON')
where tracking_id is null;

update app.drop_requests
set tracking_id = app.next_submission_tracking_id('REQ')
where tracking_id is null;

update app.notify_requests
set tracking_id = app.next_submission_tracking_id('NTF')
where tracking_id is null;

update app.preorder_signups
set tracking_id = app.next_submission_tracking_id('PRE')
where tracking_id is null;

alter table app.contact_submissions
  alter column tracking_id set default app.next_submission_tracking_id('CON'),
  alter column tracking_id set not null;
alter table app.drop_requests
  alter column tracking_id set default app.next_submission_tracking_id('REQ'),
  alter column tracking_id set not null;
alter table app.notify_requests
  alter column tracking_id set default app.next_submission_tracking_id('NTF'),
  alter column tracking_id set not null;
alter table app.preorder_signups
  alter column tracking_id set default app.next_submission_tracking_id('PRE'),
  alter column tracking_id set not null;

create unique index if not exists contact_submissions_tracking_idx
  on app.contact_submissions (tracking_id);
create unique index if not exists drop_requests_tracking_idx
  on app.drop_requests (tracking_id);
create unique index if not exists notify_requests_tracking_idx
  on app.notify_requests (tracking_id);
create unique index if not exists preorder_signups_tracking_idx
  on app.preorder_signups (tracking_id);

drop view if exists app.form_submissions;
create view app.form_submissions as
select
  c.tracking_id,
  c.id as source_id,
  'contact'::text as kind,
  c.name,
  c.email,
  null::text as phone,
  null::text as drop_id,
  null::text as variant_id,
  c.subject,
  c.message as detail,
  c.status,
  c.is_spam,
  c.created_at
from app.contact_submissions c

union all

select
  r.tracking_id,
  r.id as source_id,
  'drop_request'::text as kind,
  null::text as name,
  r.email,
  null::text as phone,
  r.drop_id,
  r.variant_id,
  'Request this drop'::text as subject,
  r.note as detail,
  case when r.fulfilled_at is null then 'open' else 'fulfilled' end as status,
  false as is_spam,
  r.created_at
from app.drop_requests r

union all

select
  n.tracking_id,
  n.id as source_id,
  'notify_me'::text as kind,
  null::text as name,
  n.email,
  null::text as phone,
  p.drop_id,
  n.variant_id,
  'Notify me'::text as subject,
  null::text as detail,
  case when n.notified_at is null then 'open' else 'notified' end as status,
  false as is_spam,
  n.created_at
from app.notify_requests n
join public.variants v on v.id = n.variant_id
join public.products p on p.id = v.product_id

union all

select
  s.tracking_id,
  s.id as source_id,
  'preorder'::text as kind,
  s.name,
  s.email,
  s.phone,
  s.drop_id,
  s.variant_id,
  'Pre-order signup'::text as subject,
  null::text as detail,
  case when s.converted_at is null then 'open' else 'converted' end as status,
  false as is_spam,
  s.created_at
from app.preorder_signups s;

comment on view app.form_submissions is
  'Owner-only operational inbox over contact, drop request, notify-me and pre-order forms.';
