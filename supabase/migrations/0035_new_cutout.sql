-- Drop 01's laid-flat cutout is the new studio render (front), replacing the
-- old tan PNG. Same image role ("fabric"), new file and pixel size.
update public.product_images
   set url = '/images/drop-01/tee-cutout-front.webp',
       width = 1152,
       height = 1254,
       alt = 'The Pineapple Haze tee, laid flat: the script and the tree embroidered on the chest'
 where product_id = 'product-01-tee'
   and url = '/images/pineapple-haze-shirt-cutout.png';
