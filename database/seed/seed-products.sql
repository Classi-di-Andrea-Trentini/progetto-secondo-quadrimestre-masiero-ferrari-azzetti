-- =============================================================
-- Common Era — Product Seed Script
-- Clears all product-related data and inserts a fresh catalog
-- of 12 coherent fashion products with Unsplash imagery.
--
-- Usage:
--   docker compose exec -T db psql -U user -d mydb < database/seed/seed-products.sql
-- =============================================================

DO $$
DECLARE
  -- Category IDs
  cat_outerwear    UUID;
  cat_knitwear     UUID;
  cat_tops         UUID;
  cat_trousers     UUID;
  cat_footwear     UUID;
  cat_bags         UUID;
  cat_accessories  UUID;

  -- Product IDs
  p_wool_overcoat       UUID;
  p_field_jacket        UUID;
  p_essential_crewneck  UUID;
  p_relaxed_hoodie      UUID;
  p_slim_chino          UUID;
  p_classic_tee         UUID;
  p_canvas_sneaker      UUID;
  p_chelsea_boot        UUID;
  p_structured_tote     UUID;
  p_ribbed_beanie       UUID;
  p_cashmere_scarf      UUID;
  p_leather_belt        UUID;

  s TEXT; -- size loop variable

BEGIN

  -- ─────────────────────────────────────────────────────────────
  -- 1. CLEANUP  (FK-safe order)
  --    Must delete dependents before parents to avoid RESTRICT errors
  -- ─────────────────────────────────────────────────────────────
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

  RAISE NOTICE 'Cleanup done.';

  -- ─────────────────────────────────────────────────────────────
  -- 2. CATEGORIES
  -- ─────────────────────────────────────────────────────────────
  INSERT INTO categories (name, slug, description, sort_order, is_active)
    VALUES ('Outerwear', 'outerwear', 'Coats and jackets for every season', 1, true)
    RETURNING id INTO cat_outerwear;

  INSERT INTO categories (name, slug, description, sort_order, is_active)
    VALUES ('Knitwear & Sweatshirts', 'knitwear-sweatshirts', 'Crewnecks, hoodies and knitwear essentials', 2, true)
    RETURNING id INTO cat_knitwear;

  INSERT INTO categories (name, slug, description, sort_order, is_active)
    VALUES ('Tops', 'tops', 'T-shirts and lightweight tops', 3, true)
    RETURNING id INTO cat_tops;

  INSERT INTO categories (name, slug, description, sort_order, is_active)
    VALUES ('Trousers', 'trousers', 'Tailored trousers and relaxed chinos', 4, true)
    RETURNING id INTO cat_trousers;

  INSERT INTO categories (name, slug, description, sort_order, is_active)
    VALUES ('Footwear', 'footwear', 'Sneakers and boots for every occasion', 5, true)
    RETURNING id INTO cat_footwear;

  INSERT INTO categories (name, slug, description, sort_order, is_active)
    VALUES ('Bags', 'bags', 'Totes, shoulder bags and everyday carry', 6, true)
    RETURNING id INTO cat_bags;

  INSERT INTO categories (name, slug, description, sort_order, is_active)
    VALUES ('Accessories', 'accessories', 'Beanies, scarves, belts and more', 7, true)
    RETURNING id INTO cat_accessories;

  -- ─────────────────────────────────────────────────────────────
  -- 3. TAGS
  -- ─────────────────────────────────────────────────────────────
  INSERT INTO tags (name, slug) VALUES
    ('New Arrival',  'new-arrival'),
    ('Featured',     'featured'),
    ('Sale',         'sale'),
    ('Bestseller',   'bestseller'),
    ('Sustainable',  'sustainable');

  RAISE NOTICE 'Categories and tags created.';

  -- ══════════════════════════════════════════════════════════════
  -- PRODUCTS
  -- ══════════════════════════════════════════════════════════════

  -- ─────────────────────────────────────────────────────────────
  -- P01 · Wool Overcoat
  --       Outerwear | €295 | isFeatured + isNewArrival | -15%
  --       Colors: Black, Camel  |  Sizes: XS–XL
  -- ─────────────────────────────────────────────────────────────
  INSERT INTO products (
    category_id, name, slug,
    description, short_desc, brand, base_price,
    is_active, is_featured, is_new_arrival, weight_grams
  ) VALUES (
    cat_outerwear,
    'Wool Overcoat',
    'wool-overcoat',
    'A timeless silhouette crafted from a premium wool-cashmere blend. Featuring a clean notched lapel, hidden button closure and two flap pockets. Fully lined in smooth viscose for a refined drape and warmth throughout the season.',
    'Premium wool-cashmere overcoat with clean tailored lines.',
    'Common Era', 295.00,
    true, true, true, 1400
  ) RETURNING id INTO p_wool_overcoat;

  FOREACH s IN ARRAY ARRAY['XS','S','M','L','XL']::TEXT[] LOOP
    INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
    VALUES (p_wool_overcoat, 'CE-WOC-BLK-' || s, s, 'Black', '#1a1a1a', 12);
  END LOOP;
  FOREACH s IN ARRAY ARRAY['XS','S','M','L','XL']::TEXT[] LOOP
    INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
    VALUES (p_wool_overcoat, 'CE-WOC-CAM-' || s, s, 'Camel', '#c4956a', 8);
  END LOOP;

  INSERT INTO product_images (product_id, url, alt_text, sort_order, is_cover) VALUES
    (p_wool_overcoat, 'https://images.unsplash.com/photo-1539178253664-bbe85a87f32c?w=800&q=80&auto=format&fit=crop', 'Wool Overcoat – Black front view', 0, true),
    (p_wool_overcoat, 'https://images.unsplash.com/photo-1617137968427-85924c800a22?w=800&q=80&auto=format&fit=crop', 'Wool Overcoat – side silhouette', 1, false),
    (p_wool_overcoat, 'https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?w=800&q=80&auto=format&fit=crop', 'Wool Overcoat – lifestyle shot', 2, false),
    (p_wool_overcoat, 'https://images.unsplash.com/photo-1594938298603-c8148c4b4d58?w=800&q=80&auto=format&fit=crop', 'Wool Overcoat – fabric detail', 3, false);

  INSERT INTO discounts (product_id, type, value, label, is_active)
  VALUES (p_wool_overcoat, 'percentage', 15.00, 'Seasonal Sale', true);

  INSERT INTO product_tags (product_id, tag_id)
  SELECT p_wool_overcoat, id FROM tags WHERE slug IN ('new-arrival', 'sale', 'featured');


  -- ─────────────────────────────────────────────────────────────
  -- P02 · Field Jacket
  --       Outerwear | €189 | isFeatured
  --       Colors: Black, Olive  |  Sizes: S–XL
  -- ─────────────────────────────────────────────────────────────
  INSERT INTO products (
    category_id, name, slug,
    description, short_desc, brand, base_price,
    is_active, is_featured, is_new_arrival, weight_grams
  ) VALUES (
    cat_outerwear,
    'Field Jacket',
    'field-jacket',
    'A utilitarian silhouette reimagined in a durable cotton-nylon blend. Four front patch pockets, adjustable cuffs and a concealed zip-and-snap closure. Unlined for versatile layering throughout the seasons.',
    'Utilitarian field jacket in cotton-nylon blend with four pockets.',
    'Common Era', 189.00,
    true, true, false, 900
  ) RETURNING id INTO p_field_jacket;

  FOREACH s IN ARRAY ARRAY['S','M','L','XL']::TEXT[] LOOP
    INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
    VALUES (p_field_jacket, 'CE-FJ-BLK-' || s, s, 'Black', '#1a1a1a', 10);
  END LOOP;
  FOREACH s IN ARRAY ARRAY['S','M','L','XL']::TEXT[] LOOP
    INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
    VALUES (p_field_jacket, 'CE-FJ-OLV-' || s, s, 'Olive', '#556b2f', 10);
  END LOOP;

  INSERT INTO product_images (product_id, url, alt_text, sort_order, is_cover) VALUES
    (p_field_jacket, 'https://images.unsplash.com/photo-1548126032-079a0fb0099d?w=800&q=80&auto=format&fit=crop', 'Field Jacket – front view', 0, true),
    (p_field_jacket, 'https://images.unsplash.com/photo-1490578474895-699cd4e2cf59?w=800&q=80&auto=format&fit=crop', 'Field Jacket – back detail', 1, false),
    (p_field_jacket, 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800&q=80&auto=format&fit=crop', 'Field Jacket – pocket detail', 2, false);

  INSERT INTO product_tags (product_id, tag_id)
  SELECT p_field_jacket, id FROM tags WHERE slug = 'featured';


  -- ─────────────────────────────────────────────────────────────
  -- P03 · Essential Crewneck
  --       Knitwear | €89 | bestseller
  --       Colors: Grey, Black, Ecru  |  Sizes: XS–XL
  -- ─────────────────────────────────────────────────────────────
  INSERT INTO products (
    category_id, name, slug,
    description, short_desc, brand, base_price,
    is_active, is_featured, is_new_arrival, weight_grams
  ) VALUES (
    cat_knitwear,
    'Essential Crewneck',
    'essential-crewneck',
    'Crafted from a mid-weight French terry cotton, this crewneck sweatshirt is designed for everyday wear. Ribbed cuffs and hem, set-in sleeves and a boxy relaxed fit make it the cornerstone of a minimal wardrobe.',
    'Mid-weight French terry crewneck in a relaxed boxy fit.',
    'Common Era', 89.00,
    true, false, false, 450
  ) RETURNING id INTO p_essential_crewneck;

  FOREACH s IN ARRAY ARRAY['XS','S','M','L','XL']::TEXT[] LOOP
    INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
    VALUES (p_essential_crewneck, 'CE-ECN-GRY-' || s, s, 'Grey', '#9e9e9e', 15);
  END LOOP;
  FOREACH s IN ARRAY ARRAY['XS','S','M','L','XL']::TEXT[] LOOP
    INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
    VALUES (p_essential_crewneck, 'CE-ECN-BLK-' || s, s, 'Black', '#1a1a1a', 15);
  END LOOP;
  FOREACH s IN ARRAY ARRAY['XS','S','M','L','XL']::TEXT[] LOOP
    INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
    VALUES (p_essential_crewneck, 'CE-ECN-ECR-' || s, s, 'Ecru', '#f5f0e8', 12);
  END LOOP;

  INSERT INTO product_images (product_id, url, alt_text, sort_order, is_cover) VALUES
    (p_essential_crewneck, 'https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=800&q=80&auto=format&fit=crop', 'Essential Crewneck – front view', 0, true),
    (p_essential_crewneck, 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&q=80&auto=format&fit=crop', 'Essential Crewneck – back view', 1, false),
    (p_essential_crewneck, 'https://images.unsplash.com/photo-1542327897-4141865083e3?w=800&q=80&auto=format&fit=crop', 'Essential Crewneck – lifestyle', 2, false);

  INSERT INTO product_tags (product_id, tag_id)
  SELECT p_essential_crewneck, id FROM tags WHERE slug = 'bestseller';


  -- ─────────────────────────────────────────────────────────────
  -- P04 · Relaxed Hoodie
  --       Knitwear | €115 | isNewArrival
  --       Colors: Off-White, Black  |  Sizes: XS–XL
  -- ─────────────────────────────────────────────────────────────
  INSERT INTO products (
    category_id, name, slug,
    description, short_desc, brand, base_price,
    is_active, is_featured, is_new_arrival, weight_grams
  ) VALUES (
    cat_knitwear,
    'Relaxed Hoodie',
    'relaxed-hoodie',
    'An oversized pull-over hoodie made from a heavyweight 400gsm loopback cotton. Double-lined hood, kangaroo pocket and dropped shoulders give it a distinctive silhouette. Garment-dyed for a lived-in appearance from day one.',
    'Heavyweight loopback cotton hoodie, garment-dyed, oversized fit.',
    'Common Era', 115.00,
    true, false, true, 600
  ) RETURNING id INTO p_relaxed_hoodie;

  FOREACH s IN ARRAY ARRAY['XS','S','M','L','XL']::TEXT[] LOOP
    INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
    VALUES (p_relaxed_hoodie, 'CE-RH-OFW-' || s, s, 'Off-White', '#f5f0e8', 10);
  END LOOP;
  FOREACH s IN ARRAY ARRAY['XS','S','M','L','XL']::TEXT[] LOOP
    INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
    VALUES (p_relaxed_hoodie, 'CE-RH-BLK-' || s, s, 'Black', '#1a1a1a', 10);
  END LOOP;

  INSERT INTO product_images (product_id, url, alt_text, sort_order, is_cover) VALUES
    (p_relaxed_hoodie, 'https://images.unsplash.com/photo-1578587048293-7a6f3b50c40d?w=800&q=80&auto=format&fit=crop', 'Relaxed Hoodie – front view', 0, true),
    (p_relaxed_hoodie, 'https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?w=800&q=80&auto=format&fit=crop', 'Relaxed Hoodie – back view', 1, false),
    (p_relaxed_hoodie, 'https://images.unsplash.com/photo-1564557287817-3785e38ec1f5?w=800&q=80&auto=format&fit=crop', 'Relaxed Hoodie – lifestyle', 2, false);

  INSERT INTO product_tags (product_id, tag_id)
  SELECT p_relaxed_hoodie, id FROM tags WHERE slug = 'new-arrival';


  -- ─────────────────────────────────────────────────────────────
  -- P05 · Slim Chino
  --       Trousers | €125 | isFeatured
  --       Colors: Navy, Camel, Charcoal  |  Sizes: 28–36
  -- ─────────────────────────────────────────────────────────────
  INSERT INTO products (
    category_id, name, slug,
    description, short_desc, brand, base_price,
    is_active, is_featured, is_new_arrival, weight_grams
  ) VALUES (
    cat_trousers,
    'Slim Chino',
    'slim-chino',
    'Slim-tapered chinos cut from a 98% cotton 2% elastane twill for structure with ease of movement. Clean flat front, mid-rise waist and tapered leg finishing above the ankle for a modern proportion.',
    'Slim-tapered cotton twill chino with clean flat front.',
    'Common Era', 125.00,
    true, true, false, 380
  ) RETURNING id INTO p_slim_chino;

  FOREACH s IN ARRAY ARRAY['28','30','32','34','36']::TEXT[] LOOP
    INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
    VALUES (p_slim_chino, 'CE-SC-NVY-' || s, s, 'Navy', '#1c2b4a', 12);
  END LOOP;
  FOREACH s IN ARRAY ARRAY['28','30','32','34','36']::TEXT[] LOOP
    INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
    VALUES (p_slim_chino, 'CE-SC-CAM-' || s, s, 'Camel', '#c4956a', 10);
  END LOOP;
  FOREACH s IN ARRAY ARRAY['28','30','32','34','36']::TEXT[] LOOP
    INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
    VALUES (p_slim_chino, 'CE-SC-CHR-' || s, s, 'Charcoal', '#3d3d3d', 10);
  END LOOP;

  INSERT INTO product_images (product_id, url, alt_text, sort_order, is_cover) VALUES
    (p_slim_chino, 'https://images.unsplash.com/photo-1473966968600-fa4cbed3a1ab?w=800&q=80&auto=format&fit=crop', 'Slim Chino – front view', 0, true),
    (p_slim_chino, 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=800&q=80&auto=format&fit=crop', 'Slim Chino – back view', 1, false),
    (p_slim_chino, 'https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=800&q=80&auto=format&fit=crop', 'Slim Chino – lifestyle', 2, false);

  INSERT INTO product_tags (product_id, tag_id)
  SELECT p_slim_chino, id FROM tags WHERE slug = 'featured';


  -- ─────────────────────────────────────────────────────────────
  -- P06 · Classic Tee
  --       Tops | €45 | isNewArrival + bestseller
  --       Colors: White, Black, Sage  |  Sizes: XS–XXL
  -- ─────────────────────────────────────────────────────────────
  INSERT INTO products (
    category_id, name, slug,
    description, short_desc, brand, base_price,
    is_active, is_featured, is_new_arrival, weight_grams
  ) VALUES (
    cat_tops,
    'Classic Tee',
    'classic-tee',
    'A foundational t-shirt cut from a 180gsm Supima cotton jersey. Slightly oversized boxy fit, reinforced crew neck and clean shoulder seams. Preshrunk and enzyme-washed for softness from the very first wear.',
    '180gsm Supima cotton jersey tee, boxy fit, enzyme-washed.',
    'Common Era', 45.00,
    true, false, true, 200
  ) RETURNING id INTO p_classic_tee;

  FOREACH s IN ARRAY ARRAY['XS','S','M','L','XL','XXL']::TEXT[] LOOP
    INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
    VALUES (p_classic_tee, 'CE-CT-WHT-' || s, s, 'White', '#ffffff', 20);
  END LOOP;
  FOREACH s IN ARRAY ARRAY['XS','S','M','L','XL','XXL']::TEXT[] LOOP
    INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
    VALUES (p_classic_tee, 'CE-CT-BLK-' || s, s, 'Black', '#1a1a1a', 20);
  END LOOP;
  FOREACH s IN ARRAY ARRAY['XS','S','M','L','XL','XXL']::TEXT[] LOOP
    INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
    VALUES (p_classic_tee, 'CE-CT-SGE-' || s, s, 'Sage', '#9caf88', 15);
  END LOOP;

  INSERT INTO product_images (product_id, url, alt_text, sort_order, is_cover) VALUES
    (p_classic_tee, 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&q=80&auto=format&fit=crop', 'Classic Tee – front view', 0, true),
    (p_classic_tee, 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=80&auto=format&fit=crop', 'Classic Tee – back view', 1, false),
    (p_classic_tee, 'https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=800&q=80&auto=format&fit=crop', 'Classic Tee – lifestyle', 2, false);

  INSERT INTO product_tags (product_id, tag_id)
  SELECT p_classic_tee, id FROM tags WHERE slug IN ('new-arrival', 'bestseller');


  -- ─────────────────────────────────────────────────────────────
  -- P07 · Canvas Low Sneaker
  --       Footwear | €135 | isFeatured + isNewArrival
  --       Colors: White, Black  |  Sizes: EU 38–44
  -- ─────────────────────────────────────────────────────────────
  INSERT INTO products (
    category_id, name, slug,
    description, short_desc, brand, base_price,
    is_active, is_featured, is_new_arrival, weight_grams
  ) VALUES (
    cat_footwear,
    'Canvas Low Sneaker',
    'canvas-low-sneaker',
    'A minimal low-top sneaker built on a vulcanized rubber sole. Upper in heavy-duty cotton canvas with a padded collar and OrthoLite insole. Metal eyelets, flat waxed laces, unbleached canvas lining. Lightweight and packable.',
    'Vulcanized canvas sneaker with OrthoLite insole, metal eyelets.',
    'Common Era', 135.00,
    true, true, true, 550
  ) RETURNING id INTO p_canvas_sneaker;

  FOREACH s IN ARRAY ARRAY['38','39','40','41','42','43','44']::TEXT[] LOOP
    INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
    VALUES (p_canvas_sneaker, 'CE-CLS-WHT-' || s, s, 'White', '#f5f5f5', 8);
  END LOOP;
  FOREACH s IN ARRAY ARRAY['38','39','40','41','42','43','44']::TEXT[] LOOP
    INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
    VALUES (p_canvas_sneaker, 'CE-CLS-BLK-' || s, s, 'Black', '#1a1a1a', 8);
  END LOOP;

  INSERT INTO product_images (product_id, url, alt_text, sort_order, is_cover) VALUES
    (p_canvas_sneaker, 'https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=800&q=80&auto=format&fit=crop', 'Canvas Low Sneaker – pair view', 0, true),
    (p_canvas_sneaker, 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=80&auto=format&fit=crop', 'Canvas Low Sneaker – side profile', 1, false),
    (p_canvas_sneaker, 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=800&q=80&auto=format&fit=crop', 'Canvas Low Sneaker – sole detail', 2, false);

  INSERT INTO product_tags (product_id, tag_id)
  SELECT p_canvas_sneaker, id FROM tags WHERE slug IN ('new-arrival', 'featured');


  -- ─────────────────────────────────────────────────────────────
  -- P08 · Chelsea Boot
  --       Footwear | €215 | isFeatured
  --       Colors: Black, Tobacco  |  Sizes: EU 38–44
  -- ─────────────────────────────────────────────────────────────
  INSERT INTO products (
    category_id, name, slug,
    description, short_desc, brand, base_price,
    is_active, is_featured, is_new_arrival, weight_grams
  ) VALUES (
    cat_footwear,
    'Chelsea Boot',
    'chelsea-boot',
    'A refined chelsea boot with a full-grain leather upper and elastic side gussets. Leather-lined with a leather-wrapped heel counter and Goodyear-welted construction for longevity and repairability. Rubber and leather stacked heel.',
    'Full-grain leather chelsea boot, Goodyear-welt, leather-lined.',
    'Common Era', 215.00,
    true, true, false, 750
  ) RETURNING id INTO p_chelsea_boot;

  FOREACH s IN ARRAY ARRAY['38','39','40','41','42','43','44']::TEXT[] LOOP
    INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
    VALUES (p_chelsea_boot, 'CE-CB-BLK-' || s, s, 'Black', '#1a1a1a', 6);
  END LOOP;
  FOREACH s IN ARRAY ARRAY['38','39','40','41','42','43','44']::TEXT[] LOOP
    INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
    VALUES (p_chelsea_boot, 'CE-CB-TOB-' || s, s, 'Tobacco', '#8b5e3c', 6);
  END LOOP;

  INSERT INTO product_images (product_id, url, alt_text, sort_order, is_cover) VALUES
    (p_chelsea_boot, 'https://images.unsplash.com/photo-1542228628-63fd06f1f98b?w=800&q=80&auto=format&fit=crop', 'Chelsea Boot – pair view', 0, true),
    (p_chelsea_boot, 'https://images.unsplash.com/photo-1460440458427-f0d9035fd4f7?w=800&q=80&auto=format&fit=crop', 'Chelsea Boot – side profile', 1, false),
    (p_chelsea_boot, 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800&q=80&auto=format&fit=crop', 'Chelsea Boot – sole detail', 2, false);

  INSERT INTO product_tags (product_id, tag_id)
  SELECT p_chelsea_boot, id FROM tags WHERE slug = 'featured';


  -- ─────────────────────────────────────────────────────────────
  -- P09 · Structured Tote
  --       Bags | €175 | isFeatured
  --       Colors: Black, Camel  |  Size: OS
  -- ─────────────────────────────────────────────────────────────
  INSERT INTO products (
    category_id, name, slug,
    description, short_desc, brand, base_price,
    is_active, is_featured, is_new_arrival, weight_grams
  ) VALUES (
    cat_bags,
    'Structured Tote',
    'structured-tote',
    'A clean architectural tote crafted from full-grain vegetable-tanned leather. Rigid frame with a top magnetic closure, interior zip pocket and two open slip pockets. Double shoulder handles with a 22cm drop. 38 x 28 x 14 cm.',
    'Vegetable-tanned leather tote with rigid frame and magnetic closure.',
    'Common Era', 175.00,
    true, true, false, 680
  ) RETURNING id INTO p_structured_tote;

  INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
  VALUES (p_structured_tote, 'CE-ST-BLK-OS', 'OS', 'Black', '#1a1a1a', 15);
  INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
  VALUES (p_structured_tote, 'CE-ST-CAM-OS', 'OS', 'Camel', '#c4956a', 12);

  INSERT INTO product_images (product_id, url, alt_text, sort_order, is_cover) VALUES
    (p_structured_tote, 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&q=80&auto=format&fit=crop', 'Structured Tote – front view', 0, true),
    (p_structured_tote, 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=800&q=80&auto=format&fit=crop', 'Structured Tote – side view', 1, false),
    (p_structured_tote, 'https://images.unsplash.com/photo-1553062407-98eeb64c6a91?w=800&q=80&auto=format&fit=crop', 'Structured Tote – interior detail', 2, false);

  INSERT INTO product_tags (product_id, tag_id)
  SELECT p_structured_tote, id FROM tags WHERE slug = 'featured';


  -- ─────────────────────────────────────────────────────────────
  -- P10 · Ribbed Beanie
  --       Accessories | €55 | bestseller
  --       Colors: Black, Grey, Ivory  |  Size: OS
  -- ─────────────────────────────────────────────────────────────
  INSERT INTO products (
    category_id, name, slug,
    description, short_desc, brand, base_price,
    is_active, is_featured, is_new_arrival, weight_grams
  ) VALUES (
    cat_accessories,
    'Ribbed Beanie',
    'ribbed-beanie',
    'A mid-weight ribbed beanie knitted from a merino-acrylic blend for softness and shape retention. 2x2 rib construction with a turned cuff and logo woven label at the back. One size fits most.',
    'Merino-acrylic ribbed beanie with turned cuff.',
    'Common Era', 55.00,
    true, false, false, 90
  ) RETURNING id INTO p_ribbed_beanie;

  INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
  VALUES (p_ribbed_beanie, 'CE-RB-BLK-OS', 'OS', 'Black', '#1a1a1a', 25);
  INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
  VALUES (p_ribbed_beanie, 'CE-RB-GRY-OS', 'OS', 'Grey', '#9e9e9e', 25);
  INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
  VALUES (p_ribbed_beanie, 'CE-RB-IVY-OS', 'OS', 'Ivory', '#fffff0', 20);

  INSERT INTO product_images (product_id, url, alt_text, sort_order, is_cover) VALUES
    (p_ribbed_beanie, 'https://images.unsplash.com/photo-1576871337632-b9aef4c17ab9?w=800&q=80&auto=format&fit=crop', 'Ribbed Beanie – worn view', 0, true),
    (p_ribbed_beanie, 'https://images.unsplash.com/photo-1519681393784-d1b22eac0e41?w=800&q=80&auto=format&fit=crop', 'Ribbed Beanie – flat lay', 1, false);

  INSERT INTO product_tags (product_id, tag_id)
  SELECT p_ribbed_beanie, id FROM tags WHERE slug = 'bestseller';


  -- ─────────────────────────────────────────────────────────────
  -- P11 · Cashmere Scarf
  --       Accessories | €95 | sustainable + bestseller
  --       Colors: Ecru, Camel, Black  |  Size: OS
  -- ─────────────────────────────────────────────────────────────
  INSERT INTO products (
    category_id, name, slug,
    description, short_desc, brand, base_price,
    is_active, is_featured, is_new_arrival, weight_grams
  ) VALUES (
    cat_accessories,
    'Cashmere Scarf',
    'cashmere-scarf',
    'A lightweight cashmere scarf woven in a classic 2/2 twill. Grade-A Mongolian cashmere, 180 x 30 cm. Hand-fringed ends and a smooth hand feel that softens further with each wash. A lifelong companion.',
    'Grade-A Mongolian cashmere scarf, 180 x 30 cm, hand-fringed.',
    'Common Era', 95.00,
    true, false, false, 150
  ) RETURNING id INTO p_cashmere_scarf;

  INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
  VALUES (p_cashmere_scarf, 'CE-CS-ECR-OS', 'OS', 'Ecru', '#f5f0e8', 18);
  INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
  VALUES (p_cashmere_scarf, 'CE-CS-CAM-OS', 'OS', 'Camel', '#c4956a', 18);
  INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
  VALUES (p_cashmere_scarf, 'CE-CS-BLK-OS', 'OS', 'Black', '#1a1a1a', 18);

  INSERT INTO product_images (product_id, url, alt_text, sort_order, is_cover) VALUES
    (p_cashmere_scarf, 'https://images.unsplash.com/photo-1614093302611-8efc4c3f5e8e?w=800&q=80&auto=format&fit=crop', 'Cashmere Scarf – draped view', 0, true),
    (p_cashmere_scarf, 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=800&q=80&auto=format&fit=crop', 'Cashmere Scarf – fringe detail', 1, false);

  INSERT INTO product_tags (product_id, tag_id)
  SELECT p_cashmere_scarf, id FROM tags WHERE slug IN ('sustainable', 'bestseller');


  -- ─────────────────────────────────────────────────────────────
  -- P12 · Leather Belt
  --       Accessories | €65 | sustainable
  --       Colors: Black, Tobacco  |  Sizes: S/M, L/XL
  -- ─────────────────────────────────────────────────────────────
  INSERT INTO products (
    category_id, name, slug,
    description, short_desc, brand, base_price,
    is_active, is_featured, is_new_arrival, weight_grams
  ) VALUES (
    cat_accessories,
    'Leather Belt',
    'leather-belt',
    'A 3cm single-stitch dress belt in full-grain vegetable-tanned leather. Solid brass roller-bar buckle with pin and keeper. Five adjustment holes, burnished finished edges. S/M fits waist 70–90 cm; L/XL fits 90–110 cm.',
    '3cm full-grain leather belt with solid brass roller-bar buckle.',
    'Common Era', 65.00,
    true, false, false, 180
  ) RETURNING id INTO p_leather_belt;

  INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
  VALUES (p_leather_belt, 'CE-LB-BLK-SM', 'S/M', 'Black', '#1a1a1a', 20);
  INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
  VALUES (p_leather_belt, 'CE-LB-BLK-LX', 'L/XL', 'Black', '#1a1a1a', 20);
  INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
  VALUES (p_leather_belt, 'CE-LB-TOB-SM', 'S/M', 'Tobacco', '#8b5e3c', 18);
  INSERT INTO product_variants (product_id, sku, size, color, color_hex, stock_qty)
  VALUES (p_leather_belt, 'CE-LB-TOB-LX', 'L/XL', 'Tobacco', '#8b5e3c', 18);

  INSERT INTO product_images (product_id, url, alt_text, sort_order, is_cover) VALUES
    (p_leather_belt, 'https://images.unsplash.com/photo-1553913861-c0fddf2619ee?w=800&q=80&auto=format&fit=crop', 'Leather Belt – flat lay', 0, true),
    (p_leather_belt, 'https://images.unsplash.com/photo-1624378441864-6eda7c994aed?w=800&q=80&auto=format&fit=crop', 'Leather Belt – buckle detail', 1, false);

  INSERT INTO product_tags (product_id, tag_id)
  SELECT p_leather_belt, id FROM tags WHERE slug = 'sustainable';


  -- ─────────────────────────────────────────────────────────────
  -- Done
  -- ─────────────────────────────────────────────────────────────
  RAISE NOTICE 'Seed complete: 7 categories, 12 products, variants, images, discounts and tags inserted.';

END $$;
