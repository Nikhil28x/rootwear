-- 0012 — Staff bootstrap helper.
--
-- §12 role split: 'owner' (Aaron) has full access; 'layout' (Trone) may touch
-- page layout, banners, campaign slots, site copy and navigation, and has NO
-- ACCESS TO ORDERS, CUSTOMER RECORDS OR PAYOUTS.
--
-- The auth user itself is created by scripts/create-admin.mjs using the
-- service-role key; this function only grants the role, so a password never
-- passes through SQL or a migration file.

create or replace function app.grant_staff_role(
  p_email text,
  p_role  text
)
returns uuid
language plpgsql
security definer
set search_path = app, public, auth, pg_temp
as $$
declare
  v_user_id uuid;
begin
  if p_role not in ('owner', 'layout') then
    raise exception 'role must be owner or layout, got %', p_role;
  end if;

  select id into v_user_id from auth.users where lower(email) = lower(p_email);
  if v_user_id is null then
    raise exception 'no auth user for %. Create the user first.', p_email;
  end if;

  insert into app.staff (user_id, role)
  values (v_user_id, p_role)
  on conflict (user_id) do update set role = excluded.role;

  return v_user_id;
end;
$$;

revoke all on function app.grant_staff_role(text, text) from public, anon, authenticated;

-- §12 / §141 — every privileged write is recorded. Admin actions that move
-- money or stock must be attributable after the fact.
create table app.admin_audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references auth.users(id) on delete set null,
  actor_email text,
  action      text not null,
  entity      text not null,
  entity_id   text,
  detail      jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index admin_audit_recent_idx on app.admin_audit_log (occurred_at desc);

alter table app.admin_audit_log enable row level security;

create policy audit_owner_read on app.admin_audit_log
  for select to authenticated using (app.is_owner());
