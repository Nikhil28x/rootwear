-- 0022 — Per-person staff permissions, settings, audit lookups.
--
-- §12 began with two roles: 'owner' (everything) and 'layout' (pages only).
-- The CMS adds packers, support and an accountant, each needing a different
-- slice, so access becomes a list of permission keys per person. The role
-- column stays as a label ('owner', 'layout', 'staff') so older rows and the
-- create-admin script keep working, but `is_owner` and `permissions` are what
-- grant access from here on.
--
-- Permission keys live in src/lib/server/admin/permissions.ts. The database
-- does not enumerate them: an unknown key grants nothing, and a new section
-- is inaccessible until someone deliberately ticks it for a person.

alter table app.staff drop constraint if exists staff_role_check;
alter table app.staff
  add constraint staff_role_check check (role in ('owner', 'layout', 'staff'));

alter table app.staff
  add column if not exists is_owner     boolean not null default false,
  add column if not exists permissions  text[]  not null default '{}',
  add column if not exists display_name text,
  add column if not exists email        text,
  add column if not exists active       boolean not null default true,
  add column if not exists invited_by   text,
  add column if not exists last_seen_at timestamptz,
  add column if not exists updated_at   timestamptz not null default now();

update app.staff s
   set is_owner    = (s.role = 'owner'),
       permissions = case when s.role = 'layout' then array['layout.edit'] else '{}'::text[] end,
       email       = coalesce(s.email, (select u.email from auth.users u where u.id = s.user_id));

drop trigger if exists staff_touch on app.staff;
create trigger staff_touch before update on app.staff
  for each row execute function app.touch_updated_at();

-- The last active owner cannot be demoted, deactivated or removed. Without
-- this, one mis-click locks everyone out of staff management and the only
-- way back in is SQL against production.
create or replace function app.guard_last_owner()
returns trigger
language plpgsql
set search_path = app, public, pg_temp
as $$
declare
  v_remaining integer;
begin
  if tg_op = 'DELETE' then
    if not (old.is_owner and old.active) then return old; end if;
  elsif (new.is_owner and new.active) or not (old.is_owner and old.active) then
    return new;
  end if;

  select count(*) into v_remaining
    from app.staff
   where is_owner and active and user_id <> old.user_id;

  if v_remaining = 0 then
    raise exception 'At least one active owner must remain.'
      using errcode = 'P0001';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists staff_last_owner on app.staff;
create trigger staff_last_owner before update or delete on app.staff
  for each row execute function app.guard_last_owner();

-- RLS helpers now read the permission model. is_owner() keeps its name so
-- every existing policy (0007, 0009-0012, 0017) keeps working unchanged.
create or replace function app.is_owner()
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_temp
as $$
  select exists (
    select 1 from app.staff s
     where s.user_id = (select auth.uid()) and s.is_owner and s.active
  );
$$;

create or replace function app.is_staff()
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_temp
as $$
  select exists (
    select 1 from app.staff s where s.user_id = (select auth.uid()) and s.active
  );
$$;

create or replace function app.has_permission(p_key text)
returns boolean
language sql
stable
security definer
set search_path = app, public, pg_temp
as $$
  select exists (
    select 1 from app.staff s
     where s.user_id = (select auth.uid())
       and s.active
       and (s.is_owner or p_key = any (s.permissions))
  );
$$;

-- The bootstrap helper also sets the new columns, so scripts/create-admin.mjs
-- produces a working owner on a fresh database.
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

  insert into app.staff (user_id, role, is_owner, permissions, email)
  values (
    v_user_id,
    p_role,
    p_role = 'owner',
    case when p_role = 'layout' then array['layout.edit'] else '{}'::text[] end,
    lower(p_email)
  )
  on conflict (user_id) do update
    set role        = excluded.role,
        is_owner    = excluded.is_owner,
        permissions = excluded.permissions,
        email       = excluded.email,
        active      = true;

  return v_user_id;
end;
$$;

revoke all on function app.grant_staff_role(text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Settings: one row per area, edited from /admin/settings. Values that change
-- what a customer is charged or what an invoice says belong here, not in
-- code, so the owner can correct them without a deploy.
-- ---------------------------------------------------------------------------
create table if not exists app.settings (
  key         text primary key,
  value       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  updated_by  text
);

alter table app.settings enable row level security;
create policy settings_staff_read on app.settings
  for select to authenticated using (app.is_staff());

-- ---------------------------------------------------------------------------
-- Audit log lookups for the /admin/audit screen's filters.
-- ---------------------------------------------------------------------------
create index if not exists admin_audit_entity_idx
  on app.admin_audit_log (entity, entity_id, occurred_at desc);
create index if not exists admin_audit_actor_idx
  on app.admin_audit_log (actor_email, occurred_at desc);

-- The service role reads and writes these from the server (as 0018 does).
grant all on app.settings to service_role;
grant execute on function app.has_permission(text) to authenticated, service_role;
