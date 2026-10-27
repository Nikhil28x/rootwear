-- 0030 — Schema access for the Supabase API, now that `app` is exposed to it.
--
-- The server reads and writes `app` through the API with the service-role
-- key, so the schema is listed under Settings → API → Exposed schemas. That
-- makes every grant here reachable over HTTP, so they are kept to:
--
--   service_role   everything (the server acting as the system).
--   authenticated  execute on the four helpers that RLS policies call, since
--                  a signed-in customer's query on a catalogue table evaluates
--                  `app.is_owner()`. Policies hold functions by reference, so
--                  this needs no access to the schema itself, and without it
--                  /rpc can't reach commit_order and the like.
--   anon           nothing.

grant usage on schema app to service_role;

grant all on all tables in schema app to service_role;
grant all on all sequences in schema app to service_role;
alter default privileges in schema app grant all on tables to service_role;
alter default privileges in schema app grant all on sequences to service_role;

revoke execute on all functions in schema app from public, anon, authenticated;
alter default privileges in schema app revoke execute on functions from public;
grant execute on all functions in schema app to service_role;
alter default privileges in schema app grant execute on functions to service_role;

grant execute on function app.is_owner(), app.is_staff(), app.current_customer_id(),
  app.has_permission(text) to authenticated;
