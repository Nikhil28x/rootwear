#!/bin/bash
# End-to-end tests against a local Supabase and the site in test mode.
# Before: `npx supabase start`, `.env.e2e` filled in (see docs/cms-setup.md),
# `node tests/e2e/fakezepto.mjs &` and `npx vite dev --mode e2e --port 5199`.
# Wipes the LOCAL database each run. Never point .env.e2e at the live project.
set -euo pipefail
E2E=$(cd "$(dirname "$0")" && pwd)
grep -q "^PUBLIC_SUPABASE_URL=http://127.0.0.1" "$E2E/../../.env.e2e" || {
  echo ".env.e2e must point at the local Supabase (http://127.0.0.1:54321)"; exit 1; }
"$E2E/reset.sh"
# Warm the server up so first-compile reloads don't land mid-test.
BASE=${BASE:-http://127.0.0.1:5199}
for path in / /drops/01-pineapple-haze /cart /checkout/information /admin/login /admin; do
  curl -s -o /dev/null "$BASE$path" || true
done
status=0
for suite in purchase operations security; do
  echo "== $suite"
  node "$E2E/$suite.mjs" || status=1
done
exit $status
