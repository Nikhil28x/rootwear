-- Drop 01's campaign shoot replaces the placeholder renders.
--
-- product_images gains an optional caption and the photograph's pixel size,
-- so galleries can caption a frame and hold its shape before it loads. The
-- photographs themselves are static files under /images/drop-01/, published
-- at 640/1080/1600(/2400) widths; the row points at the widest.

alter table public.product_images
  add column if not exists caption text,
  add column if not exists width   integer check (width is null or width > 0),
  add column if not exists height  integer check (height is null or height > 0);

delete from public.product_images where product_id = 'product-01-tee';

insert into public.product_images (product_id, url, alt, role, position, caption, width, height)
values
  ('product-01-tee', '/images/drop-01/front-1600.webp',
   'The Pineapple Haze tee worn from the front: the tree and the script embroidered on the chest',
   'lead', 0, 'Front', 1600, 2000),
  ('product-01-tee', '/images/drop-01/back-1600.webp',
   'The back of the Pineapple Haze tee, with the embroidered bud between the shoulders',
   'detail', 1, 'Back', 1600, 2000),
  ('product-01-tee', '/images/pineapple-haze-shirt-cutout.png',
   'The Pineapple Haze tee, laid flat', 'fabric', 2, 'The piece', 1152, 1366),
  ('product-01-tee', '/images/drop-01/worn-2400.webp',
   'Two people in the Pineapple Haze tee, one turned to show the back',
   'worn', 3, 'Worn', 2400, 1946),
  ('product-01-tee', '/images/drop-01/sitting-1600.webp',
   'Sitting on the studio floor in the Pineapple Haze tee and brown cargo trousers',
   'detail', 4, 'Sitting', 1600, 2000),
  ('product-01-tee', '/images/drop-01/pair-1600.webp',
   'The tee from the front and from the back, worn side by side',
   'detail', 5, 'Front and back', 1600, 1000),
  ('product-01-tee', '/images/drop-01/floor-1600.webp',
   'Leaning back on one arm in the Pineapple Haze tee', 'detail', 6, 'At ease', 1600, 1600),
  ('product-01-tee', '/images/drop-01/standing-1600.webp',
   'The Pineapple Haze tee worn loose over brown cargo trousers',
   'detail', 7, 'Worn loose', 1600, 2000),
  ('product-01-tee', '/images/drop-01/seated-1600.webp',
   'Two people in the Pineapple Haze tee, one seated', 'detail', 8, 'In pairs', 1600, 2000),
  ('product-01-tee', '/images/drop-01/duo-1600.webp',
   'Two people standing in the Pineapple Haze tee', 'detail', 9, 'Together', 1600, 2000),
  ('product-01-tee', '/images/drop-01/full-1600.webp',
   'Full length in the Pineapple Haze tee, one hand at the hem', 'detail', 10, 'Full length', 1600, 2000);
