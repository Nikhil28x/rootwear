-- The Drop 01 back photograph is now a 5:4 landscape crop (head to the base of
-- the embroidery) so the homepage cover frames it like the front. The file
-- keeps its name; only its recorded pixel size changes.
update public.product_images
   set width = 1600, height = 1280
 where product_id = 'product-01-tee'
   and url = '/images/drop-01/back-1600.webp';
