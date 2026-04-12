-- =============================================================
-- Product seed script
-- Rebuilds the full catalog with variant-aware images.
-- Every product has at least 2 images.
-- Multi-color products have dedicated images per color variant.
-- =============================================================

DO $$
DECLARE
  -- Categories
  cat_outerwear UUID;
  cat_tops UUID;
  cat_trousers UUID;
  cat_footwear UUID;
  cat_bags UUID;
  cat_accessories UUID;

  -- Products
  p_alpine_puffer UUID;
  p_utility_overshirt UUID;
  p_essential_tee UUID;
  p_pleated_trousers UUID;
  p_horizon_runner UUID;
  p_transit_backpack UUID;
  p_merino_beanie UUID;
  p_studio_hoodie UUID;

  -- Variant ids used for color-specific images
  v_ap_midnight UUID;
  v_ap_sand UUID;
  v_uo_olive UUID;
  v_uo_graphite UUID;
  v_et_white UUID;
  v_et_black UUID;
  v_et_sky UUID;
  v_pt_charcoal UUID;
  v_pt_stone UUID;
  v_hr_white UUID;
  v_hr_black UUID;
  v_tb_black UUID;
  v_tb_moss UUID;
  v_mb_navy UUID;
  v_mb_rust UUID;
  v_sh_ash UUID;
  v_sh_forest UUID;

  s TEXT;
