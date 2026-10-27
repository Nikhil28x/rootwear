-- 0031 — A product's price can be kept off the site.
--
-- While price_visible is false the shop shows "Price revealed at launch"
-- instead of the price, and the piece can't be carted or ordered: the buy
-- button becomes the notify-me signup. The price itself stays here, set and
-- saved, ready for the reveal.

alter table public.products
  add column if not exists price_visible boolean not null default true;

comment on column public.products.price_visible is
  'false hides the price on the site and stops the piece being carted or ordered.';
