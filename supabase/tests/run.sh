#!/bin/bash
# Database assertions. Throwaway local cluster only — never the Supabase project.
set -euo pipefail

PGBIN="${PGBIN:-/opt/homebrew/opt/postgresql@16/bin}"
export PATH="$PGBIN:$PATH" LC_ALL=C LANG=C

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
RUNDIR="$(mktemp -d /tmp/rwtest.XXXXXX)"
SOCK="$RUNDIR/s"; mkdir -p "$SOCK"
PORT=55434
PASS=0; FAIL=0

cleanup() { pg_ctl -D "$RUNDIR/data" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$RUNDIR"; }
trap cleanup EXIT

say()  { printf '  %-58s %s\n' "$1" "$2"; }
ok()   { PASS=$((PASS+1)); say "$1" "PASS"; }
bad()  { FAIL=$((FAIL+1)); say "$1" "FAIL  (got: $2)"; }
check(){ [ "$2" = "$3" ] && ok "$1" || bad "$1" "$2"; }

initdb -D "$RUNDIR/data" -U postgres --auth=trust >/dev/null 2>&1
pg_ctl -D "$RUNDIR/data" -o "-p $PORT -k $SOCK -c listen_addresses=''" -l "$RUNDIR/log" start >/dev/null
sleep 2
Q() { psql -h "$SOCK" -p $PORT -U postgres -d rw -q -tA "$@"; }

psql -h "$SOCK" -p $PORT -U postgres -q -c "create database rw;" >/dev/null
Q -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
create schema if not exists auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create or replace function auth.uid() returns uuid language sql stable as $fn$ select null::uuid $fn$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
end $$;
SQL

echo "Applying migrations"
for f in "$ROOT"/supabase/migrations/*.sql; do
  Q -v ON_ERROR_STOP=1 -f "$f" >/dev/null
  say "$(basename "$f")" "applied"
done

echo
echo "Assertions"

# --- the cap race -----------------------------------------------------------
Q -c "update public.variants set reserve_cap=1, stock_count=1 where id='variant-01-tee-xs';" >/dev/null
Q >/dev/null <<'SQL'
insert into app.customers (id,email) values
 ('11111111-1111-1111-1111-111111111111','a@e.com'),
 ('22222222-2222-2222-2222-222222222222','b@e.com');
insert into app.reservations (id,drop_id,variant_id,customer_id,state,locked_price_paise,deposit_paise,balance_paise,cancellation_rule)
values ('aaaaaaaa-0000-0000-0000-000000000001','drop-01','variant-01-tee-xs','11111111-1111-1111-1111-111111111111','pending_payment',340000,170000,170000,'rule'),
       ('bbbbbbbb-0000-0000-0000-000000000002','drop-01','variant-01-tee-xs','22222222-2222-2222-2222-222222222222','pending_payment',340000,170000,170000,'rule');
SQL
Q -c "select (app.reserve_piece('aaaaaaaa-0000-0000-0000-000000000001')).status;" >"$RUNDIR/a" 2>&1 &
Q -c "select (app.reserve_piece('bbbbbbbb-0000-0000-0000-000000000002')).status;" >"$RUNDIR/b" 2>&1 &
wait
RESULTS="$(cat "$RUNDIR/a" "$RUNDIR/b" | sort | tr '\n' ' ' | xargs)"
check "two tabs, last piece: one wins one is refused" "$RESULTS" "allocated cap_full"
check "reserved_count did not exceed the cap" "$(Q -c "select reserved_count from public.variants where id='variant-01-tee-xs';")" "1"

W=$(Q -c "select id from app.reservations where piece_number is not null limit 1;")
check "replayed reserve_piece is idempotent" "$(Q -c "select (app.reserve_piece('$W')).status;")" "already_allocated"
check "replay did not double-increment" "$(Q -c "select reserved_count from public.variants where id='variant-01-tee-xs';")" "1"

# --- cross-size uniqueness --------------------------------------------------
Q >/dev/null <<'SQL'
insert into app.customers (id,email) select ('3333333'||n||'-1111-1111-1111-111111111111')::uuid,'c'||n||'@e.com' from generate_series(1,4) n;
insert into app.reservations (id,drop_id,variant_id,customer_id,state,locked_price_paise,deposit_paise,balance_paise,cancellation_rule)
select ('4444444'||v.n||'-0000-0000-0000-000000000000')::uuid,'drop-01',v.id,('3333333'||v.n||'-1111-1111-1111-111111111111')::uuid,'pending_payment',340000,170000,170000,'rule'
from (select id, row_number() over (order by id) n from public.variants where size <> 'XS') v;
SQL
for n in 1 2 3 4; do Q -c "select (app.reserve_piece('4444444${n}-0000-0000-0000-000000000000')).status;" >/dev/null 2>&1 & done
wait
TOTAL=$(Q -c "select count(*) from app.reservations where piece_number is not null;")
DISTINCT=$(Q -c "select count(distinct piece_number) from app.reservations where piece_number is not null;")
check "concurrent cross-size allocation keeps numbers unique" "$TOTAL/$DISTINCT" "5/5"

# --- order commit -----------------------------------------------------------
Q >/dev/null <<'SQL'
insert into app.carts (id,token,expires_at) values ('55555555-0000-0000-0000-000000000000','tok', now()+interval '1 hour');
insert into app.cart_lines (cart_id,variant_id,quantity,held_until)
values ('55555555-0000-0000-0000-000000000000','variant-01-tee-m',1, now()+interval '15 minutes');
SQL
check "commit_order commits" \
  "$(Q -c "select (app.commit_order('k1','tok','b@e.com','B','L1',null,'Mumbai','MH','400001','9999999999',null,0)).status;")" "committed"
check "price resolved server-side, not supplied" \
  "$(Q -c "select unit_price_paise||'/'||price_source from app.order_lines;")" "340000/prelaunch_locked"
check "replayed commit returns the same order" \
  "$(Q -c "select (app.commit_order('k1','tok','b@e.com','B','L1',null,'Mumbai','MH','400001','9999999999',null,0)).status;")" "replayed"
check "no duplicate order row" "$(Q -c "select count(*) from app.orders;")" "1"

# --- RLS --------------------------------------------------------------------
Q -c "grant usage on schema public to anon, authenticated;
      grant select on all tables in schema public to anon, authenticated;" >/dev/null
check "anon cannot read an unpublished drop" "$(Q -c "set role anon; select count(*) from public.drops;")" "0"
Q -c "update public.drops set published_at=now();" >/dev/null
check "anon reads the drop once published" "$(Q -c "set role anon; select count(*) from public.drops;")" "1"
# Layer 1 — the `app` schema is not exposed, so neither role can even address it.
ANON_APP=$(Q -c "set role anon; select count(*) from app.orders;" 2>&1 | grep -c "permission denied for schema app" || true)
check "anon cannot address the app schema at all" "$ANON_APP" "1"
AUTH_APP=$(Q -c "set role authenticated; select count(*) from app.orders;" 2>&1 | grep -c "permission denied for schema app" || true)
check "authenticated cannot address the app schema either" "$AUTH_APP" "1"

# Layer 2 — grant the schema, so RLS itself is what is under test. This is the
# defence-in-depth layer: if `app` were ever exposed through PostgREST, the
# policies must still return nothing to a non-owner.
Q -c "grant usage on schema app to authenticated;
      grant select on all tables in schema app to authenticated;" >/dev/null
check "with the schema granted, RLS still hides others' orders" "$(Q -c "set role authenticated; select count(*) from app.orders;")" "0"
check "with the schema granted, RLS still hides customers" "$(Q -c "set role authenticated; select count(*) from app.customers;")" "0"
check "with the schema granted, RLS still hides reservations" "$(Q -c "set role authenticated; select count(*) from app.reservations;")" "0"
check "with the schema granted, RLS still hides payments" "$(Q -c "set role authenticated; select count(*) from app.payments;")" "0"

echo
echo "  $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
