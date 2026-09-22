-- 0001 — Foundations: schemas, enums, helpers.
--
-- Two schemas, deliberately:
--   public — catalogue. Exposed through PostgREST, readable with the anon key.
--   app    — money, customers, orders, reservations, payments. NOT added to
--            PostgREST's exposed schemas, so the browser cannot reach these
--            tables at all, whatever an RLS mistake might otherwise allow.
--            Server routes reach them with the service-role key only.
--
-- §04: "Row-level security on every customer-facing table."
-- §04: money is integer paise. No numeric, decimal or float holds money here.

create extension if not exists "pgcrypto";

create schema if not exists app;

-- Keep app out of the API surface. (Also enforced in Supabase project settings;
-- stated here so the intent survives a settings change.)
revoke all on schema app from anon, authenticated;

-- ---------------------------------------------------------------------------
-- §06 — the seven drop states. Stored explicitly, never inferred from stock.
-- ---------------------------------------------------------------------------
create type public.drop_state as enum (
  'TEASE',      -- 0 interactive teaser live, piece not shown, deposits taken
  'REVEALED',   -- 1 piece shown, countdown running, nothing on sale yet
  'LIVE',       -- 2 on sale at an exact stated time
  'PARTIAL',    -- 3 some sizes gone; sold-out sizes stay visible and greyed
  'SOLD_OUT',   -- 4 nothing left; page stays up with notify-me
  'ARCHIVED',   -- 5 in the archive, story intact, dated as released
  'RE_DROP'     -- 6 an old piece restocked; same page revived
);

-- §09: one variant axis only. There is deliberately no colour type.
create type public.garment_size as enum ('XS', 'S', 'M', 'L', 'XL');

-- §08 — the whole life of a reservation, as one explicit state.
create type app.reservation_state as enum (
  'pending_payment',      -- deposit initiated, not yet confirmed
  'reserved',             -- deposit confirmed, piece number allocated
  'refunded_cap_race',    -- lost the cap race, refunded automatically
  'cancelled',            -- cancelled under the stated rule
  'balance_due',          -- balance link sent
  'balance_paid',         -- balance cleared, dispatchable
  'dispatched',
  'released_to_waitlist'  -- balance lapsed; piece released
);

create type app.order_state as enum (
  'pending_payment', 'paid', 'packed', 'dispatched', 'delivered', 'cancelled', 'refunded'
);

-- Updated-at trigger, used by every mutable table.
create or replace function app.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
