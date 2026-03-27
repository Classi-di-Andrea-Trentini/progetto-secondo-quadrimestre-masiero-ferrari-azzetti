-- Seed data per popolamento database e-commerce
-- UUID validi: utilizzano solo 0-9 e a-f

-- Disable triggers temporarily
ALTER TABLE products DISABLE TRIGGER ALL;
ALTER TABLE product_variants DISABLE TRIGGER ALL;

TRUNCATE TABLE users RESTART IDENTITY CASCADE;
TRUNCATE TABLE user_addresses RESTART IDENTITY CASCADE;
TRUNCATE TABLE categories RESTART IDENTITY CASCADE;
TRUNCATE TABLE tags RESTART IDENTITY CASCADE;
TRUNCATE TABLE products RESTART IDENTITY CASCADE;


-- ==================== UTENTI ====================
INSERT INTO users (id, email, password_hash, full_name, role, is_active, phone, birth_date, gender, newsletter_opt_in, email_verified_at, created_at, updated_at) VALUES
('11111111-1111-1111-1111-111111111111', 'admin@ecommerce.it', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36gZvQm6', 'Admin User', 'admin', true, '3891234567', '1985-01-15', 'M', true, now(), now(), now()),
('22222222-2222-2222-2222-222222222222', 'marco.rossi@gmail.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36gZvQm6', 'Marco Rossi', 'user', true, '3891234568', '1990-05-20', 'M', true, now(), now(), now()),
('33333333-3333-3333-3333-333333333333', 'giulia.bianchi@gmail.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36gZvQm6', 'Giulia Bianchi', 'user', true, '3891234569', '1992-08-10', 'F', true, now(), now(), now()),
('44444444-4444-4444-4444-444444444444', 'luca.verdi@hotmail.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36gZvQm6', 'Luca Verdi', 'user', true, '3891234570', '1988-12-03', 'M', false, now(), now(), now()),
('55555555-5555-5555-5555-555555555555', 'francesca.neri@yahoo.it', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36gZvQm6', 'Francesca Neri', 'user', true, '3891234571', '1995-03-25', 'F', true, now(), now(), now()),
('66666666-6666-6666-6666-666666666666', 'diego.romano@gmail.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36gZvQm6', 'Diego Romano', 'user', true, '3891234572', '1987-07-14', 'M', true, now(), now(), now()),
('77777777-7777-7777-7777-777777777777', 'elena.colombo@gmail.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36gZvQm6', 'Elena Colombo', 'user', true, '3891234573', '1993-11-08', 'F', true, now(), now(), now()),
('88888888-8888-8888-8888-888888888888', 'andrea.ferrari@hotmail.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36gZvQm6', 'Andrea Ferrari', 'user', false, '3891234574', '1991-02-19', 'M', false, now(), now(), now()),
('99999999-9999-9999-9999-999999999999', 'sara.gallo@gmail.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36gZvQm6', 'Sara Gallo', 'user', true, '3891234575', '1994-09-30', 'F', true, now(), now(), now()),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'carlo.rinaldi@yahoo.it', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36gZvQm6', 'Carlo Rinaldi', 'user', true, '3891234576', '1989-06-12', 'M', true, now(), now(), now());

-- ==================== INDIRIZZI UTENTI ====================
INSERT INTO user_addresses (id, user_id, label, full_name, phone, street, city, postal_code, country, is_default, created_at) VALUES
('a1111111-aaaa-aaaa-aaaa-111111111111', '22222222-2222-2222-2222-222222222222', 'Casa', 'Marco Rossi', '3891234568', 'Via Roma 123', 'Milano', '20100', 'IT', true, now()),
('a2222222-aaaa-aaaa-aaaa-222222222222', '22222222-2222-2222-2222-222222222222', 'Ufficio', 'Marco Rossi', '3891234568', 'Via Navigli 45', 'Milano', '20141', 'IT', false, now()),
('a3333333-aaaa-aaaa-aaaa-333333333333', '33333333-3333-3333-3333-333333333333', 'Casa', 'Giulia Bianchi', '3891234569', 'Via Torino 789', 'Roma', '00184', 'IT', true, now()),
('a4444444-aaaa-aaaa-aaaa-444444444444', '44444444-4444-4444-4444-444444444444', 'Casa', 'Luca Verdi', '3891234570', 'Via Garibaldi 321', 'Napoli', '80142', 'IT', true, now()),
('a5555555-aaaa-aaaa-aaaa-555555555555', '55555555-5555-5555-5555-555555555555', 'Casa', 'Francesca Neri', '3891234571', 'Via Dante 456', 'Firenze', '50121', 'IT', true, now()),
('a6666666-aaaa-aaaa-aaaa-666666666666', '66666666-6666-6666-6666-666666666666', 'Casa', 'Diego Romano', '3891234572', 'Via Verona 654', 'Bologna', '40121', 'IT', true, now()),
('a7777777-aaaa-aaaa-aaaa-777777777777', '77777777-7777-7777-7777-777777777777', 'Casa', 'Elena Colombo', '3891234573', 'Via Como 987', 'Torino', '10121', 'IT', true, now()),
('a8888888-aaaa-aaaa-aaaa-888888888888', '99999999-9999-9999-9999-999999999999', 'Casa', 'Sara Gallo', '3891234575', 'Via Palermo 234', 'Genova', '16121', 'IT', true, now());

-- ==================== CATEGORIE ====================
INSERT INTO categories (id, parent_id, name, slug, description, image_url, is_active, sort_order, created_at) VALUES
('b0000001-bbbb-bbbb-bbbb-bbbbbbbbbbbb', NULL, 'Clothing', 'clothing', 'Tutti i capi di abbigliamento per uomo, donna e bambino', 'https://via.placeholder.com/300x200?text=Abbigliamento', true, 1, now()),
('b0000002-bbbb-bbbb-bbbb-bbbbbbbbbbbb', NULL, 'Shoes', 'shoes', 'Scarpe e stivali per tutte le occasioni', 'https://via.placeholder.com/300x200?text=Scarpe', true, 2, now()),
('b0000003-bbbb-bbbb-bbbb-bbbbbbbbbbbb', NULL, 'Accessories', 'accessories', 'Accessori moda e complementi di stile', 'https://via.placeholder.com/300x200?text=Accessori', true, 3, now()),
('b0000004-bbbb-bbbb-bbbb-bbbbbbbbbbbb', NULL, 'Bags', 'bags', 'Borse e zaini di qualità', 'https://via.placeholder.com/300x200?text=Borse', true, 4, now()),
('b0000005-bbbb-bbbb-bbbb-bbbbbbbbbbbb', NULL, 'Gioielli', 'gioielli', 'Gioielli eleganti e contemporanei', 'https://via.placeholder.com/300x200?text=Gioielli', true, 5, now()),
('b1000001-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b0000001-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'T-Shirts', 't-shirts', 'T-shirt e magliette', 'https://via.placeholder.com/300x200?text=T-Shirt', true, 1, now()),
('b1000002-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b0000001-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Jeans', 'jeans', 'Jeans di vari modelli e colori', 'https://via.placeholder.com/300x200?text=Jeans', true, 2, now()),
('b1000003-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b0000001-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Jackets', 'jackets', 'Giacche e capispalla', 'https://via.placeholder.com/300x200?text=Giacche', true, 3, now()),
('b2000001-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b0000002-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Sneakers', 'sneakers', 'Scarpe sportive e casual', 'https://via.placeholder.com/300x200?text=Sneakers', true, 1, now()),
('b2000002-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b0000002-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Tacchi', 'tacchi', 'Scarpe con tacco', 'https://via.placeholder.com/300x200?text=Tacchi', true, 2, now());

-- ==================== TAG ====================
INSERT INTO tags (id, name, slug) VALUES
('c0000001-cccc-cccc-cccc-cccccccccccc', 'Tendenza 2024', 'tendenza-2024'),
('c0000002-cccc-cccc-cccc-cccccccccccc', 'Eco-friendly', 'eco-friendly'),
('c0000003-cccc-cccc-cccc-cccccccccccc', 'Premium', 'premium'),
('c0000004-cccc-cccc-cccc-cccccccccccc', 'Sconto', 'sconto'),
('c0000005-cccc-cccc-cccc-cccccccccccc', 'Novità', 'novita'),
('c0000006-cccc-cccc-cccc-cccccccccccc', 'Bestseller', 'bestseller');

-- ==================== PRODOTTI ====================
INSERT INTO products (id, category_id, name, slug, description, short_desc, brand, base_price, is_active, is_featured, is_new_arrival, sold_count, avg_rating, created_at, updated_at) VALUES
('d0000001-dddd-dddd-dddd-dddddddddddd', 'b1000001-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'T-Shirt Bianca Basic', 't-shirt-bianca-basic', 'Comoda t-shirt in cotone 100% puro, perfetta per l''uso quotidiano', 'T-shirt bianca classica', 'BasicWear', 19.99, true, true, true, 150, 4.50, now(), now()),
('d0000002-dddd-dddd-dddd-dddddddddddd', 'b1000001-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'T-Shirt Nera Premium', 't-shirt-nera-premium', 'T-shirt in cotone organico certificato, design minimale e elegante', 'T-shirt nera premium', 'EcoStyle', 34.99, true, true, false, 89, 4.80, now(), now()),
('d0000003-dddd-dddd-dddd-dddddddddddd', 'b1000001-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'T-Shirt Colorata Stampata', 't-shirt-colorata-stampata', 'T-shirt con stampa artistica, disponibile in più colori vivaci', 'T-shirt stampata colorata', 'ArtisticWear', 24.99, true, false, true, 120, 4.30, now(), now()),
('d0000004-dddd-dddd-dddd-dddddddddddd', 'b1000002-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Jeans Blu Classico', 'jeans-blu-classico', 'Jeans classico in denim di qualità, perfetto per ogni occasione', 'Jeans blu classico slim fit', 'DenimCo', 59.99, true, true, false, 250, 4.70, now(), now()),
('d0000005-dddd-dddd-dddd-dddddddddddd', 'b1000002-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Jeans Nero Stretch', 'jeans-nero-stretch', 'Jeans nero con elastan per massima comodità e libertà di movimento', 'Jeans nero stretch comfort', 'StretchDenim', 64.99, true, true, true, 180, 4.60, now(), now()),
('d0000006-dddd-dddd-dddd-dddddddddddd', 'b1000002-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Jeans Sbiadito Vintage', 'jeans-sbiadito-vintage', 'Jeans con effetto vintage sbiadito, stile retrò moderno', 'Jeans sbiadito vintage style', 'VintageDenim', 69.99, true, false, true, 95, 4.40, now(), now()),
('d0000007-dddd-dddd-dddd-dddddddddddd', 'b1000003-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Giacca Jeans Blu', 'giacca-jeans-blu', 'Giacca in jeans classica, perfetta da indossare su qualsiasi outfit', 'Giacca di jeans blu', 'DenimJackets', 89.99, true, true, false, 120, 4.65, now(), now()),
('d0000008-dddd-dddd-dddd-dddddddddddd', 'b1000003-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Parka Invernale', 'parka-invernale', 'Parka caldo e resistente per l''inverno, con cappuccio staccabile', 'Parka invernale con cappuccio', 'WinterWear', 149.99, true, true, true, 85, 4.75, now(), now()),
('d0000009-dddd-dddd-dddd-dddddddddddd', 'b1000003-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Giacca Pelle Nera', 'giacca-pelle-nera', 'Giacca in vera pelle premium, look rock e sofisticato', 'Giacca in vera pelle nera', 'LeatherPremium', 199.99, true, false, false, 45, 4.80, now(), now()),
('d0000010-dddd-dddd-dddd-dddddddddddd', 'b2000001-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Sneakers Bianche Casual', 'sneakers-bianche-casual', 'Comode sneakers bianche perfette per l''uso quotidiano e sportivo', 'Sneakers bianche casual', 'SportStyle', 79.99, true, true, true, 320, 4.70, now(), now()),
('d0000011-dddd-dddd-dddd-dddddddddddd', 'b2000001-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Sneakers Nere High-Top', 'sneakers-nere-high-top', 'Sneakers nere alte con supporto caviglia, design moderno', 'Sneakers nere high-top', 'StreetWear', 94.99, true, true, false, 210, 4.55, now(), now()),
('d0000012-dddd-dddd-dddd-dddddddddddd', 'b2000001-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Scarpe Running Pro', 'scarpe-running-pro', 'Scarpe running professionali con tecnologia ammortizzamento avanzato', 'Scarpe running ammortizzate', 'RunningPro', 129.99, true, false, true, 150, 4.85, now(), now()),
('d0000013-dddd-dddd-dddd-dddddddddddd', 'b2000002-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Tacchi Neri Classici', 'tacchi-neri-classici', 'Eleganti tacchi neri, perfetti per cene e occasioni speciali', 'Tacchi neri classici', 'ElegantShoes', 99.99, true, true, false, 180, 4.60, now(), now()),
('d0000014-dddd-dddd-dddd-dddddddddddd', 'b2000002-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Scarpe Plateau Oro', 'scarpe-plateau-oro', 'Scarpe plateau dorate con effetto metallico, ideali per party', 'Scarpe plateau oro', 'PartyShoes', 109.99, true, true, true, 95, 4.50, now(), now()),
('d0000015-dddd-dddd-dddd-dddddddddddd', 'b2000002-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Stivaletti Rossi', 'stivaletti-rossi', 'Stivaletti rossi in suede, eleganti e sofisticati', 'Stivaletti rossi suede', 'BootsStyle', 129.99, true, false, true, 75, 4.70, now(), now()),
('d0000016-dddd-dddd-dddd-dddddddddddd', 'b0000003-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Cintura Pelle Nera', 'cintura-pelle-nera', 'Cintura in vera pelle nera, fibbia classica, taglia regolabile', 'Cintura in vera pelle nera', 'LeatherGoods', 44.99, true, true, false, 220, 4.75, now(), now()),
('d0000017-dddd-dddd-dddd-dddddddddddd', 'b0000003-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Sciarpa Cashmere', 'sciarpa-cashmere', 'Morbida sciarpa in cashmere 100%, colori assortiti disponibili', 'Sciarpa in cashmere puro', 'CashmereWear', 74.99, true, true, true, 140, 4.90, now(), now()),
('d0000018-dddd-dddd-dddd-dddddddddddd', 'b0000003-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Berretto Lana Grigio', 'berretto-lana-grigio', 'Caldo berretto in lana merino, perfetto per l''inverno', 'Berretto in lana grigio', 'WoolWear', 39.99, true, false, true, 110, 4.55, now(), now()),
('d0000019-dddd-dddd-dddd-dddddddddddd', 'b0000004-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Borsa Tote Nera', 'borsa-tote-nera', 'Ampia borsa tote in pelle, perfetta per il lavoro e lo shopping', 'Borsa tote nera pelle', 'BagStyle', 129.99, true, true, false, 165, 4.80, now(), now()),
('d0000020-dddd-dddd-dddd-dddddddddddd', 'b0000004-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Zaino Viaggio', 'zaino-viaggio', 'Zaino capiente per viaggi, con scomparto laptop e USB', 'Zaino viaggio con USB', 'TravelGear', 89.99, true, true, true, 190, 4.70, now(), now()),
('d0000021-dddd-dddd-dddd-dddddddddddd', 'b0000004-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Clutch Elegante Rosso', 'clutch-elegante-rosso', 'Piccola e elegante clutch rossa, ideale per occasioni speciali', 'Clutch rosso elegante', 'FormalWear', 84.99, true, true, true, 105, 4.65, now(), now()),
('d0000022-dddd-dddd-dddd-dddddddddddd', 'b0000005-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Collana Oro Delicata', 'collana-oro-delicata', 'Delicata collana in oro 18kt, design minimalista e elegante', 'Collana oro 18kt', 'JewelryPure', 249.99, true, true, false, 80, 4.85, now(), now()),
('d0000023-dddd-dddd-dddd-dddddddddddd', 'b0000005-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Anello Con Diamante', 'anello-con-diamante', 'Bellissimo anello con diamante naturale, certificato GIA', 'Anello diamante certificato', 'DiamondLux', 599.99, true, true, true, 35, 4.95, now(), now()),
('d0000024-dddd-dddd-dddd-dddddddddddd', 'b0000005-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Orecchini Perle Bianche', 'orecchini-perle-bianche', 'Classici orecchini con perle bianche naturali in argento', 'Orecchini perle argento', 'PearlJewels', 159.99, true, false, true, 60, 4.75, now(), now());

-- ==================== PRODUCT TAGS ====================
INSERT INTO product_tags (product_id, tag_id) VALUES
('d0000001-dddd-dddd-dddd-dddddddddddd', 'c0000001-cccc-cccc-cccc-cccccccccccc'),
('d0000001-dddd-dddd-dddd-dddddddddddd', 'c0000006-cccc-cccc-cccc-cccccccccccc'),
('d0000002-dddd-dddd-dddd-dddddddddddd', 'c0000002-cccc-cccc-cccc-cccccccccccc'),
('d0000002-dddd-dddd-dddd-dddddddddddd', 'c0000003-cccc-cccc-cccc-cccccccccccc'),
('d0000003-dddd-dddd-dddd-dddddddddddd', 'c0000001-cccc-cccc-cccc-cccccccccccc'),
('d0000003-dddd-dddd-dddd-dddddddddddd', 'c0000005-cccc-cccc-cccc-cccccccccccc'),
('d0000004-dddd-dddd-dddd-dddddddddddd', 'c0000006-cccc-cccc-cccc-cccccccccccc'),
('d0000005-dddd-dddd-dddd-dddddddddddd', 'c0000001-cccc-cccc-cccc-cccccccccccc'),
('d0000006-dddd-dddd-dddd-dddddddddddd', 'c0000004-cccc-cccc-cccc-cccccccccccc'),
('d0000007-dddd-dddd-dddd-dddddddddddd', 'c0000006-cccc-cccc-cccc-cccccccccccc'),
('d0000008-dddd-dddd-dddd-dddddddddddd', 'c0000005-cccc-cccc-cccc-cccccccccccc'),
('d0000009-dddd-dddd-dddd-dddddddddddd', 'c0000003-cccc-cccc-cccc-cccccccccccc'),
('d0000010-dddd-dddd-dddd-dddddddddddd', 'c0000006-cccc-cccc-cccc-cccccccccccc'),
('d0000010-dddd-dddd-dddd-dddddddddddd', 'c0000001-cccc-cccc-cccc-cccccccccccc'),
('d0000011-dddd-dddd-dddd-dddddddddddd', 'c0000001-cccc-cccc-cccc-cccccccccccc'),
('d0000012-dddd-dddd-dddd-dddddddddddd', 'c0000005-cccc-cccc-cccc-cccccccccccc'),
('d0000013-dddd-dddd-dddd-dddddddddddd', 'c0000003-cccc-cccc-cccc-cccccccccccc'),
('d0000014-dddd-dddd-dddd-dddddddddddd', 'c0000001-cccc-cccc-cccc-cccccccccccc'),
('d0000015-dddd-dddd-dddd-dddddddddddd', 'c0000004-cccc-cccc-cccc-cccccccccccc'),
('d0000015-dddd-dddd-dddd-dddddddddddd', 'c0000005-cccc-cccc-cccc-cccccccccccc'),
('d0000016-dddd-dddd-dddd-dddddddddddd', 'c0000003-cccc-cccc-cccc-cccccccccccc'),
('d0000017-dddd-dddd-dddd-dddddddddddd', 'c0000002-cccc-cccc-cccc-cccccccccccc'),
('d0000017-dddd-dddd-dddd-dddddddddddd', 'c0000003-cccc-cccc-cccc-cccccccccccc'),
('d0000018-dddd-dddd-dddd-dddddddddddd', 'c0000001-cccc-cccc-cccc-cccccccccccc'),
('d0000019-dddd-dddd-dddd-dddddddddddd', 'c0000006-cccc-cccc-cccc-cccccccccccc'),
('d0000020-dddd-dddd-dddd-dddddddddddd', 'c0000001-cccc-cccc-cccc-cccccccccccc'),
('d0000021-dddd-dddd-dddd-dddddddddddd', 'c0000003-cccc-cccc-cccc-cccccccccccc'),
('d0000022-dddd-dddd-dddd-dddddddddddd', 'c0000003-cccc-cccc-cccc-cccccccccccc'),
('d0000023-dddd-dddd-dddd-dddddddddddd', 'c0000003-cccc-cccc-cccc-cccccccccccc'),
('d0000024-dddd-dddd-dddd-dddddddddddd', 'c0000006-cccc-cccc-cccc-cccccccccccc');

-- ==================== PRODUCT VARIANTS ====================
INSERT INTO product_variants (id, product_id, sku, size, color, color_hex, price_override, stock_qty, is_active, created_at) VALUES
('e0000001-eeee-eeee-eeee-eeeeeeeeeeee', 'd0000001-dddd-dddd-dddd-dddddddddddd', 'TS-BAS-001-S', 'S', 'Bianco', '#FFFFFF', NULL, 50, true, now()),
('e0000002-eeee-eeee-eeee-eeeeeeeeeeee', 'd0000001-dddd-dddd-dddd-dddddddddddd', 'TS-BAS-001-M', 'M', 'Bianco', '#FFFFFF', NULL, 75, true, now()),
('e0000003-eeee-eeee-eeee-eeeeeeeeeeee', 'd0000001-dddd-dddd-dddd-dddddddddddd', 'TS-BAS-001-L', 'L', 'Bianco', '#FFFFFF', NULL, 60, true, now()),
('e0000004-eeee-eeee-eeee-eeeeeeeeeeee', 'd0000001-dddd-dddd-dddd-dddddddddddd', 'TS-BAS-001-XL', 'XL', 'Bianco', '#FFFFFF', NULL, 40, true, now()),
('e0000005-eeee-eeee-eeee-eeeeeeeeeeee', 'd0000002-dddd-dddd-dddd-dddddddddddd', 'TS-PRE-002-S', 'S', 'Nero', '#000000', NULL, 35, true, now()),
('e0000006-eeee-eeee-eeee-eeeeeeeeeeee', 'd0000002-dddd-dddd-dddd-dddddddddddd', 'TS-PRE-002-M', 'M', 'Nero', '#000000', NULL, 50, true, now()),
('e0000007-eeee-eeee-eeee-eeeeeeeeeeee', 'd0000002-dddd-dddd-dddd-dddddddddddd', 'TS-PRE-002-L', 'L', 'Nero', '#000000', NULL, 45, true, now()),
('e0000008-eeee-eeee-eeee-eeeeeeeeeeee', 'd0000003-dddd-dddd-dddd-dddddddddddd', 'TS-ART-003-M', 'M', 'Rosso', '#FF0000', NULL, 30, true, now()),
('e0000009-eeee-eeee-eeee-eeeeeeeeeeee', 'd0000003-dddd-dddd-dddd-dddddddddddd', 'TS-ART-003-M-BLU', 'M', 'Blu', '#0000FF', NULL, 40, true, now()),
('e0000010-eeee-eeee-eeee-eeeeeeeeeeee', 'd0000004-dddd-dddd-dddd-dddddddddddd', 'JN-BLU-004-30', '30', 'Blu', '#0052CC', NULL, 45, true, now()),
('e0000011-eeee-eeee-eeee-eeeeeeeeeeee', 'd0000004-dddd-dddd-dddd-dddddddddddd', 'JN-BLU-004-32', '32', 'Blu', '#0052CC', NULL, 50, true, now()),
('e0000012-eeee-eeee-eeee-eeeeeeeeeeee', 'd0000004-dddd-dddd-dddd-dddddddddddd', 'JN-BLU-004-34', '34', 'Blu', '#0052CC', NULL, 55, true, now()),
('e0000013-eeee-eeee-eeee-eeeeeeeeeeee', 'd0000005-dddd-dddd-dddd-dddddddddddd', 'JN-NEL-005-28', '28', 'Nero', '#000000', NULL, 40, true, now()),
('e0000014-eeee-eeee-eeee-eeeeeeeeeeee', 'd0000005-dddd-dddd-dddd-dddddddddddd', 'JN-NEL-005-30', '30', 'Nero', '#000000', NULL, 50, true, now()),
('e0000015-eeee-eeee-eeee-eeeeeeeeeeee', 'd0000005-dddd-dddd-dddd-dddddddddddd', 'JN-NEL-005-32', '32', 'Nero', '#000000', NULL, 48, true, now()),
('e0000016-eeee-eeee-eeee-eeeeeeeeeeee', 'd0000010-dddd-dddd-dddd-dddddddddddd', 'SN-BIA-010-39', '39', 'Bianco', '#FFFFFF', NULL, 35, true, now()),
('e0000017-eeee-eeee-eeee-eeeeeeeeeeee', 'd0000010-dddd-dddd-dddd-dddddddddddd', 'SN-BIA-010-40', '40', 'Bianco', '#FFFFFF', NULL, 50, true, now()),
('e0000018-eeee-eeee-eeee-eeeeeeeeeeee', 'd0000010-dddd-dddd-dddd-dddddddddddd', 'SN-BIA-010-41', '41', 'Bianco', '#FFFFFF', NULL, 45, true, now()),
('e0000019-eeee-eeee-eeee-eeeeeeeeeeee', 'd0000010-dddd-dddd-dddd-dddddddddddd', 'SN-BIA-010-42', '42', 'Bianco', '#FFFFFF', NULL, 40, true, now()),
('e0000020-eeee-eeee-eeee-eeeeeeeeeeee', 'd0000022-dddd-dddd-dddd-dddddddddddd', 'JW-COL-022-45CM', 'Unica', 'Oro', '#FFD700', NULL, 25, true, now()),
('e0000021-eeee-eeee-eeee-eeeeeeeeeeee', 'd0000023-dddd-dddd-dddd-dddddddddddd', 'JW-ANE-023-50', '50', 'Oro', '#FFD700', NULL, 10, true, now()),
('e0000022-eeee-eeee-eeee-eeeeeeeeeeee', 'd0000023-dddd-dddd-dddd-dddddddddddd', 'JW-ANE-023-52', '52', 'Oro', '#FFD700', NULL, 12, true, now()),
('e0000023-eeee-eeee-eeee-eeeeeeeeeeee', 'd0000013-dddd-dddd-dddd-dddddddddddd', 'SH-TAC-013-36', '36', 'Nero', '#000000', NULL, 20, true, now()),
('e0000024-eeee-eeee-eeee-eeeeeeeeeeee', 'd0000013-dddd-dddd-dddd-dddddddddddd', 'SH-TAC-013-37', '37', 'Nero', '#000000', NULL, 25, true, now()),
('e0000025-eeee-eeee-eeee-eeeeeeeeeeee', 'd0000013-dddd-dddd-dddd-dddddddddddd', 'SH-TAC-013-38', '38', 'Nero', '#000000', NULL, 30, true, now());

-- ==================== PRODUCT IMAGES ====================
INSERT INTO product_images (id, product_id, variant_id, url, alt_text, sort_order, is_cover, created_at) VALUES
('f0000001-ffff-ffff-ffff-ffffffffffff', 'd0000001-dddd-dddd-dddd-dddddddddddd', NULL, 'https://via.placeholder.com/500x500?text=T-Shirt+Bianca+1', 'T-Shirt Bianca Basic vista frontale', 1, true, now()),
('f0000002-ffff-ffff-ffff-ffffffffffff', 'd0000001-dddd-dddd-dddd-dddddddddddd', NULL, 'https://via.placeholder.com/500x500?text=T-Shirt+Bianca+2', 'T-Shirt Bianca Basic vista laterale', 2, false, now()),
('f0000003-ffff-ffff-ffff-ffffffffffff', 'd0000002-dddd-dddd-dddd-dddddddddddd', NULL, 'https://via.placeholder.com/500x500?text=T-Shirt+Nera+1', 'T-Shirt Nera Premium vista frontale', 1, true, now()),
('f0000004-ffff-ffff-ffff-ffffffffffff', 'd0000004-dddd-dddd-dddd-dddddddddddd', NULL, 'https://via.placeholder.com/500x500?text=Jeans+Blu+1', 'Jeans Blu Classico vista frontale', 1, true, now()),
('f0000005-ffff-ffff-ffff-ffffffffffff', 'd0000004-dddd-dddd-dddd-dddddddddddd', NULL, 'https://via.placeholder.com/500x500?text=Jeans+Blu+2', 'Jeans Blu Classico vista laterale', 2, false, now()),
('f0000006-ffff-ffff-ffff-ffffffffffff', 'd0000010-dddd-dddd-dddd-dddddddddddd', NULL, 'https://via.placeholder.com/500x500?text=Sneakers+Bianche+1', 'Sneakers Bianche tre quarti', 1, true, now()),
('f0000007-ffff-ffff-ffff-ffffffffffff', 'd0000010-dddd-dddd-dddd-dddddddddddd', NULL, 'https://via.placeholder.com/500x500?text=Sneakers+Bianche+2', 'Sneakers Bianche suola', 2, false, now()),
('f0000008-ffff-ffff-ffff-ffffffffffff', 'd0000022-dddd-dddd-dddd-dddddddddddd', NULL, 'https://via.placeholder.com/500x500?text=Collana+Oro+1', 'Collana Oro Delicata indossata', 1, true, now()),
('f0000009-ffff-ffff-ffff-ffffffffffff', 'd0000023-dddd-dddd-dddd-dddddddddddd', NULL, 'https://via.placeholder.com/500x500?text=Anello+Diamante+1', 'Anello Con Diamante vista frontale', 1, true, now());

-- ==================== DISCOUNTS ====================
INSERT INTO discounts (id, product_id, variant_id, type, value, label, starts_at, ends_at, is_active, created_at) VALUES
('a0000001-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'd0000006-dddd-dddd-dddd-dddddddddddd', NULL, 'percentage', 15, 'Sconto Vintage', now() - interval '5 days', now() + interval '10 days', true, now()),
('a0000002-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'd0000015-dddd-dddd-dddd-dddddddddddd', NULL, 'fixed_amount', 20, 'Sconto Stivaletti', now() - interval '2 days', now() + interval '15 days', true, now()),
('a0000003-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'd0000008-dddd-dddd-dddd-dddddddddddd', NULL, 'percentage', 20, 'Sconto Parka', now() - interval '7 days', now() + interval '5 days', true, now()),
('a0000004-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'd0000005-dddd-dddd-dddd-dddddddddddd', NULL, 'percentage', 10, 'Sconto Jeans Stretch', now() - interval '1 day', now() + interval '20 days', true, now());

-- ==================== PROMO CODES ====================
INSERT INTO promo_codes (id, code, type, value, description, max_uses, max_uses_per_user, min_order_amount, is_active, created_by, created_at) VALUES
('b0000010-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'WELCOME20', 'percentage', 20, 'Sconto di benvenuto per nuovi clienti', 100, 1, 50, true, '11111111-1111-1111-1111-111111111111', now()),
('b0000020-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'SUMMER30', 'percentage', 30, 'Mega sconto estivo', 500, 3, 100, true, '11111111-1111-1111-1111-111111111111', now()),
('b0000030-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'SAVE10', 'fixed_amount', 10, 'Sconto fisso di 10 euro', 200, 2, 80, true, '11111111-1111-1111-1111-111111111111', now()),
('b0000040-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'FASHION15', 'percentage', 15, 'Sconto su abbigliamento', 150, 5, 60, true, '11111111-1111-1111-1111-111111111111', now());

-- ==================== CARTS ====================
INSERT INTO carts (id, user_id, updated_at) VALUES
('05000001-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', now()),
('05000002-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', now()),
('05000003-0000-0000-0000-000000000003', '44444444-4444-4444-4444-444444444444', now()),
('05000004-0000-0000-0000-000000000004', '55555555-5555-5555-5555-555555555555', now()),
('05000005-0000-0000-0000-000000000005', '66666666-6666-6666-6666-666666666666', now()),
('05000006-0000-0000-0000-000000000006', '77777777-7777-7777-7777-777777777777', now()),
('05000007-0000-0000-0000-000000000007', '99999999-9999-9999-9999-999999999999', now()),
('05000008-0000-0000-0000-000000000008', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', now());

-- ==================== CART ITEMS ====================
INSERT INTO cart_items (id, cart_id, variant_id, quantity, added_at) VALUES
('06000001-0000-0000-0000-000000000001', '05000001-0000-0000-0000-000000000001', 'e0000002-eeee-eeee-eeee-eeeeeeeeeeee', 2, now()),
('06000002-0000-0000-0000-000000000002', '05000001-0000-0000-0000-000000000001', 'e0000011-eeee-eeee-eeee-eeeeeeeeeeee', 1, now()),
('06000003-0000-0000-0000-000000000003', '05000002-0000-0000-0000-000000000002', 'e0000017-eeee-eeee-eeee-eeeeeeeeeeee', 1, now()),
('06000004-0000-0000-0000-000000000004', '05000003-0000-0000-0000-000000000003', 'e0000023-eeee-eeee-eeee-eeeeeeeeeeee', 1, now()),
('06000005-0000-0000-0000-000000000005', '05000004-0000-0000-0000-000000000004', 'e0000021-eeee-eeee-eeee-eeeeeeeeeeee', 1, now());

-- ==================== ORDERS ====================
INSERT INTO orders (id, user_id, address_id, status, subtotal, discount_total, shipping_cost, tax_amount, total, created_at, updated_at) VALUES
('07000001-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'a1111111-aaaa-aaaa-aaaa-111111111111', 'delivered', 149.98, 15, 10, 24.47, 169.45, now() - interval '30 days', now() - interval '5 days'),
('07000002-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'a3333333-aaaa-aaaa-aaaa-333333333333', 'shipped', 79.99, 0, 8, 13.04, 101.03, now() - interval '7 days', now() - interval '1 day'),
('07000003-0000-0000-0000-000000000003', '44444444-4444-4444-4444-444444444444', 'a4444444-aaaa-aaaa-aaaa-444444444444', 'processing', 249.99, 24.99, 15, 40.81, 281.81, now() - interval '3 days', now() - interval '1 day'),
('07000004-0000-0000-0000-000000000004', '55555555-5555-5555-5555-555555555555', 'a5555555-aaaa-aaaa-aaaa-555555555555', 'delivered', 349.97, 35, 12, 57.14, 384.11, now() - interval '45 days', now() - interval '20 days'),
('07000005-0000-0000-0000-000000000005', '66666666-6666-6666-6666-666666666666', 'a6666666-aaaa-aaaa-aaaa-666666666666', 'pending', 119.99, 0, 8, 19.60, 147.59, now() - interval '2 days', now() - interval '2 days'),
('07000006-0000-0000-0000-000000000006', '77777777-7777-7777-7777-777777777777', 'a7777777-aaaa-aaaa-aaaa-777777777777', 'delivered', 179.98, 18, 10, 29.38, 221.36, now() - interval '20 days', now() - interval '3 days'),
('07000007-0000-0000-0000-000000000007', '99999999-9999-9999-9999-999999999999', 'a8888888-aaaa-aaaa-aaaa-888888888888', 'completed', 634.97, 63.50, 0, 103.71, 675.18, now() - interval '60 days', now() - interval '15 days'),
('07000008-0000-0000-0000-000000000008', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a5555555-aaaa-aaaa-aaaa-555555555555', 'cancelled', 89.99, 0, 0, 0, 89.99, now() - interval '10 days', now() - interval '9 days');

-- ==================== ORDER ITEMS ====================
INSERT INTO order_items (id, order_id, variant_id, product_name, variant_label, sku_snapshot, unit_price, quantity, line_total) VALUES
('08000001-0000-0000-0000-000000000001', '07000001-0000-0000-0000-000000000001', 'e0000005-eeee-eeee-eeee-eeeeeeeeeeee', 'T-Shirt Nera Premium', 'S - Nero', 'TS-PRE-002-S', 34.99, 2, 69.98),
('08000002-0000-0000-0000-000000000002', '07000001-0000-0000-0000-000000000001', 'e0000011-eeee-eeee-eeee-eeeeeeeeeeee', 'Jeans Blu Classico', '32 - Blu', 'JN-BLU-004-32', 59.99, 1, 59.99),
('08000003-0000-0000-0000-000000000003', '07000002-0000-0000-0000-000000000002', 'e0000017-eeee-eeee-eeee-eeeeeeeeeeee', 'Sneakers Bianche Casual', '40 - Bianco', 'SN-BIA-010-40', 79.99, 1, 79.99),
('08000004-0000-0000-0000-000000000004', '07000003-0000-0000-0000-000000000003', 'e0000020-eeee-eeee-eeee-eeeeeeeeeeee', 'Collana Oro Delicata', '45cm - Oro', 'JW-COL-022-45CM', 249.99, 1, 249.99),
('08000005-0000-0000-0000-000000000005', '07000004-0000-0000-0000-000000000004', 'e0000002-eeee-eeee-eeee-eeeeeeeeeeee', 'T-Shirt Bianca Basic', 'M - Bianco', 'TS-BAS-001-M', 19.99, 2, 39.98),
('08000006-0000-0000-0000-000000000006', '07000004-0000-0000-0000-000000000004', 'e0000014-eeee-eeee-eeee-eeeeeeeeeeee', 'Jeans Nero Stretch', '30 - Nero', 'JN-NEL-005-30', 64.99, 2, 129.98),
('08000007-0000-0000-0000-000000000007', '07000004-0000-0000-0000-000000000004', 'e0000023-eeee-eeee-eeee-eeeeeeeeeeee', 'Tacchi Neri Classici', '36 - Nero', 'SH-TAC-013-36', 99.99, 1, 99.99),
('08000008-0000-0000-0000-000000000008', '07000006-0000-0000-0000-000000000006', 'e0000003-eeee-eeee-eeee-eeeeeeeeeeee', 'T-Shirt Bianca Basic', 'L - Bianco', 'TS-BAS-001-L', 19.99, 1, 19.99),
('08000009-0000-0000-0000-000000000009', '07000006-0000-0000-0000-000000000006', 'e0000012-eeee-eeee-eeee-eeeeeeeeeeee', 'Jeans Blu Classico', '34 - Blu', 'JN-BLU-004-34', 59.99, 1, 59.99),
('08000010-0000-0000-0000-000000000010', '07000006-0000-0000-0000-000000000006', 'e0000021-eeee-eeee-eeee-eeeeeeeeeeee', 'Anello Con Diamante', '50 - Oro', 'JW-ANE-023-50', 599.99, 1, 599.99),
('08000011-0000-0000-0000-000000000011', '07000007-0000-0000-0000-000000000007', 'e0000004-eeee-eeee-eeee-eeeeeeeeeeee', 'T-Shirt Bianca Basic', 'XL - Bianco', 'TS-BAS-001-XL', 19.99, 1, 19.99),
('08000012-0000-0000-0000-000000000012', '07000007-0000-0000-0000-000000000007', 'e0000010-eeee-eeee-eeee-eeeeeeeeeeee', 'Jeans Blu Classico', '30 - Blu', 'JN-BLU-004-30', 59.99, 1, 59.99),
('08000013-0000-0000-0000-000000000013', '07000007-0000-0000-0000-000000000007', 'e0000022-eeee-eeee-eeee-eeeeeeeeeeee', 'Anello Con Diamante', '52 - Oro', 'JW-ANE-023-52', 599.99, 1, 599.99),
('08000014-0000-0000-0000-000000000014', '07000008-0000-0000-0000-000000000008', 'e0000018-eeee-eeee-eeee-eeeeeeeeeeee', 'Sneakers Bianche Casual', '41 - Bianco', 'SN-BIA-010-41', 79.99, 1, 79.99),
('08000015-0000-0000-0000-000000000015', '07000005-0000-0000-0000-000000000005', 'e0000006-eeee-eeee-eeee-eeeeeeeeeeee', 'T-Shirt Nera Premium', 'M - Nero', 'TS-PRE-002-M', 34.99, 1, 34.99),
('08000016-0000-0000-0000-000000000016', '07000005-0000-0000-0000-000000000005', 'e0000019-eeee-eeee-eeee-eeeeeeeeeeee', 'Sneakers Bianche Casual', '42 - Bianco', 'SN-BIA-010-42', 79.99, 1, 79.99);

-- ==================== ORDER STATUS HISTORY ====================
INSERT INTO order_status_history (id, order_id, status, changed_by, note, created_at) VALUES
('09000001-0000-0000-0000-000000000001', '07000001-0000-0000-0000-000000000001', 'pending', '11111111-1111-1111-1111-111111111111', 'Ordine creato', now() - interval '30 days'),
('09000002-0000-0000-0000-000000000002', '07000001-0000-0000-0000-000000000001', 'paid', '11111111-1111-1111-1111-111111111111', 'Pagamento confermato', now() - interval '29 days'),
('09000003-0000-0000-0000-000000000003', '07000001-0000-0000-0000-000000000001', 'processing', '11111111-1111-1111-1111-111111111111', 'In preparazione', now() - interval '28 days'),
('09000004-0000-0000-0000-000000000004', '07000001-0000-0000-0000-000000000001', 'shipped', '11111111-1111-1111-1111-111111111111', 'Spedito', now() - interval '7 days'),
('09000005-0000-0000-0000-000000000005', '07000001-0000-0000-0000-000000000001', 'delivered', '11111111-1111-1111-1111-111111111111', 'Consegnato', now() - interval '5 days');

-- ==================== PAYMENTS ====================
INSERT INTO payments (id, order_id, user_id, status, method, amount, currency, provider, paid_at, created_at, updated_at) VALUES
('0a000001-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '07000001-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'succeeded', 'credit_card', 169.45, 'EUR', 'stripe', now() - interval '29 days', now() - interval '30 days', now() - interval '29 days'),
('0a000002-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '07000002-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'succeeded', 'credit_card', 101.03, 'EUR', 'stripe', now() - interval '6 days', now() - interval '7 days', now() - interval '6 days'),
('0a000003-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '07000003-0000-0000-0000-000000000003', '44444444-4444-4444-4444-444444444444', 'succeeded', 'paypal', 281.81, 'EUR', 'paypal', now() - interval '2 days', now() - interval '3 days', now() - interval '2 days'),
('0a000004-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '07000004-0000-0000-0000-000000000004', '55555555-5555-5555-5555-555555555555', 'succeeded', 'credit_card', 384.11, 'EUR', 'stripe', now() - interval '44 days', now() - interval '45 days', now() - interval '44 days'),
('0a000005-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '07000005-0000-0000-0000-000000000005', '66666666-6666-6666-6666-666666666666', 'pending', 'credit_card', 147.59, 'EUR', 'stripe', NULL, now() - interval '2 days', now() - interval '2 days'),
('0a000006-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '07000006-0000-0000-0000-000000000006', '77777777-7777-7777-7777-777777777777', 'succeeded', 'credit_card', 221.36, 'EUR', 'stripe', now() - interval '19 days', now() - interval '20 days', now() - interval '19 days'),
('0a000007-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '07000007-0000-0000-0000-000000000007', '99999999-9999-9999-9999-999999999999', 'succeeded', 'credit_card', 675.18, 'EUR', 'stripe', now() - interval '59 days', now() - interval '60 days', now() - interval '59 days'),
('0a000008-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '07000008-0000-0000-0000-000000000008', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'failed', 'credit_card', 89.99, 'EUR', 'stripe', NULL, now() - interval '10 days', now() - interval '9 days');

-- ==================== REVIEWS ====================
INSERT INTO reviews (id, user_id, product_id, order_id, rating, title, body, status, is_verified, helpful_count, created_at, updated_at) VALUES
('0b000001-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'd0000002-dddd-dddd-dddd-dddddddddddd', '07000001-0000-0000-0000-000000000001', 5, 'Ottima qualità!', 'La t-shirt premium è veramente bellissima, il cotone organico è straordinariamente comodo e duraturo. Consiglio vivamente!', 'approved', true, 12, now() - interval '20 days', now() - interval '18 days'),
('0b000002-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'd0000004-dddd-dddd-dddd-dddddddddddd', '07000001-0000-0000-0000-000000000001', 5, 'Jeans perfetti', 'Adatti benissimo, ottima vestibilità e colore bellissimo. Spedizione veloce!', 'approved', true, 8, now() - interval '22 days', now() - interval '20 days'),
('0b000003-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333', 'd0000010-dddd-dddd-dddd-dddddddddddd', '07000002-0000-0000-0000-000000000002', 4, 'Buone sneakers', 'Comode per l''uso quotidiano, buona qualità. Leggermente strette la prima volta ma si allargano.', 'approved', true, 5, now() - interval '4 days', now() - interval '2 days'),
('0b000004-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '44444444-4444-4444-4444-444444444444', 'd0000022-dddd-dddd-dddd-dddddddddddd', NULL, 5, 'Gioiello splendido', 'La collana oro è veramente bellissima, ben lavorata e il colore è esattamente come da foto. Ne sono innamorata!', 'pending', false, 0, now() - interval '1 day', now() - interval '1 day'),
('0b000005-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '55555555-5555-5555-5555-555555555555', 'd0000001-dddd-dddd-dddd-dddddddddddd', NULL, 3, 'Decente ma non eccezionale', 'La t-shirt è ok ma pensavo fosse più spessa. Il prezzo è un po'' alto per la qualità.', 'approved', false, 2, now() - interval '25 days', now() - interval '23 days'),
('0b000006-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '77777777-7777-7777-7777-777777777777', 'd0000023-dddd-dddd-dddd-dddddddddddd', '07000007-0000-0000-0000-000000000007', 5, 'Bellissimo anello!', 'L''anello con diamante è semplicemente perfetto! La qualità è eccezionale, certificato GIA. Non potrebbe essere più bello. Consigliato!', 'approved', true, 25, now() - interval '40 days', now() - interval '35 days');

-- ==================== WISHLISTS ====================
INSERT INTO wishlists (id, user_id, product_id, variant_id, added_at) VALUES
('0c000001-cccc-cccc-cccc-cccccccccccc', '22222222-2222-2222-2222-222222222222', 'd0000023-dddd-dddd-dddd-dddddddddddd', 'e0000021-eeee-eeee-eeee-eeeeeeeeeeee', now() - interval '5 days'),
('0c000002-cccc-cccc-cccc-cccccccccccc', '33333333-3333-3333-3333-333333333333', 'd0000022-dddd-dddd-dddd-dddddddddddd', 'e0000020-eeee-eeee-eeee-eeeeeeeeeeee', now() - interval '3 days'),
('0c000003-cccc-cccc-cccc-cccccccccccc', '44444444-4444-4444-4444-444444444444', 'd0000009-dddd-dddd-dddd-dddddddddddd', NULL, now() - interval '10 days'),
('0c000004-cccc-cccc-cccc-cccccccccccc', '55555555-5555-5555-5555-555555555555', 'd0000008-dddd-dddd-dddd-dddddddddddd', NULL, now() - interval '1 day'),
('0c000005-cccc-cccc-cccc-cccccccccccc', '66666666-6666-6666-6666-666666666666', 'd0000013-dddd-dddd-dddd-dddddddddddd', 'e0000023-eeee-eeee-eeee-eeeeeeeeeeee', now() - interval '7 days'),
('0c000006-cccc-cccc-cccc-cccccccccccc', '77777777-7777-7777-7777-777777777777', 'd0000019-dddd-dddd-dddd-dddddddddddd', NULL, now() - interval '2 days'),
('0c000007-cccc-cccc-cccc-cccccccccccc', '99999999-9999-9999-9999-999999999999', 'd0000015-dddd-dddd-dddd-dddddddddddd', NULL, now() - interval '8 days');

-- ==================== GIFT CARDS ====================
INSERT INTO gift_cards (id, code, issued_to, issued_by, initial_balance, current_balance, is_active, created_at) VALUES
('0d000001-dddd-dddd-dddd-dddddddddddd', 'GC-2024-001', '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 100, 45.50, true, now() - interval '60 days'),
('0d000002-dddd-dddd-dddd-dddddddddddd', 'GC-2024-002', '33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 50, 25.75, true, now() - interval '40 days'),
('0d000003-dddd-dddd-dddd-dddddddddddd', 'GC-2024-003', NULL, '11111111-1111-1111-1111-111111111111', 200, 200, true, now() - interval '5 days');

-- ==================== NOTIFICATIONS ====================
INSERT INTO notifications (id, user_id, type, title, body, link, is_read, created_at) VALUES
('0e000001-eeee-eeee-eeee-eeeeeeeeeeee', '22222222-2222-2222-2222-222222222222', 'order_update', 'Ordine Consegnato', 'Il tuo ordine è stato consegnato con successo!', '/orders/07000001-0000-0000-0000-000000000001', true, now() - interval '5 days'),
('0e000002-eeee-eeee-eeee-eeeeeeeeeeee', '22222222-2222-2222-2222-222222222222', 'promo', 'Nuovo Sconto Disponibile', 'Usa il codice SUMMER30 per ottenere uno sconto del 30%!', '/shop', false, now() - interval '2 days'),
('0e000003-eeee-eeee-eeee-eeeeeeeeeeee', '33333333-3333-3333-3333-333333333333', 'order_update', 'Ordine Spedito', 'Il tuo ordine è stato spedito. Numero tracciamento disponibile.', '/orders/07000002-0000-0000-0000-000000000002', true, now() - interval '1 day'),
('0e000004-eeee-eeee-eeee-eeeeeeeeeeee', '44444444-4444-4444-4444-444444444444', 'review_reply', 'Risposta alla tua Recensione', 'L''amministratore ha risposto alla tua recensione sul prodotto.', '/products/d0000022-dddd-dddd-dddd-dddddddddddd', false, now() - interval '6 hours');

-- ==================== RETURNS ====================
INSERT INTO returns (id, order_id, user_id, status, reason, refund_amount, created_at, updated_at) VALUES
('0f000001-ffff-ffff-ffff-ffffffffffff', '07000004-0000-0000-0000-000000000004', '55555555-5555-5555-5555-555555555555', 'refunded', 'Taglia non idonea', 64.99, now() - interval '35 days', now() - interval '25 days'),
('0f000002-ffff-ffff-ffff-ffffffffffff', '07000006-0000-0000-0000-000000000006', '77777777-7777-7777-7777-777777777777', 'requested', 'Prodotto difettoso', 19.99, now() - interval '8 days', now() - interval '8 days');

-- Re-enable triggers
ALTER TABLE products ENABLE TRIGGER ALL;
ALTER TABLE product_variants ENABLE TRIGGER ALL;