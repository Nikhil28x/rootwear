#!/bin/bash
# Fresh local database from the migrations, plus the test owner.
set -euo pipefail
E2E=$(cd "$(dirname "$0")" && pwd)
cd "$E2E/../.."
npx supabase db reset >/dev/null 2>&1
# PostgREST reconnects after the reset; wait until it answers with data.
KEY=$(grep -E "^SUPABASE_SECRET_KEY=" .env.e2e | cut -d= -f2-)
for i in $(seq 1 60); do
  [ "$(curl -s -o /dev/null -w '%{http_code}' -H "apikey: $KEY" http://127.0.0.1:54321/rest/v1/drops?select=id)" = 200 ] && break
  sleep 1
done
env $(grep -E "^(PUBLIC_SUPABASE_URL|SUPABASE_SECRET_KEY|ADMIN_EMAIL|ADMIN_PASSWORD|ADMIN_ROLE)=" .env.e2e | xargs) node scripts/create-admin.mjs >/dev/null
: > "$E2E/mail.jsonl"
echo "reset: $(${PSQL:-psql} postgresql://postgres:postgres@127.0.0.1:54322/postgres -XtAc "select count(*) from supabase_migrations.schema_migrations") migrations, owner ready"