BEGIN
  -- Cleanup (FK-safe order)
  DELETE FROM return_items;
  DELETE FROM returns;
  DELETE FROM review_helpful_votes;
  DELETE FROM review_replies;
  DELETE FROM reviews;
  DELETE FROM ai_outfit_suggestion_items;
  DELETE FROM ai_outfit_suggestions;
  DELETE FROM cart_items;
  DELETE FROM wishlists;
  DELETE FROM order_items;
  DELETE FROM discounts;
  DELETE FROM product_images;
  DELETE FROM product_tags;
  DELETE FROM product_variants;
  DELETE FROM products;
  DELETE FROM categories;
  DELETE FROM tags;

  -- Categories
  INSERT INTO categories (name, slug, description, sort_order, is_active)
  VALUES ('Outerwear', 'outerwear', 'Jackets and outer layers for every season', 1, true)
  RETURNING id INTO cat_outerwear;

  INSERT INTO categories (name, slug, description, sort_order, is_active)
  VALUES ('Tops', 'tops', 'T-shirts, hoodies and everyday essentials', 2, true)
  RETURNING id INTO cat_tops;

  INSERT INTO categories (name, slug, description, sort_order, is_active)
  VALUES ('Trousers', 'trousers', 'Tailored and casual bottoms', 3, true)
  RETURNING id INTO cat_trousers;

  INSERT INTO categories (name, slug, description, sort_order, is_active)
  VALUES ('Footwear', 'footwear', 'Sneakers and shoes', 4, true)
  RETURNING id INTO cat_footwear;

  INSERT INTO categories (name, slug, description, sort_order, is_active)
  VALUES ('Bags', 'bags', 'Backpacks and travel bags', 5, true)
  RETURNING id INTO cat_bags;

  INSERT INTO categories (name, slug, description, sort_order, is_active)
  VALUES ('Accessories', 'accessories', 'Small essentials to complete outfits', 6, true)
  RETURNING id INTO cat_accessories;

  -- Tags
  INSERT INTO tags (name, slug) VALUES
    ('New Arrival', 'new-arrival'),
    ('Featured', 'featured'),
    ('Bestseller', 'bestseller'),
    ('Limited', 'limited'),
    ('Sustainable', 'sustainable');

  -- ==========================================================
  -- P01 Alpine Puffer Jacket
  -- ==========================================================
  INSERT INTO products (
    category_id, name, slug, description, short_desc, brand, base_price,
    is_active, is_featured, is_new_arrival, weight_grams
  ) VALUES (
    cat_outerwear,
    'Alpine Puffer Jacket',
    'alpine-puffer-jacket',
    'Technical puffer jacket with recycled insulation and weather-resistant shell. Built for cold city days and weekend escapes.',
    'Technical insulated puffer with a clean silhouette.',
    'Northline Studio',
    229.00,
    true, true, true, 1150
  ) RETURNING id INTO p_alpine_puffer;

  INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
  VALUES (p_alpine_puffer, 'NL-APJ-MID-M', 'M', 'Midnight', '#1f2937', 18)
  RETURNING id INTO v_ap_midnight;

  FOREACH s IN ARRAY ARRAY['S','L','XL']::TEXT[] LOOP
    INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
    VALUES (p_alpine_puffer, 'NL-APJ-MID-' || s, s, 'Midnight', '#1f2937', 14);
  END LOOP;

  INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
  VALUES (p_alpine_puffer, 'NL-APJ-SND-M', 'M', 'Sand', '#cfb991', 12)
  RETURNING id INTO v_ap_sand;

  FOREACH s IN ARRAY ARRAY['S','L','XL']::TEXT[] LOOP
    INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
    VALUES (p_alpine_puffer, 'NL-APJ-SND-' || s, s, 'Sand', '#cfb991', 10);
  END LOOP;

  INSERT INTO product_images (product_id, variant_id, url, alt_text, sort_order, is_cover) VALUES
    (p_alpine_puffer, v_ap_midnight, 'https://dummyimage.com/900x1200/1f2937/f3f4f6&text=Alpine+Puffer+Midnight+Front', 'Alpine Puffer Jacket midnight front', 0, true),
    (p_alpine_puffer, v_ap_midnight, 'https://dummyimage.com/900x1200/111827/f9fafb&text=Alpine+Puffer+Midnight+Detail', 'Alpine Puffer Jacket midnight detail', 1, false),
    (p_alpine_puffer, v_ap_sand, 'https://dummyimage.com/900x1200/cfb991/1f2937&text=Alpine+Puffer+Sand+Front', 'Alpine Puffer Jacket sand front', 2, true),
    (p_alpine_puffer, v_ap_sand, 'https://dummyimage.com/900x1200/b89f77/111827&text=Alpine+Puffer+Sand+Detail', 'Alpine Puffer Jacket sand detail', 3, false);

  INSERT INTO discounts (product_id, type, value, label, is_active)
  VALUES (p_alpine_puffer, 'percentage', 10.00, 'Spring Drop', true);

  INSERT INTO product_tags (product_id, tag_id)
  SELECT p_alpine_puffer, id FROM tags WHERE slug IN ('new-arrival', 'featured');

  -- ==========================================================
  -- P02 Utility Overshirt
  -- ==========================================================
  INSERT INTO products (
    category_id, name, slug, description, short_desc, brand, base_price,
    is_active, is_featured, is_new_arrival, weight_grams
  ) VALUES (
    cat_outerwear,
    'Utility Overshirt',
    'utility-overshirt',
    'Structured overshirt with dual chest pockets and matte snap buttons. Designed as a lightweight transitional layer.',
    'Structured overshirt with workwear details.',
    'Northline Studio',
    149.00,
    true, true, false, 720
  ) RETURNING id INTO p_utility_overshirt;

  INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
  VALUES (p_utility_overshirt, 'NL-UOS-OLV-M', 'M', 'Olive', '#5a6b3d', 20)
  RETURNING id INTO v_uo_olive;

  FOREACH s IN ARRAY ARRAY['S','L','XL']::TEXT[] LOOP
    INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
    VALUES (p_utility_overshirt, 'NL-UOS-OLV-' || s, s, 'Olive', '#5a6b3d', 16);
  END LOOP;

  INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
  VALUES (p_utility_overshirt, 'NL-UOS-GRP-M', 'M', 'Graphite', '#4b5563', 18)
  RETURNING id INTO v_uo_graphite;

  FOREACH s IN ARRAY ARRAY['S','L','XL']::TEXT[] LOOP
    INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
    VALUES (p_utility_overshirt, 'NL-UOS-GRP-' || s, s, 'Graphite', '#4b5563', 15);
  END LOOP;

  INSERT INTO product_images (product_id, variant_id, url, alt_text, sort_order, is_cover) VALUES
    (p_utility_overshirt, v_uo_olive, 'https://dummyimage.com/900x1200/5a6b3d/f3f4f6&text=Utility+Overshirt+Olive+Front', 'Utility Overshirt olive front', 0, true),
    (p_utility_overshirt, v_uo_olive, 'https://dummyimage.com/900x1200/4d5c34/f9fafb&text=Utility+Overshirt+Olive+Back', 'Utility Overshirt olive back', 1, false),
    (p_utility_overshirt, v_uo_graphite, 'https://dummyimage.com/900x1200/4b5563/f9fafb&text=Utility+Overshirt+Graphite+Front', 'Utility Overshirt graphite front', 2, true),
    (p_utility_overshirt, v_uo_graphite, 'https://dummyimage.com/900x1200/374151/f3f4f6&text=Utility+Overshirt+Graphite+Back', 'Utility Overshirt graphite back', 3, false);

  INSERT INTO product_tags (product_id, tag_id)
  SELECT p_utility_overshirt, id FROM tags WHERE slug IN ('featured', 'bestseller');

  -- ==========================================================
  -- P03 Essential Heavy Tee
  -- ==========================================================
  INSERT INTO products (
    category_id, name, slug, description, short_desc, brand, base_price,
    is_active, is_featured, is_new_arrival, weight_grams
  ) VALUES (
    cat_tops,
    'Essential Heavy Tee',
    'essential-heavy-tee',
    '240gsm cotton jersey t-shirt with a relaxed cut and reinforced neck rib. A premium daily base layer.',
    'Heavyweight cotton tee with relaxed fit.',
    'Northline Studio',
    49.00,
    true, false, true, 280
  ) RETURNING id INTO p_essential_tee;

  INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
  VALUES (p_essential_tee, 'NL-EHT-WHT-M', 'M', 'White', '#f5f5f5', 35)
  RETURNING id INTO v_et_white;
  FOREACH s IN ARRAY ARRAY['S','L','XL']::TEXT[] LOOP
    INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
    VALUES (p_essential_tee, 'NL-EHT-WHT-' || s, s, 'White', '#f5f5f5', 30);
  END LOOP;

  INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
  VALUES (p_essential_tee, 'NL-EHT-BLK-M', 'M', 'Black', '#111111', 28)
  RETURNING id INTO v_et_black;
  FOREACH s IN ARRAY ARRAY['S','L','XL']::TEXT[] LOOP
    INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
    VALUES (p_essential_tee, 'NL-EHT-BLK-' || s, s, 'Black', '#111111', 26);
  END LOOP;

  INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
  VALUES (p_essential_tee, 'NL-EHT-SKY-M', 'M', 'Sky', '#a8c5e3', 22)
  RETURNING id INTO v_et_sky;
  FOREACH s IN ARRAY ARRAY['S','L','XL']::TEXT[] LOOP
    INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
    VALUES (p_essential_tee, 'NL-EHT-SKY-' || s, s, 'Sky', '#a8c5e3', 20);
  END LOOP;

  INSERT INTO product_images (product_id, variant_id, url, alt_text, sort_order, is_cover) VALUES
    (p_essential_tee, v_et_white, 'https://dummyimage.com/900x1200/f5f5f5/111827&text=Heavy+Tee+White+Front', 'Essential Heavy Tee white front', 0, true),
    (p_essential_tee, v_et_white, 'https://dummyimage.com/900x1200/e5e7eb/1f2937&text=Heavy+Tee+White+Back', 'Essential Heavy Tee white back', 1, false),
    (p_essential_tee, v_et_black, 'https://dummyimage.com/900x1200/111111/f9fafb&text=Heavy+Tee+Black+Front', 'Essential Heavy Tee black front', 2, true),
    (p_essential_tee, v_et_black, 'https://dummyimage.com/900x1200/1f2937/f3f4f6&text=Heavy+Tee+Black+Back', 'Essential Heavy Tee black back', 3, false),
    (p_essential_tee, v_et_sky, 'https://dummyimage.com/900x1200/a8c5e3/111827&text=Heavy+Tee+Sky+Front', 'Essential Heavy Tee sky front', 4, true),
    (p_essential_tee, v_et_sky, 'https://dummyimage.com/900x1200/91b5d8/1f2937&text=Heavy+Tee+Sky+Back', 'Essential Heavy Tee sky back', 5, false);

  INSERT INTO product_tags (product_id, tag_id)
  SELECT p_essential_tee, id FROM tags WHERE slug IN ('new-arrival', 'sustainable');

  -- ==========================================================
  -- P04 Pleated Wool Trousers
  -- ==========================================================
  INSERT INTO products (
    category_id, name, slug, description, short_desc, brand, base_price,
    is_active, is_featured, is_new_arrival, weight_grams
  ) VALUES (
    cat_trousers,
    'Pleated Wool Trousers',
    'pleated-wool-trousers',
    'High-rise pleated trousers in wool blend with a tapered leg and clean front closure. Smart and versatile.',
    'Pleated wool-blend trousers with tapered leg.',
    'Northline Studio',
    139.00,
    true, false, false, 510
  ) RETURNING id INTO p_pleated_trousers;

  INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
  VALUES (p_pleated_trousers, 'NL-PWT-CHR-32', '32', 'Charcoal', '#4a4a4a', 20)
  RETURNING id INTO v_pt_charcoal;
  FOREACH s IN ARRAY ARRAY['30','34','36']::TEXT[] LOOP
    INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
    VALUES (p_pleated_trousers, 'NL-PWT-CHR-' || s, s, 'Charcoal', '#4a4a4a', 16);
  END LOOP;

  INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
  VALUES (p_pleated_trousers, 'NL-PWT-STN-32', '32', 'Stone', '#c7b8a3', 14)
  RETURNING id INTO v_pt_stone;
  FOREACH s IN ARRAY ARRAY['30','34','36']::TEXT[] LOOP
    INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
    VALUES (p_pleated_trousers, 'NL-PWT-STN-' || s, s, 'Stone', '#c7b8a3', 12);
  END LOOP;

  INSERT INTO product_images (product_id, variant_id, url, alt_text, sort_order, is_cover) VALUES
    (p_pleated_trousers, v_pt_charcoal, 'https://dummyimage.com/900x1200/4a4a4a/f9fafb&text=Pleated+Trousers+Charcoal+Front', 'Pleated Wool Trousers charcoal front', 0, true),
    (p_pleated_trousers, v_pt_charcoal, 'https://dummyimage.com/900x1200/3f3f46/f3f4f6&text=Pleated+Trousers+Charcoal+Side', 'Pleated Wool Trousers charcoal side', 1, false),
    (p_pleated_trousers, v_pt_stone, 'https://dummyimage.com/900x1200/c7b8a3/111827&text=Pleated+Trousers+Stone+Front', 'Pleated Wool Trousers stone front', 2, true),
    (p_pleated_trousers, v_pt_stone, 'https://dummyimage.com/900x1200/b5a48b/1f2937&text=Pleated+Trousers+Stone+Side', 'Pleated Wool Trousers stone side', 3, false);

  INSERT INTO product_tags (product_id, tag_id)
  SELECT p_pleated_trousers, id FROM tags WHERE slug IN ('featured', 'limited');

  -- ==========================================================
  -- P05 Horizon Runner Sneakers
  -- ==========================================================
  INSERT INTO products (
    category_id, name, slug, description, short_desc, brand, base_price,
    is_active, is_featured, is_new_arrival, weight_grams
  ) VALUES (
    cat_footwear,
    'Horizon Runner Sneakers',
    'horizon-runner-sneakers',
    'Lightweight runner with responsive foam midsole and breathable upper. Built for long days and daily movement.',
    'Lightweight runner sneakers with breathable upper.',
    'Northline Studio',
    159.00,
    true, true, false, 760
  ) RETURNING id INTO p_horizon_runner;

  INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
  VALUES (p_horizon_runner, 'NL-HRS-WHT-42', '42', 'White', '#f3f4f6', 18)
  RETURNING id INTO v_hr_white;
  FOREACH s IN ARRAY ARRAY['40','41','43','44']::TEXT[] LOOP
    INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
    VALUES (p_horizon_runner, 'NL-HRS-WHT-' || s, s, 'White', '#f3f4f6', 14);
  END LOOP;

  INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
  VALUES (p_horizon_runner, 'NL-HRS-BLK-42', '42', 'Black', '#111827', 16)
  RETURNING id INTO v_hr_black;
  FOREACH s IN ARRAY ARRAY['40','41','43','44']::TEXT[] LOOP
    INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
    VALUES (p_horizon_runner, 'NL-HRS-BLK-' || s, s, 'Black', '#111827', 12);
  END LOOP;

  INSERT INTO product_images (product_id, variant_id, url, alt_text, sort_order, is_cover) VALUES
    (p_horizon_runner, v_hr_white, 'https://dummyimage.com/900x1200/f3f4f6/111827&text=Horizon+Runner+White+Angle', 'Horizon Runner Sneakers white angle', 0, true),
    (p_horizon_runner, v_hr_white, 'https://dummyimage.com/900x1200/e5e7eb/1f2937&text=Horizon+Runner+White+Sole', 'Horizon Runner Sneakers white sole', 1, false),
    (p_horizon_runner, v_hr_black, 'https://dummyimage.com/900x1200/111827/f9fafb&text=Horizon+Runner+Black+Angle', 'Horizon Runner Sneakers black angle', 2, true),
    (p_horizon_runner, v_hr_black, 'https://dummyimage.com/900x1200/1f2937/f3f4f6&text=Horizon+Runner+Black+Sole', 'Horizon Runner Sneakers black sole', 3, false);

  INSERT INTO product_tags (product_id, tag_id)
  SELECT p_horizon_runner, id FROM tags WHERE slug IN ('bestseller', 'featured');

  -- ==========================================================
  -- P06 Transit Backpack
  -- ==========================================================
  INSERT INTO products (
    category_id, name, slug, description, short_desc, brand, base_price,
    is_active, is_featured, is_new_arrival, weight_grams
  ) VALUES (
    cat_bags,
    'Transit Backpack',
    'transit-backpack',
    '22L backpack with padded laptop sleeve, water-resistant coating, and modular interior pockets.',
    '22L commuter backpack with laptop sleeve.',
    'Northline Studio',
    119.00,
    true, false, true, 890
  ) RETURNING id INTO p_transit_backpack;

  INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
  VALUES (p_transit_backpack, 'NL-TBP-BLK-ONE', 'ONE', 'Black', '#171717', 30)
  RETURNING id INTO v_tb_black;

  INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
  VALUES (p_transit_backpack, 'NL-TBP-MOS-ONE', 'ONE', 'Moss', '#56634d', 24)
  RETURNING id INTO v_tb_moss;

  INSERT INTO product_images (product_id, variant_id, url, alt_text, sort_order, is_cover) VALUES
    (p_transit_backpack, v_tb_black, 'https://dummyimage.com/900x1200/171717/f9fafb&text=Transit+Backpack+Black+Front', 'Transit Backpack black front', 0, true),
    (p_transit_backpack, v_tb_black, 'https://dummyimage.com/900x1200/262626/f3f4f6&text=Transit+Backpack+Black+Open', 'Transit Backpack black open view', 1, false),
    (p_transit_backpack, v_tb_moss, 'https://dummyimage.com/900x1200/56634d/f9fafb&text=Transit+Backpack+Moss+Front', 'Transit Backpack moss front', 2, true),
    (p_transit_backpack, v_tb_moss, 'https://dummyimage.com/900x1200/495640/f3f4f6&text=Transit+Backpack+Moss+Open', 'Transit Backpack moss open view', 3, false);

  INSERT INTO product_tags (product_id, tag_id)
  SELECT p_transit_backpack, id FROM tags WHERE slug IN ('new-arrival', 'sustainable');

  -- ==========================================================
  -- P07 Merino Beanie
  -- ==========================================================
  INSERT INTO products (
    category_id, name, slug, description, short_desc, brand, base_price,
    is_active, is_featured, is_new_arrival, weight_grams
  ) VALUES (
    cat_accessories,
    'Merino Beanie',
    'merino-beanie',
    'Soft rib-knit beanie made from merino blend yarn for warmth without bulk.',
    'Rib-knit merino beanie.',
    'Northline Studio',
    39.00,
    true, false, false, 120
  ) RETURNING id INTO p_merino_beanie;

  INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
  VALUES (p_merino_beanie, 'NL-MBN-NVY-ONE', 'ONE', 'Navy', '#1e3a5f', 35)
  RETURNING id INTO v_mb_navy;

  INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
  VALUES (p_merino_beanie, 'NL-MBN-RST-ONE', 'ONE', 'Rust', '#b05f3c', 28)
  RETURNING id INTO v_mb_rust;

  INSERT INTO product_images (product_id, variant_id, url, alt_text, sort_order, is_cover) VALUES
    (p_merino_beanie, v_mb_navy, 'https://dummyimage.com/900x1200/1e3a5f/f9fafb&text=Merino+Beanie+Navy+Front', 'Merino Beanie navy front', 0, true),
    (p_merino_beanie, v_mb_navy, 'https://dummyimage.com/900x1200/1d3557/f3f4f6&text=Merino+Beanie+Navy+Fold', 'Merino Beanie navy folded', 1, false),
    (p_merino_beanie, v_mb_rust, 'https://dummyimage.com/900x1200/b05f3c/f9fafb&text=Merino+Beanie+Rust+Front', 'Merino Beanie rust front', 2, true),
    (p_merino_beanie, v_mb_rust, 'https://dummyimage.com/900x1200/9a4f31/f3f4f6&text=Merino+Beanie+Rust+Fold', 'Merino Beanie rust folded', 3, false);

  INSERT INTO product_tags (product_id, tag_id)
  SELECT p_merino_beanie, id FROM tags WHERE slug IN ('bestseller');

  -- ==========================================================
  -- P08 Studio Hoodie
  -- ==========================================================
  INSERT INTO products (
    category_id, name, slug, description, short_desc, brand, base_price,
    is_active, is_featured, is_new_arrival, weight_grams
  ) VALUES (
    cat_tops,
    'Studio Hoodie',
    'studio-hoodie',
    'Heavy fleece hoodie with dropped shoulders, double-lined hood and clean minimal branding.',
    'Heavy fleece hoodie with oversized cut.',
    'Northline Studio',
    99.00,
    true, true, true, 640
  ) RETURNING id INTO p_studio_hoodie;

  INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
  VALUES (p_studio_hoodie, 'NL-SHD-ASH-M', 'M', 'Ash', '#d1d5db', 24)
  RETURNING id INTO v_sh_ash;
  FOREACH s IN ARRAY ARRAY['S','L','XL']::TEXT[] LOOP
    INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
    VALUES (p_studio_hoodie, 'NL-SHD-ASH-' || s, s, 'Ash', '#d1d5db', 20);
  END LOOP;

  INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
  VALUES (p_studio_hoodie, 'NL-SHD-FOR-M', 'M', 'Forest', '#2f4f3f', 20)
  RETURNING id INTO v_sh_forest;
  FOREACH s IN ARRAY ARRAY['S','L','XL']::TEXT[] LOOP
    INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
    VALUES (p_studio_hoodie, 'NL-SHD-FOR-' || s, s, 'Forest', '#2f4f3f', 16);
  END LOOP;

  INSERT INTO product_images (product_id, variant_id, url, alt_text, sort_order, is_cover) VALUES
    (p_studio_hoodie, v_sh_ash, 'https://dummyimage.com/900x1200/d1d5db/111827&text=Studio+Hoodie+Ash+Front', 'Studio Hoodie ash front', 0, true),
    (p_studio_hoodie, v_sh_ash, 'https://dummyimage.com/900x1200/bfc4cc/1f2937&text=Studio+Hoodie+Ash+Back', 'Studio Hoodie ash back', 1, false),
    (p_studio_hoodie, v_sh_forest, 'https://dummyimage.com/900x1200/2f4f3f/f9fafb&text=Studio+Hoodie+Forest+Front', 'Studio Hoodie forest front', 2, true),
    (p_studio_hoodie, v_sh_forest, 'https://dummyimage.com/900x1200/274336/f3f4f6&text=Studio+Hoodie+Forest+Back', 'Studio Hoodie forest back', 3, false);

  INSERT INTO discounts (product_id, type, value, label, is_active)
  VALUES (p_studio_hoodie, 'percentage', 15.00, 'Launch Offer', true);

  INSERT INTO product_tags (product_id, tag_id)
  SELECT p_studio_hoodie, id FROM tags WHERE slug IN ('featured', 'new-arrival', 'limited');

  RAISE NOTICE 'Seed complete: 8 products loaded with variant-specific images.';
END $$;
