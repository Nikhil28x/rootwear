-- 0033 — The browser roles get nothing through the Supabase API.
--
-- Supabase grants anon and authenticated every privilege on every table in
-- `public` and leaves row security to decide. Nothing in Rootwear reads the
-- database from the browser: the server reads the catalogue with the service
-- role and uses the anon key only to sign people in. Those grants were
-- therefore pure exposure, and they leaked: anyone holding the publishable key
-- (served to every browser) could read a product's hidden price, draft
-- products of a published drop, and price history; and any staff member could
-- rewrite the policy pages through the API, skipping the app's layout.edit
-- check.
--
-- Row security stays on underneath every table as a second wall.

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from anon, authenticated, public;

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from anon, authenticated, public;

-- Supabase also sets defaults for objects the postgres role creates.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated, public;

-- The service role keeps everything; it is how the server reads the shop.
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
