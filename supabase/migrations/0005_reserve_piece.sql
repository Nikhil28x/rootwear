-- 0005 — app.reserve_piece(): the only path that allocates a piece.
--
-- §08 Cap: "Cap enforcement is SERVER-SIDE AND ATOMIC — a reservation that
-- loses the race is REFUNDED AUTOMATICALLY and told so immediately."
-- §04: "During a 25-piece drop rush, two people must never be able to buy the
-- same last unit."
-- §18 gate: "Stock decrements correctly when the same last piece is bought in
-- two tabs at once; the loser is refused cleanly."
--
-- No application code writes reservations.piece_number. Ever. This is the one
-- allocation code path; the cart-hold path and the open-sale path both call it.

create type app.reserve_status as enum (
  'allocated',          -- a piece number was claimed
  'cap_full',           -- typed, NON-RETRYABLE: caller maps to the auto-refund path
  'already_allocated'   -- idempotent replay: this reservation already holds a piece
);

create type app.reserve_result as (
  status        app.reserve_status,
  piece_number  integer
);

create or replace function app.reserve_piece(
  p_reservation_id uuid
)
returns app.reserve_result
language plpgsql
security definer
set search_path = app, public, pg_temp
as $$
declare
  v_drop_id      text;
  v_variant_id   text;
  v_existing     integer;
  v_state        app.reservation_state;
  v_cap          integer;
  v_reserved     integer;
  v_edition_size integer;
  v_next         integer;
  v_result       app.reserve_result;
begin
  -- Read the reservation and lock it, so two concurrent confirmations of the
  -- SAME reservation cannot both allocate.
  select r.drop_id, r.variant_id, r.piece_number, r.state
    into v_drop_id, v_variant_id, v_existing, v_state
  from app.reservations r
  where r.id = p_reservation_id
  for update;

  if not found then
    raise exception 'reservation % not found', p_reservation_id
      using errcode = 'no_data_found';
  end if;

  -- Idempotent: a redelivered webhook must not allocate a second piece.
  if v_existing is not null then
    v_result := (('already_allocated')::app.reserve_status, v_existing);
    return v_result;
  end if;

  -- LOCK ORDER: drop first, then variant. Piece numbers are unique per DROP,
  -- so locking only the variant would serialise within a size while two
  -- different sizes could still compute the same max(piece_number) + 1.
  -- Always acquiring drop-then-variant, in that order, also prevents deadlock.
  select d.edition_size into v_edition_size
  from public.drops d
  where d.id = v_drop_id
  for update;

  select v.reserve_cap, v.reserved_count into v_cap, v_reserved
  from public.variants v
  where v.id = v_variant_id
  for update;

  -- The cap is read from the variant record per size (§08), never from a
  -- constant in application code.
  if v_reserved >= v_cap then
    v_result := (('cap_full')::app.reserve_status, null::integer);
    return v_result;
  end if;

  -- Allocate the next free number within the edition, under the drop lock.
  select coalesce(max(r.piece_number), 0) + 1 into v_next
  from app.reservations r
  where r.drop_id = v_drop_id;

  if v_next > v_edition_size then
    -- The edition itself is exhausted even though this size showed headroom.
    v_result := (('cap_full')::app.reserve_status, null::integer);
    return v_result;
  end if;

  update public.variants
     set reserved_count = reserved_count + 1
   where id = v_variant_id;

  update app.reservations
     set piece_number = v_next,
         state = 'reserved'
   where id = p_reservation_id;

  v_result := (('allocated')::app.reserve_status, v_next);
  return v_result;
end;
$$;

comment on function app.reserve_piece(uuid) is
  'RW-108. The ONLY writer of reservations.piece_number. Locks drop then '
  'variant FOR UPDATE before counting, so concurrent callers serialise. '
  'Returns a typed cap_full for the loser, which the caller maps straight to '
  'the automatic refund path — never a 500, never a silent retry.';

-- Nobody but the server may call this.
revoke all on function app.reserve_piece(uuid) from public, anon, authenticated;
