-- 0029 — Guards that only the database can give: no over-refunding, and no
-- gaps in invoice numbers, however many requests arrive at once.

-- ---------------------------------------------------------------------------
-- A payment can never be refunded beyond what it captured. The payment row is
-- locked first, so two refunds racing for the last rupee are taken one after
-- the other and the second is refused. Failed refunds do not count.
-- ---------------------------------------------------------------------------
create or replace function app.guard_refund_total()
returns trigger
language plpgsql
set search_path = app, public, pg_temp
as $$
declare
  v_amount   bigint;
  v_refunded bigint;
begin
  select amount_paise into v_amount from app.payments where id = new.payment_id for update;
  select coalesce(sum(amount_paise), 0) into v_refunded
    from app.refunds
   where payment_id = new.payment_id and state <> 'failed' and id <> new.id;
  if new.state <> 'failed' and v_refunded + new.amount_paise > v_amount then
    raise exception 'Refunds on this payment would exceed what it captured (% of % already refunded).', v_refunded, v_amount
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists refunds_within_payment on app.refunds;
create trigger refunds_within_payment before insert or update of amount_paise, state on app.refunds
  for each row execute function app.guard_refund_total();

-- ---------------------------------------------------------------------------
-- Issues an invoice or credit note: takes the next number in its series and
-- writes the document in ONE transaction, serialised on the order row. A
-- second caller for the same order or refund gets the existing document, and
-- no number is ever taken without a document to show for it (GST numbering
-- must have no gaps).
-- ---------------------------------------------------------------------------
create or replace function app.issue_document(
  p_order_id  uuid,
  p_kind      text,
  p_refund_id uuid,
  p_series    text,
  p_prefix    text,
  p_document  jsonb,
  p_actor     text
)
returns uuid
language plpgsql
security definer
set search_path = app, public, pg_temp
as $$
declare
  v_id uuid;
  v_n  integer;
begin
  perform 1 from app.orders where id = p_order_id for update;

  if p_kind = 'invoice' then
    select id into v_id from app.invoices where order_id = p_order_id and kind = 'invoice';
  else
    select id into v_id from app.invoices where refund_id = p_refund_id;
  end if;
  if v_id is not null then
    return v_id;
  end if;

  v_n := app.next_document_number(p_series);
  insert into app.invoices (order_id, kind, number, refund_id, gst_registered, seller, buyer, lines, totals, created_by)
  values (
    p_order_id, p_kind, p_prefix || lpad(v_n::text, 4, '0'), p_refund_id,
    (p_document->>'gst_registered')::boolean,
    p_document->'seller', p_document->'buyer', p_document->'lines', p_document->'totals',
    p_actor
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function app.issue_document(uuid, text, uuid, text, text, jsonb, text) from public, anon, authenticated;
grant execute on function app.issue_document(uuid, text, uuid, text, text, jsonb, text) to service_role;
