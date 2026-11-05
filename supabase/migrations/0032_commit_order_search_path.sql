-- 0032 — commit_order can find gen_random_bytes() on Supabase.
--
-- Supabase installs pgcrypto in the `extensions` schema, and commit_order's
-- search_path (app, public) did not include it, so placing any order failed
-- with "function gen_random_bytes(integer) does not exist". The order's
-- public token comes from it, so checkout could not work at all.

alter function app.commit_order(
  text, text, text, text, text, text, text, text, text, text, text, bigint
) set search_path = app, public, extensions, pg_temp;
