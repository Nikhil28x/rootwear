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
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
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

# --- unpaid orders give their stock back (0020) -----------------------------
T=cartsuper00000000000000
P="cart:$T:"
STOCK() { Q -c "select stock_count from public.variants where id='variant-01-tee-l';"; }
Q >/dev/null <<SQL
insert into app.coupons (code,kind,value,max_uses) values ('ONCE1','fixed',10000,1);
insert into app.carts (id,token,expires_at) values ('66666666-0000-0000-0000-000000000000','$T', now()+interval '1 hour');
insert into app.cart_lines (cart_id,variant_id,quantity,held_until)
values ('66666666-0000-0000-0000-000000000000','variant-01-tee-l',1, now()+interval '15 minutes');
SQL
S0=$(STOCK)
COMMIT() { Q -c "select (app.commit_order('$1','$T','s@e.com','S','L1',null,'Pune','MH','411001','9999999999',null,0)).status;"; }
RESTORE() { Q -c "insert into app.cart_lines (cart_id,variant_id,quantity,held_until) values ('66666666-0000-0000-0000-000000000000','variant-01-tee-l',1, now()+interval '15 minutes');" >/dev/null; }
OID() { Q -c "select order_id from app.order_idempotency where key='$1';"; }
check "first order commits" "$(COMMIT "${P}fp1")" "committed"
O1=$(OID "${P}fp1")
check "first order redeems the single-use code" "$(Q -c "select (app.redeem_coupon('$O1','ONCE1')).status;")" "redeemed"
check "stock taken by the unpaid order" "$(STOCK)" "$((S0-1))"
check "another cart is told the code is used" "$(Q -c "select (app.apply_coupon('ONCE1',340000,'order')).status;")" "exhausted"
check "the same cart's unpaid order does not block it" "$(Q -c "select (app.apply_coupon('ONCE1',340000,'order','$P')).status;")" "ok"
check "recent_pending_order finds it" "$(Q -c "select app.recent_pending_order('$P', now()-interval '2 minutes') = (select public_token from app.orders where id='$O1');")" "t"
RESTORE
check "same key is not superseded" "$(Q -c "select app.cancel_superseded_orders('$P','${P}fp1');")" "0"
check "changed basket supersedes the old order" "$(Q -c "select app.cancel_superseded_orders('$P','${P}fp2');")" "1"
check "superseded order is cancelled" "$(Q -c "select state from app.orders where id='$O1';")" "cancelled"
check "its stock is back" "$(STOCK)" "$S0"
check "its coupon use is released" "$(Q -c "select used_count||'/'||(select count(*) from app.coupon_redemptions where order_id='$O1') from app.coupons where code='ONCE1';")" "0/0"
check "its idempotency key is released" "$(Q -c "select count(*) from app.order_idempotency where order_id='$O1';")" "0"
check "the new order commits" "$(COMMIT "${P}fp2")" "committed"
O2=$(OID "${P}fp2")
check "and can redeem the code" "$(Q -c "select (app.redeem_coupon('$O2','ONCE1')).status;")" "redeemed"
Q -c "insert into app.payments (order_id,kind,gateway_order_id,amount_paise) select id,'order','g2',total_paise from app.orders where id='$O2';" >/dev/null
check "the new order is paid" "$(Q -c "select (app.capture_payment('g2','pay2',(select total_paise from app.orders where id='$O2'))).status;")" "captured"
RESTORE
check "a paid order is never superseded" "$(Q -c "select app.cancel_superseded_orders('$P','${P}fp3');")" "0"
check "a paid order is never expired" "$(Q -c "update app.orders set created_at=now()-interval '2 hours' where id='$O2'; select app.expire_unpaid_orders(interval '30 minutes');")" "0"
check "paid order keeps its state" "$(Q -c "select state from app.orders where id='$O2';")" "paid"
check "paid order keeps its coupon use" "$(Q -c "select used_count from app.coupons where code='ONCE1';")" "1"

S1=$(STOCK)
check "a third order commits" "$(COMMIT "${P}fp3")" "committed"
O3=$(OID "${P}fp3")
Q -c "insert into app.payments (order_id,kind,gateway_order_id,amount_paise) select id,'order','g3',total_paise from app.orders where id='$O3';" >/dev/null
check "a fresh unpaid order is not expired" "$(Q -c "select app.expire_unpaid_orders(interval '30 minutes');")" "0"
Q -c "update app.orders set created_at=now()-interval '31 minutes' where id='$O3';" >/dev/null
check "a lapsed unpaid order is expired" "$(Q -c "select app.expire_unpaid_orders(interval '30 minutes');")" "1"
check "expiry gives its stock back" "$(STOCK)" "$S1"
check "expiry is idempotent" "$(Q -c "select app.expire_unpaid_orders(interval '30 minutes');")" "0"
check "a late capture is not marked paid" "$(Q -c "select (app.capture_payment('g3','pay3',(select total_paise from app.orders where id='$O3'))).status;")" "captured_order_cancelled"
check "the late capture leaves the order cancelled" "$(Q -c "select state from app.orders where id='$O3';")" "cancelled"
check "the late capture records a cap_race refund" "$(Q -c "select count(*) from app.refunds r join app.payments p on p.id=r.payment_id where p.gateway_order_id='g3' and r.reason='cap_race';")" "1"
check "a redelivered late capture adds no second refund" "$(Q -c "select (app.capture_payment('g3','pay3',0)).status||'/'||(select count(*) from app.refunds);")" "already_captured/1"

# capture vs expiry, concurrently: exactly one outcome, never both.
RESTORE
check "a fourth order commits" "$(COMMIT "${P}fp4")" "committed"
O4=$(OID "${P}fp4")
S2=$(STOCK)
Q -c "insert into app.payments (order_id,kind,gateway_order_id,amount_paise) select id,'order','g4',total_paise from app.orders where id='$O4';
      update app.orders set created_at=now()-interval '1 hour' where id='$O4';" >/dev/null
Q -c "select (app.capture_payment('g4','pay4',(select total_paise from app.orders where id='$O4'))).status;" >"$RUNDIR/c" 2>&1 &
Q -c "select app.expire_unpaid_orders(interval '30 minutes');" >"$RUNDIR/e" 2>&1 &
wait
RACE="$(cat "$RUNDIR/c")/$(cat "$RUNDIR/e")/$(Q -c "select state from app.orders where id='$O4';")/$(( $(STOCK) - S2 ))"
case "$RACE" in
  "captured/0/paid/0"|"captured_order_cancelled/1/cancelled/1") ok "capture racing expiry settles one way ($RACE)";;
  *) bad "capture racing expiry settles one way" "$RACE";;
esac

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
