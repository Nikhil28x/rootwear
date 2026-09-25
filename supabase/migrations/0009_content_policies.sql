-- 0009 — The reusable Static/Policy template (§03 template 10).
--
-- "Contact form, plus the reusable template carrying Shipping, Returns,
--  Privacy, Terms, FAQ, Size Guide, Care and Track Order. UNLIMITED PAGES ON
--  ONE TEMPLATE. Search and 404 styled with it."
--
-- Body is stored as ordered structured blocks rather than a blob of HTML, so
-- the renderer controls typography and a policy cannot inject markup.

create table public.policies (
  id           uuid primary key default gen_random_uuid(),
  -- /policies/<slug> — shipping · returns · privacy · terms · faq ·
  -- size-guide · care · track-order, and anything added later at no cost.
  slug         text not null unique
                 check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title        text not null,
  summary      text not null default '',

  -- Ordered blocks: {type: 'paragraph'|'heading'|'list'|'table'|'callout', ...}
  body         jsonb not null default '[]'::jsonb,

  -- §11: the 7-day defects-only wording must be IDENTICAL in all four places
  -- it appears. Pages that carry it are flagged so the launch gate can compare
  -- them against the single source in src/lib/content/returns.ts.
  carries_returns_wording boolean not null default false,

  -- Unpublished drafts are invisible to anon (RLS, below).
  published_at timestamptz,
  -- §12: Trone's 'layout' role may edit site copy outside product listings.
  updated_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- Shown in the footer policy list, in this order.
  nav_order    integer not null default 100,
  show_in_footer boolean not null default true
);

create trigger policies_touch before update on public.policies
  for each row execute function app.touch_updated_at();

create index policies_footer_idx on public.policies (nav_order)
  where show_in_footer and published_at is not null;

-- Full-text search across policy content — powers the styled search page.
alter table public.policies
  add column search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(body::text, '')), 'C')
  ) stored;

create index policies_search_idx on public.policies using gin (search_vector);

alter table public.policies enable row level security;

create policy policies_public_read on public.policies
  for select to anon, authenticated
  using (published_at is not null and published_at <= now());

-- §12: the owner edits everything; the layout role edits site copy, which
-- policy pages are. Both may write here — unlike product listings.
create policy policies_staff_write on public.policies
  for all to authenticated
  using (app.is_staff()) with check (app.is_staff());
