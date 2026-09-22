-- 0008 — Drop 01 catalogue.
--
-- §09: "Trone loads the Drop 01 catalogue as part of the build, from the asset
-- pack. Rootwear loads every drop after that through admin." One style in five
-- sizes is small enough to load by hand and needs no import tool.
--
-- Mirrors src/lib/server/drops/fixtures/drop-01-pineapple-haze.ts exactly, so
-- CATALOGUE_SOURCE=mock and CATALOGUE_SOURCE=supabase render identically.
--
-- NOTE: published_at is left NULL. The drop is not publicly readable through
-- the anon key until it is published (RLS, 0007). Publishing is an admin action.

insert into public.drops (id, slug, number, name, story, state, launch_instant, edition_size, published_at)
values (
  'drop-01',
  '01-pineapple-haze',
  1,
  'Pineapple Haze',
  'Our first growth: a tactile everyday uniform made with hemp-led fabric, quiet colour and a shape designed to gather character over time.',
  'TEASE',
  -- §15 open item RW-002: exact launch time still to be confirmed in writing.
  timestamptz '2026-09-24 19:00:00+05:30',
  25,
  null
)
on conflict (id) do nothing;

insert into public.products (
  id, drop_id, slug, name, summary, fabric, gsm, care, fit,
  model_height_cm, model_worn_size, launch_price_paise, prelaunch_price_paise
)
values (
  'product-01-tee',
  'drop-01',
  'tee',
  'Pineapple Haze Tee',
  'Hemp-cotton jersey, relaxed oversized, one of twenty-five hand-numbered pieces.',
  '30% hemp / 70% cotton',
  180,
  array['Wash cold', 'Line dry', 'No bleach'],
  'Relaxed oversized',
  178,
  'M',
  410000,   -- §10 ₹4,100 at launch
  340000    -- §10 ₹3,400 pre-launch, locked for tease reservers
)
on conflict (id) do nothing;

-- §09 imagery: a lead shot, at least two detail shots including a fabric
-- close-up, and a worn shot with the model's height stated.
insert into public.product_images (product_id, url, alt, role, position)
values
  ('product-01-tee', '/images/pineapple-haze-front.jpg',
   'Pineapple Haze hemp-cotton T-shirt worn from the front', 'lead', 0),
  ('product-01-tee', '/images/pineapple-haze-back.jpg',
   'The back of the Pineapple Haze T-shirt, showing the tree artwork', 'detail', 1),
  ('product-01-tee', '/images/pineapple-haze-shirt-cutout.png',
   'Close-up of the hemp-cotton jersey, showing the weave', 'fabric', 2),
  ('product-01-tee', '/images/pineapple-haze-editorial.jpg',
   'The Pineapple Haze T-shirt worn, photographed in the campaign', 'worn', 3)
on conflict do nothing;

-- 25 pieces across five sizes; the middle sizes run deeper.
-- reserve_cap is the §08 hard per-size cap. reserved_count starts at 0 and is
-- only ever written by app.reserve_piece().
insert into public.variants (id, product_id, sku, size, stock_count, reserve_cap, reserved_count)
values
  ('variant-01-tee-xs', 'product-01-tee', 'RW-D01-TEE-XS', 'XS', 3, 3, 0),
  ('variant-01-tee-s',  'product-01-tee', 'RW-D01-TEE-S',  'S',  5, 5, 0),
  ('variant-01-tee-m',  'product-01-tee', 'RW-D01-TEE-M',  'M',  7, 7, 0),
  ('variant-01-tee-l',  'product-01-tee', 'RW-D01-TEE-L',  'L',  6, 6, 0),
  ('variant-01-tee-xl', 'product-01-tee', 'RW-D01-TEE-XL', 'XL', 4, 4, 0)
on conflict (id) do nothing;

-- §06: price history is kept so the archive preserves what a piece cost.
insert into public.price_history (product_id, price_paise, kind, effective_from)
values
  ('product-01-tee', 340000, 'prelaunch', now()),
  ('product-01-tee', 410000, 'launch', timestamptz '2026-09-24 19:00:00+05:30')
on conflict do nothing;
