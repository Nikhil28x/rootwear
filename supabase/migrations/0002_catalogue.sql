-- 0002 — Catalogue: drops, products, variants, price history, state events.
-- Columns match src/lib/server/drops/fixtures/* one for one, so swapping the
-- mock repository for the Supabase one is a transcription (RW-046).

create table public.drops (
  id              text primary key,
  -- §05: numbered with a slug, and the URL never changes once public.
  slug            text not null unique,
  number          integer not null unique check (number between 1 and 99),
  name            text not null,
  story           text not null default '',

  -- §06: explicit stored state. NOTE: there is deliberately NO unique
  -- constraint forbidding two rows in a live state — the brief says the model
  -- must permit two; the storefront resolves one and admin warns (RW-043).
  state           public.drop_state not null default 'TEASE',

  launch_instant  timestamptz not null,
  -- §06: archived drops are "dated as released". Null until archived.
  archived_at     timestamptz,
  -- §08: 25 hand-numbered pieces for Drop 01.
  edition_size    integer not null check (edition_size > 0),

  -- Anon storefront reads are gated on this (see 0009 RLS): an unpublished
  -- drop must not leak through the anon key before its reveal.
  published_at    timestamptz,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger drops_touch before update on public.drops
  for each row execute function app.touch_updated_at();

create table public.products (
  id                text primary key,
  drop_id           text not null references public.drops(id) on delete restrict,
  slug              text not null,
  name              text not null,
  summary           text not null default '',

  -- §09: fabric, GSM, care and fit are FIELDS, not prose in a description,
  -- so the PDP, the size guide and the invoice cannot drift apart.
  fabric            text not null,
  gsm               integer not null check (gsm > 0),
  care              text[] not null default '{}',
  fit               text not null,
  model_height_cm   integer check (model_height_cm > 0),
  model_worn_size   public.garment_size,

  -- §10: two distinct prices so §08's locked price has something to lock.
  -- bigint PAISE. Never numeric, never float.
  launch_price_paise     bigint not null check (launch_price_paise >= 0),
  prelaunch_price_paise  bigint not null check (prelaunch_price_paise >= 0),

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- §05: product is nested under its drop, so the slug need only be unique there.
  unique (drop_id, slug)
);

create trigger products_touch before update on public.products
  for each row execute function app.touch_updated_at();

create table public.product_images (
  id          uuid primary key default gen_random_uuid(),
  product_id  text not null references public.products(id) on delete cascade,
  url         text not null,
  -- §14: alt text is covered by the claims guardrail — no unprovable
  -- environmental claim may appear here either.
  alt         text not null,
  -- §09 imagery requirement: a lead shot, 2+ detail shots including a fabric
  -- close-up, and a worn shot with the model's height stated.
  role        text not null check (role in ('lead', 'detail', 'fabric', 'worn')),
  position    integer not null default 0
);

create index product_images_product_idx on public.product_images (product_id, position);

create table public.variants (
  id              text primary key,
  product_id      text not null references public.products(id) on delete restrict,
  -- §09 SKU convention RW-D01-TEE-M. Agreed once, never re-cut.
  sku             text not null unique,
  size            public.garment_size not null,

  -- §09: per-size stock count. Authoritative here, never in client code.
  stock_count     integer not null default 0 check (stock_count >= 0),
  -- §08: the hard per-size cap on reservations during the tease.
  reserve_cap     integer not null default 0 check (reserve_cap >= 0),
  -- Maintained ONLY by app.reserve_piece() (0007). Never written by app code.
  reserved_count  integer not null default 0 check (reserved_count >= 0),

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (product_id, size),

  -- A size can never be reserved beyond its cap, whatever the function does.
  constraint variants_reserved_within_cap check (reserved_count <= reserve_cap),

  -- Reserved pieces are a subset of the pieces that physically exist. This is
  -- the real invariant: sellable stock is (stock_count - reserved_count), so
  -- §08's "reserved pieces are not sellable at launch" holds by construction.
  --
  -- NOTE: there is deliberately NO `reserve_cap <= stock_count` constraint.
  -- reserve_cap is a tease-time POLICY ceiling on how many pieces may be
  -- reserved; stock_count is physical stock, which falls on every open sale.
  -- Tying them made a legitimate sale fail once stock dropped below the cap.
  constraint variants_reserved_within_stock check (reserved_count <= stock_count)
);

create trigger variants_touch before update on public.variants
  for each row execute function app.touch_updated_at();

-- §06: "Archived drops keep their story, imagery AND PRICE HISTORY."
-- Append-only: a price change inserts, it never updates.
create table public.price_history (
  id           uuid primary key default gen_random_uuid(),
  product_id   text not null references public.products(id) on delete restrict,
  price_paise  bigint not null check (price_paise >= 0),
  -- Which price this was: the pre-launch locked price or the launch price.
  kind         text not null check (kind in ('prelaunch', 'launch')),
  effective_from timestamptz not null default now(),
  recorded_at  timestamptz not null default now()
);

create index price_history_product_idx on public.price_history (product_id, effective_from desc);

-- §06: every state change is recorded. Nothing is ever deleted; the archive is
-- the brand's proof of history. Also the audit trail for auto-publish (RW-041).
create table public.drop_state_events (
  id          uuid primary key default gen_random_uuid(),
  drop_id     text not null references public.drops(id) on delete restrict,
  from_state  public.drop_state,
  to_state    public.drop_state not null,
  -- 'schedule' = auto-published at the launch instant; 'manual' = admin override.
  trigger     text not null check (trigger in ('schedule', 'manual', 'system')),
  actor       text,
  occurred_at timestamptz not null default now()
);

create index drop_state_events_drop_idx on public.drop_state_events (drop_id, occurred_at desc);
