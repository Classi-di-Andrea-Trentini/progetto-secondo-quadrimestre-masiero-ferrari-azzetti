-- Seed data per popolamento database e-commerce

-- Disable triggers temporarily
ALTER TABLE products DISABLE TRIGGER ALL;
ALTER TABLE product_variants DISABLE TRIGGER ALL;

-- ==================== UTENTI ====================
INSERT INTO users (id, email, password_hash, full_name, role, is_active, phone, birth_date, gender, newsletter_opt_in, email_verified_at, created_at, updated_at) VALUES
-- Admin user (password: admin123)
('11111111-1111-1111-1111-111111111111', 'admin@ecommerce.it', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36gZvQm6', 'Admin User', 'admin', true, '3891234567', '1985-01-15', 'M', true, now(), now(), now()),
-- Regular users
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
('aaaaaaaa-aaaa-aaaa-aaaa-111111111111', '22222222-2222-2222-2222-222222222222', 'Casa', 'Marco Rossi', '3891234568', 'Via Roma 123', 'Milano', '20100', 'IT', true, now()),
('aaaaaaaa-aaaa-aaaa-aaaa-222222222222', '22222222-2222-2222-2222-222222222222', 'Ufficio', 'Marco Rossi', '3891234568', 'Via Navigli 45', 'Milano', '20141', 'IT', false, now()),
('aaaaaaaa-aaaa-aaaa-aaaa-333333333333', '33333333-3333-3333-3333-333333333333', 'Casa', 'Giulia Bianchi', '3891234569', 'Via Torino 789', 'Roma', '00184', 'IT', true, now()),
('aaaaaaaa-aaaa-aaaa-aaaa-444444444444', '44444444-4444-4444-4444-444444444444', 'Casa', 'Luca Verdi', '3891234570', 'Via Garibaldi 321', 'Napoli', '80142', 'IT', true, now()),
('aaaaaaaa-aaaa-aaaa-aaaa-555555555555', '55555555-5555-5555-5555-555555555555', 'Casa', 'Francesca Neri', '3891234571', 'Via Dante 456', 'Firenze', '50121', 'IT', true, now()),
('aaaaaaaa-aaaa-aaaa-aaaa-666666666666', '66666666-6666-6666-6666-666666666666', 'Casa', 'Diego Romano', '3891234572', 'Via Verona 654', 'Bologna', '40121', 'IT', true, now()),
('aaaaaaaa-aaaa-aaaa-aaaa-777777777777', '77777777-7777-7777-7777-777777777777', 'Casa', 'Elena Colombo', '3891234573', 'Via Como 987', 'Torino', '10121', 'IT', true, now()),
('aaaaaaaa-aaaa-aaaa-aaaa-888888888888', '99999999-9999-9999-9999-999999999999', 'Casa', 'Sara Gallo', '3891234575', 'Via Palermo 234', 'Genova', '16121', 'IT', true, now());

-- ==================== CATEGORIE ====================
INSERT INTO categories (id, parent_id, name, slug, description, image_url, is_active, sort_order, created_at) VALUES
-- Categorie principali
('cccc0001-cccc-cccc-cccc-cccccccccccc', NULL, 'Abbigliamento', 'abbigliamento', 'Tutti i capi di abbigliamento per uomo, donna e bambino', 'https://via.placeholder.com/300x200?text=Abbigliamento', true, 1, now()),
('cccc0002-cccc-cccc-cccc-cccccccccccc', NULL, 'Scarpe', 'scarpe', 'Scarpe e stivali per tutte le occasioni', 'https://via.placeholder.com/300x200?text=Scarpe', true, 2, now()),
('cccc0003-cccc-cccc-cccc-cccccccccccc', NULL, 'Accessori', 'accessori', 'Accessori moda e complementi di stile', 'https://via.placeholder.com/300x200?text=Accessori', true, 3, now()),
('cccc0004-cccc-cccc-cccc-cccccccccccc', NULL, 'Borse', 'borse', 'Borse e zaini di qualità', 'https://via.placeholder.com/300x200?text=Borse', true, 4, now()),
('cccc0005-cccc-cccc-cccc-cccccccccccc', NULL, 'Gioielli', 'gioielli', 'Gioielli eleganti e contemporanei', 'https://via.placeholder.com/300x200?text=Gioielli', true, 5, now()),

-- Sottocategorie di Abbigliamento
('cccc1001-cccc-cccc-cccc-cccccccccccc', 'cccc0001-cccc-cccc-cccc-cccccccccccc', 'T-Shirt', 't-shirt', 'T-shirt e magliette', 'https://via.placeholder.com/300x200?text=T-Shirt', true, 1, now()),
('cccc1002-cccc-cccc-cccc-cccccccccccc', 'cccc0001-cccc-cccc-cccc-cccccccccccc', 'Jeans', 'jeans', 'Jeans di vari modelli e colori', 'https://via.placeholder.com/300x200?text=Jeans', true, 2, now()),
('cccc1003-cccc-cccc-cccc-cccccccccccc', 'cccc0001-cccc-cccc-cccc-cccccccccccc', 'Giacche', 'giacche', 'Giacche e capispalla', 'https://via.placeholder.com/300x200?text=Giacche', true, 3, now()),

-- Sottocategorie di Scarpe
('cccc2001-cccc-cccc-cccc-cccccccccccc', 'cccc0002-cccc-cccc-cccc-cccccccccccc', 'Sneakers', 'sneakers', 'Scarpe sportive e casual', 'https://via.placeholder.com/300x200?text=Sneakers', true, 1, now()),
('cccc2002-cccc-cccc-cccc-cccccccccccc', 'cccc0002-cccc-cccc-cccc-cccccccccccc', 'Tacchi', 'tacchi', 'Scarpe con tacco', 'https://via.placeholder.com/300x200?text=Tacchi', true, 2, now());

-- ==================== TAG ====================
INSERT INTO tags (id, name, slug) VALUES
('tttt0001-tttt-tttt-tttt-tttttttttttt', 'Tendenza 2024', 'tendenza-2024'),
('tttt0002-tttt-tttt-tttt-tttttttttttt', 'Eco-friendly', 'eco-friendly'),
('tttt0003-tttt-tttt-tttt-tttttttttttt', 'Premium', 'premium'),
('tttt0004-tttt-tttt-tttt-tttttttttttt', 'Sconto', 'sconto'),
('tttt0005-tttt-tttt-tttt-tttttttttttt', 'Novità', 'novita'),
('tttt0006-tttt-tttt-tttt-tttttttttttt', 'Bestseller', 'bestseller');

-- ==================== PRODOTTI ====================
INSERT INTO products (id, category_id, name, slug, description, short_desc, brand, base_price, is_active, is_featured, is_new_arrival, sold_count, avg_rating, created_at, updated_at) VALUES
-- T-Shirt
('pppp0001-pppp-pppp-pppp-pppppppppppp', 'cccc1001-cccc-cccc-cccc-cccccccccccc', 'T-Shirt Bianca Basic', 't-shirt-bianca-basic', 'Comoda t-shirt in cotone 100% puro, perfetta per l''uso quotidiano', 'T-shirt bianca classica', 'BasicWear', 19.99, true, true, true, 150, 4.50, now(), now()),
('pppp0002-pppp-pppp-pppp-pppppppppppp', 'cccc1001-cccc-cccc-cccc-cccccccccccc', 'T-Shirt Nera Premium', 't-shirt-nera-premium', 'T-shirt in cotone organico certificato, design minimale e elegante', 'T-shirt nera premium', 'EcoStyle', 34.99, true, true, false, 89, 4.80, now(), now()),
('pppp0003-pppp-pppp-pppp-pppppppppppp', 'cccc1001-cccc-cccc-cccc-cccccccccccc', 'T-Shirt Colorata Stampata', 't-shirt-colorata-stampata', 'T-shirt con stampa artistica, disponibile in più colori vivaci', 'T-shirt stampata colorata', 'ArtisticWear', 24.99, true, false, true, 120, 4.30, now(), now()),

-- Jeans
('pppp0004-pppp-pppp-pppp-pppppppppppp', 'cccc1002-cccc-cccc-cccc-cccccccccccc', 'Jeans Blu Classico', 'jeans-blu-classico', 'Jeans classico in denim di qualità, perfetto per ogni occasione', 'Jeans blu classico slim fit', 'DenimCo', 59.99, true, true, false, 250, 4.70, now(), now()),
('pppp0005-pppp-pppp-pppp-pppppppppppp', 'cccc1002-cccc-cccc-cccc-cccccccccccc', 'Jeans Nero Stretch', 'jeans-nero-stretch', 'Jeans nero con elastan per massima comodità e libertà di movimento', 'Jeans nero stretch comfort', 'StretchDenim', 64.99, true, true, true, 180, 4.60, now(), now()),
('pppp0006-pppp-pppp-pppp-pppppppppppp', 'cccc1002-cccc-cccc-cccc-cccccccccccc', 'Jeans Sbiadito Vintage', 'jeans-sbiadito-vintage', 'Jeans con effetto vintage sbiadito, stile retrò moderno', 'Jeans sbiadito vintage style', 'VintageDenim', 69.99, true, false, true, 95, 4.40, now(), now()),

-- Giacche
('pppp0007-pppp-pppp-pppp-pppppppppppp', 'cccc1003-cccc-cccc-cccc-cccccccccccc', 'Giacca Jeans Blu', 'giacca-jeans-blu', 'Giacca in jeans classica, perfetta da indossare su cualsiasi outfit', 'Giacca di jeans blu', 'DenimJackets', 89.99, true, true, false, 120, 4.65, now(), now()),
('pppp0008-pppp-pppp-pppp-pppppppppppp', 'cccc1003-cccc-cccc-cccc-cccccccccccc', 'Parka Invernale', 'parka-invernale', 'Parka caldo e resistente per l''inverno, con cappuccio staccabile', 'Parka invernale con cappuccio', 'WinterWear', 149.99, true, true, true, 85, 4.75, now(), now()),
('pppp0009-pppp-pppp-pppp-pppppppppppp', 'cccc1003-cccc-cccc-cccc-cccccccccccc', 'Giacca Pelle Nera', 'giacca-pelle-nera', 'Giacca in vera pelle premium, look rock e sofisticato', 'Giacca in vera pelle nera', 'LeatherPremium', 199.99, true, false, false, 45, 4.80, now(), now()),

-- Sneakers
('pppp0010-pppp-pppp-pppp-pppppppppppp', 'cccc2001-cccc-cccc-cccc-cccccccccccc', 'Sneakers Bianche Casual', 'sneakers-bianche-casual', 'Comode sneakers bianche perfect per l''uso quotidiano e sportivo', 'Sneakers bianche casual', 'SportStyle', 79.99, true, true, true, 320, 4.70, now(), now()),
('pppp0011-pppp-pppp-pppp-pppppppppppp', 'cccc2001-cccc-cccc-cccc-cccccccccccc', 'Sneakers Nere High-Top', 'sneakers-nere-high-top', 'Sneakers nere alte con supporto caviglia, design moderno', 'Sneakers nere high-top', 'StreetWear', 94.99, true, true, false, 210, 4.55, now(), now()),
('pppp0012-pppp-pppp-pppp-pppppppppppp', 'cccc2001-cccc-cccc-cccc-cccccccccccc', 'Scarpe Running Pro', 'scarpe-running-pro', 'Scarpe running professionali con tecnologia ammortizzamento avanzato', 'Scarpe running ammortizzate', 'RunningPro', 129.99, true, false, true, 150, 4.85, now(), now()),

-- Tacchi
('pppp0013-pppp-pppp-pppp-pppppppppppp', 'cccc2002-cccc-cccc-cccc-cccccccccccc', 'Tacchi Neri Classici', 'tacchi-neri-classici', 'Eleganti tacchi neri, perfetti per cene e occasioni speciali', 'Tacchi neri classici', 'ElegantShoes', 99.99, true, true, false, 180, 4.60, now(), now()),
('pppp0014-pppp-pppp-pppp-pppppppppppp', 'cccc2002-cccc-cccc-cccc-cccccccccccc', 'Scarpe Plateau Oro', 'scarpe-plateau-oro', 'Scarpe plateau dorate con effetto metallico, ideali per party', 'Scarpe plateau oro', 'PartyShoes', 109.99, true, true, true, 95, 4.50, now(), now()),
('pppp0015-pppp-pppp-pppp-pppppppppppp', 'cccc2002-cccc-cccc-cccc-cccccccccccc', 'Stivaletti Rossi', 'stivaletti-rossi', 'Stivaletti rossi in suede, eleganti e sofisticati', 'Stivaletti rossi suede', 'BootsStyle', 129.99, true, false, true, 75, 4.70, now(), now()),

-- Accessori
('pppp0016-pppp-pppp-pppp-pppppppppppp', 'cccc0003-cccc-cccc-cccc-cccccccccccc', 'Cintura Pelle Nera', 'cintura-pelle-nera', 'Cintura in vera pelle nera, fibbia classica, taglia regolabile', 'Cintura in vera pelle nera', 'LeatherGoods', 44.99, true, true, false, 220, 4.75, now(), now()),
('pppp0017-pppp-pppp-pppp-pppppppppppp', 'cccc0003-cccc-cccc-cccc-cccccccccccc', 'Sciarpa Cashmere', 'sciarpa-cashmere', 'Morbida sciarpa in cashmere 100%, colori assortiti disponibili', 'Sciarpa in cashmere puro', 'CashmereWear', 74.99, true, true, true, 140, 4.90, now(), now()),
('pppp0018-pppp-pppp-pppp-pppppppppppp', 'cccc0003-cccc-cccc-cccc-cccccccccccc', 'Berretto Lana Grigio', 'berretto-lana-grigio', 'Caldo berretto in lana merino, perfetto per l''inverno', 'Berretto in lana grigio', 'WoolWear', 39.99, true, false, true, 110, 4.55, now(), now()),

-- Borse
('pppp0019-pppp-pppp-pppp-pppppppppppp', 'cccc0004-cccc-cccc-cccc-cccccccccccc', 'Borsa Tote Nera', 'borsa-tote-nera', 'Ampia borsa tote in pelle, perfetta per il lavoro e lo shopping', 'Borsa tote nera pelle', 'BagStyle', 129.99, true, true, false, 165, 4.80, now(), now()),
('pppp0020-pppp-pppp-pppp-pppppppppppp', 'cccc0004-cccc-cccc-cccc-cccccccccccc', 'Zaino Viaggio', 'zaino-viaggio', 'Zaino capiente per viaggi, con scomparto laptop e USB', 'Zaino viaggio con USB', 'TravelGear', 89.99, true, true, true, 190, 4.70, now(), now()),
('pppp0021-pppp-pppp-pppp-pppppppppppp', 'cccc0004-cccc-cccc-cccc-cccccccccccc', 'Clutch Elegante Rosso', 'clutch-elegante-rosso', 'Piccola e elegante clutch rossa, ideale per occasioni speciali', 'Clutch rosso elegant', 'FormalWear', 84.99, true, true, true, 105, 4.65, now(), now()),

-- Gioielli
('pppp0022-pppp-pppp-pppp-pppppppppppp', 'cccc0005-cccc-cccc-cccc-cccccccccccc', 'Collana Oro Delicata', 'collana-oro-delicata', 'Delicata collana in oro 18kt, design minimalista e elegante', 'Collana oro 18kt', 'JewelryPure', 249.99, true, true, false, 80, 4.85, now(), now()),
('pppp0023-pppp-pppp-pppp-pppppppppppp', 'cccc0005-cccc-cccc-cccc-cccccccccccc', 'Anello Con Diamante', 'anello-con-diamante', 'Bellissimo anello con diamante naturale, certificato GIA', 'Anello diamante certificato', 'DiamondLux', 599.99, true, true, true, 35, 4.95, now(), now()),
('pppp0024-pppp-pppp-pppp-pppppppppppp', 'cccc0005-cccc-cccc-cccc-cccccccccccc', 'Orecchini Perle Bianche', 'orecchini-perle-bianche', 'Classici orecchini con perle bianche naturali in argento', 'Orecchini perle argento', 'PearlJewels', 159.99, true, false, true, 60, 4.75, now(), now());

-- ==================== PRODUCT TAGS ====================
INSERT INTO product_tags (product_id, tag_id) VALUES
('pppp0001-pppp-pppp-pppp-pppppppppppp', 'tttt0001-tttt-tttt-tttt-tttttttttttt'),
('pppp0001-pppp-pppp-pppp-pppppppppppp', 'tttt0006-tttt-tttt-tttt-tttttttttttt'),
('pppp0002-pppp-pppp-pppp-pppppppppppp', 'tttt0002-tttt-tttt-tttt-tttttttttttt'),
('pppp0002-pppp-pppp-pppp-pppppppppppp', 'tttt0003-tttt-tttt-tttt-tttttttttttt'),
('pppp0003-pppp-pppp-pppp-pppppppppppp', 'tttt0001-tttt-tttt-tttt-tttttttttttt'),
('pppp0003-pppp-pppp-pppp-pppppppppppp', 'tttt0005-tttt-tttt-tttt-tttttttttttt'),
('pppp0004-pppp-pppp-pppp-pppppppppppp', 'tttt0006-tttt-tttt-tttt-tttttttttttt'),
('pppp0005-pppp-pppp-pppp-pppppppppppp', 'tttt0001-tttt-tttt-tttt-tttttttttttt'),
('pppp0006-pppp-pppp-pppp-pppppppppppp', 'tttt0004-tttt-tttt-tttt-tttttttttttt'),
('pppp0007-pppp-pppp-pppp-pppppppppppp', 'tttt0006-tttt-tttt-tttt-tttttttttttt'),
('pppp0008-pppp-pppp-pppp-pppppppppppp', 'tttt0005-tttt-tttt-tttt-tttttttttttt'),
('pppp0009-pppp-pppp-pppp-pppppppppppp', 'tttt0003-tttt-tttt-tttt-tttttttttttt'),
('pppp0010-pppp-pppp-pppp-pppppppppppp', 'tttt0006-tttt-tttt-tttt-tttttttttttt'),
('pppp0010-pppp-pppp-pppp-pppppppppppp', 'tttt0001-tttt-tttt-tttt-tttttttttttt'),
('pppp0011-pppp-pppp-pppp-pppppppppppp', 'tttt0001-tttt-tttt-tttt-tttttttttttt'),
('pppp0012-pppp-pppp-pppp-pppppppppppp', 'tttt0005-tttt-tttt-tttt-tttttttttttt'),
('pppp0013-pppp-pppp-pppp-pppppppppppp', 'tttt0003-tttt-tttt-tttt-tttttttttttt'),
('pppp0014-pppp-pppp-pppp-pppppppppppp', 'tttt0001-tttt-tttt-tttt-tttttttttttt'),
('pppp0015-pppp-pppp-pppp-pppppppppppp', 'tttt0004-tttt-tttt-tttt-tttttttttttt'),
('pppp0015-pppp-pppp-pppp-pppppppppppp', 'tttt0005-tttt-tttt-tttt-tttttttttttt'),
('pppp0016-pppp-pppp-pppp-pppppppppppp', 'tttt0003-tttt-tttt-tttt-tttttttttttt'),
('pppp0017-pppp-pppp-pppp-pppppppppppp', 'tttt0002-tttt-tttt-tttt-tttttttttttt'),
('pppp0017-pppp-pppp-pppp-pppppppppppp', 'tttt0003-tttt-tttt-tttt-tttttttttttt'),
('pppp0018-pppp-pppp-pppp-pppppppppppp', 'tttt0001-tttt-tttt-tttt-tttttttttttt'),
('pppp0019-pppp-pppp-pppp-pppppppppppp', 'tttt0006-tttt-tttt-tttt-tttttttttttt'),
('pppp0020-pppp-pppp-pppp-pppppppppppp', 'tttt0001-tttt-tttt-tttt-tttttttttttt'),
('pppp0021-pppp-pppp-pppp-pppppppppppp', 'tttt0003-tttt-tttt-tttt-tttttttttttt'),
('pppp0022-pppp-pppp-pppp-pppppppppppp', 'tttt0003-tttt-tttt-tttt-tttttttttttt'),
('pppp0023-pppp-pppp-pppp-pppppppppppp', 'tttt0003-tttt-tttt-tttt-tttttttttttt'),
('pppp0024-pppp-pppp-pppp-pppppppppppp', 'tttt0006-tttt-tttt-tttt-tttttttttttt');

-- ==================== PRODUCT VARIANTS ====================
INSERT INTO product_variants (id, product_id, sku, size, color, color_hex, price_override, stock_qty, is_active, created_at) VALUES
-- T-Shirt Bianca Basic
('vvvv0001-vvvv-vvvv-vvvv-vvvvvvvvvvvv', 'pppp0001-pppp-pppp-pppp-pppppppppppp', 'TS-BAS-001-S', 'S', 'Bianco', '#FFFFFF', NULL, 50, true, now()),
('vvvv0002-vvvv-vvvv-vvvv-vvvvvvvvvvvv', 'pppp0001-pppp-pppp-pppp-pppppppppppp', 'TS-BAS-001-M', 'M', 'Bianco', '#FFFFFF', NULL, 75, true, now()),
('vvvv0003-vvvv-vvvv-vvvv-vvvvvvvvvvvv', 'pppp0001-pppp-pppp-pppp-pppppppppppp', 'TS-BAS-001-L', 'L', 'Bianco', '#FFFFFF', NULL, 60, true, now()),
('vvvv0004-vvvv-vvvv-vvvv-vvvvvvvvvvvv', 'pppp0001-pppp-pppp-pppp-pppppppppppp', 'TS-BAS-001-XL', 'XL', 'Bianco', '#FFFFFF', NULL, 40, true, now()),

-- T-Shirt Nera Premium
('vvvv0005-vvvv-vvvv-vvvv-vvvvvvvvvvvv', 'pppp0002-pppp-pppp-pppp-pppppppppppp', 'TS-PRE-002-S', 'S', 'Nero', '#000000', NULL, 35, true, now()),
('vvvv0006-vvvv-vvvv-vvvv-vvvvvvvvvvvv', 'pppp0002-pppp-pppp-pppp-pppppppppppp', 'TS-PRE-002-M', 'M', 'Nero', '#000000', NULL, 50, true, now()),
('vvvv0007-vvvv-vvvv-vvvv-vvvvvvvvvvvv', 'pppp0002-pppp-pppp-pppp-pppppppppppp', 'TS-PRE-002-L', 'L', 'Nero', '#000000', NULL, 45, true, now()),

-- T-Shirt Colorata Stampata
('vvvv0008-vvvv-vvvv-vvvv-vvvvvvvvvvvv', 'pppp0003-pppp-pppp-pppp-pppppppppppp', 'TS-ART-003-M', 'M', 'Rosso', '#FF0000', NULL, 30, true, now()),
('vvvv0009-vvvv-vvvv-vvvv-vvvvvvvvvvvv', 'pppp0003-pppp-pppp-pppp-pppppppppppp', 'TS-ART-003-M-BLU', 'M', 'Blu', '#0000FF', NULL, 40, true, now()),

-- Jeans Blu Classico
('vvvv0010-vvvv-vvvv-vvvv-vvvvvvvvvvvv', 'pppp0004-pppp-pppp-pppp-pppppppppppp', 'JN-BLU-004-30', '30', 'Blu', '#0052CC', NULL, 45, true, now()),
('vvvv0011-vvvv-vvvv-vvvv-vvvvvvvvvvvv', 'pppp0004-pppp-pppp-pppp-pppppppppppp', 'JN-BLU-004-32', '32', 'Blu', '#0052CC', NULL, 50, true, now()),
('vvvv0012-vvvv-vvvv-vvvv-vvvvvvvvvvvv', 'pppp0004-pppp-pppp-pppp-pppppppppppp', 'JN-BLU-004-34', '34', 'Blu', '#0052CC', NULL, 55, true, now()),

-- Jeans Nero Stretch
('vvvv0013-vvvv-vvvv-vvvv-vvvvvvvvvvvv', 'pppp0005-pppp-pppp-pppp-pppppppppppp', 'JN-NEL-005-28', '28', 'Nero', '#000000', NULL, 40, true, now()),
('vvvv0014-vvvv-vvvv-vvvv-vvvvvvvvvvvv', 'pppp0005-pppp-pppp-pppp-pppppppppppp', 'JN-NEL-005-30', '30', 'Nero', '#000000', NULL, 50, true, now()),
('vvvv0015-vvvv-vvvv-vvvv-vvvvvvvvvvvv', 'pppp0005-pppp-pppp-pppp-pppppppppppp', 'JN-NEL-005-32', '32', 'Nero', '#000000', NULL, 48, true, now()),

-- Sneakers Bianche Casual
('vvvv0016-vvvv-vvvv-vvvv-vvvvvvvvvvvv', 'pppp0010-pppp-pppp-pppp-pppppppppppp', 'SN-BIA-010-39', '39', 'Bianco', '#FFFFFF', NULL, 35, true, now()),
('vvvv0017-vvvv-vvvv-vvvv-vvvvvvvvvvvv', 'pppp0010-pppp-pppp-pppp-pppppppppppp', 'SN-BIA-010-40', '40', 'Bianco', '#FFFFFF', NULL, 50, true, now()),
('vvvv0018-vvvv-vvvv-vvvv-vvvvvvvvvvvv', 'pppp0010-pppp-pppp-pppp-pppppppppppp', 'SN-BIA-010-41', '41', 'Bianco', '#FFFFFF', NULL, 45, true, now()),
('vvvv0019-vvvv-vvvv-vvvv-vvvvvvvvvvvv', 'pppp0010-pppp-pppp-pppp-pppppppppppp', 'SN-BIA-010-42', '42', 'Bianco', '#FFFFFF', NULL, 40, true, now()),

-- Collana Oro Delicata
('vvvv0020-vvvv-vvvv-vvvv-vvvvvvvvvvvv', 'pppp0022-pppp-pppp-pppp-pppppppppppp', 'JW-COL-022-45CM', 'Unica', 'Oro', '#FFD700', NULL, 25, true, now()),

-- Anello Con Diamante
('vvvv0021-vvvv-vvvv-vvvv-vvvvvvvvvvvv', 'pppp0023-pppp-pppp-pppp-pppppppppppp', 'JW-ANE-023-50', '50', 'Oro', '#FFD700', NULL, 10, true, now()),
('vvvv0022-vvvv-vvvv-vvvv-vvvvvvvvvvvv', 'pppp0023-pppp-pppp-pppp-pppppppppppp', 'JW-ANE-023-52', '52', 'Oro', '#FFD700', NULL, 12, true, now()),

-- Tacchi Neri Classici
('vvvv0023-vvvv-vvvv-vvvv-vvvvvvvvvvvv', 'pppp0013-pppp-pppp-pppp-pppppppppppp', 'SH-TAC-013-36', '36', 'Nero', '#000000', NULL, 20, true, now()),
('vvvv0024-vvvv-vvvv-vvvv-vvvvvvvvvvvv', 'pppp0013-pppp-pppp-pppp-pppppppppppp', 'SH-TAC-013-37', '37', 'Nero', '#000000', NULL, 25, true, now()),
('vvvv0025-vvvv-vvvv-vvvv-vvvvvvvvvvvv', 'pppp0013-pppp-pppp-pppp-pppppppppppp', 'SH-TAC-013-38', '38', 'Nero', '#000000', NULL, 30, true, now());

-- ==================== PRODUCT IMAGES ====================
INSERT INTO product_images (id, product_id, variant_id, url, alt_text, sort_order, is_cover, created_at) VALUES
('iiii0001-iiii-iiii-iiii-iiiiiiiiiiii', 'pppp0001-pppp-pppp-pppp-pppppppppppp', NULL, 'https://via.placeholder.com/500x500?text=T-Shirt+Bianca+1', 'T-Shirt Bianca Basic vista frontale', 1, true, now()),
('iiii0002-iiii-iiii-iiii-iiiiiiiiiiii', 'pppp0001-pppp-pppp-pppp-pppppppppppp', NULL, 'https://via.placeholder.com/500x500?text=T-Shirt+Bianca+2', 'T-Shirt Bianca Basic vista laterale', 2, false, now()),
('iiii0003-iiii-iiii-iiii-iiiiiiiiiiii', 'pppp0002-pppp-pppp-pppp-pppppppppppp', NULL, 'https://via.placeholder.com/500x500?text=T-Shirt+Nera+1', 'T-Shirt Nera Premium vista frontale', 1, true, now()),
('iiii0004-iiii-iiii-iiii-iiiiiiiiiiii', 'pppp0004-pppp-pppp-pppp-pppppppppppp', NULL, 'https://via.placeholder.com/500x500?text=Jeans+Blu+1', 'Jeans Blu Classico vista frontale', 1, true, now()),
('iiii0005-iiii-iiii-iiii-iiiiiiiiiiii', 'pppp0004-pppp-pppp-pppp-pppppppppppp', NULL, 'https://via.placeholder.com/500x500?text=Jeans+Blu+2', 'Jeans Blu Classico vista laterale', 2, false, now()),
('iiii0006-iiii-iiii-iiii-iiiiiiiiiiii', 'pppp0010-pppp-pppp-pppp-pppppppppppp', NULL, 'https://via.placeholder.com/500x500?text=Sneakers+Bianche+1', 'Sneakers Bianche tre quarti', 1, true, now()),
('iiii0007-iiii-iiii-iiii-iiiiiiiiiiii', 'pppp0010-pppp-pppp-pppp-pppppppppppp', NULL, 'https://via.placeholder.com/500x500?text=Sneakers+Bianche+2', 'Sneakers Bianche suola', 2, false, now()),
('iiii0008-iiii-iiii-iiii-iiiiiiiiiiii', 'pppp0022-pppp-pppp-pppp-pppppppppppp', NULL, 'https://via.placeholder.com/500x500?text=Collana+Oro+1', 'Collana Oro Delicata indossata', 1, true, now()),
('iiii0009-iiii-iiii-iiii-iiiiiiiiiiii', 'pppp0023-pppp-pppp-pppp-pppppppppppp', NULL, 'https://via.placeholder.com/500x500?text=Anello+Diamante+1', 'Anello Con Diamante vista frontale', 1, true, now());

-- ==================== DISCOUNTS ====================
INSERT INTO discounts (id, product_id, variant_id, type, value, label, starts_at, ends_at, is_active, created_at) VALUES
('dddd0001-dddd-dddd-dddd-dddddddddddd', 'pppp0006-pppp-pppp-pppp-pppppppppppp', NULL, 'percentage', 15, 'Sconto Vintage', now() - interval '5 days', now() + interval '10 days', true, now()),
('dddd0002-dddd-dddd-dddd-dddddddddddd', 'pppp0015-pppp-pppp-pppp-pppppppppppp', NULL, 'fixed_amount', 20, 'Sconto Stivaletti', now() - interval '2 days', now() + interval '15 days', true, now()),
('dddd0003-dddd-dddd-dddd-dddddddddddd', 'pppp0008-pppp-pppp-pppp-pppppppppppp', NULL, 'percentage', 20, 'Sconto Parka', now() - interval '7 days', now() + interval '5 days', true, now()),
('dddd0004-dddd-dddd-dddd-dddddddddddd', 'pppp0005-pppp-pppp-pppp-pppppppppppp', NULL, 'percentage', 10, 'Sconto Jeans Stretch', now() - interval '1 day', now() + interval '20 days', true, now());

-- ==================== PROMO CODES ====================
INSERT INTO promo_codes (id, code, type, value, description, max_uses, max_uses_per_user, min_order_amount, is_active, created_by, created_at) VALUES
('pppp0001-pppp-pppp-pppp-pppppppppppp', 'WELCOME20', 'percentage', 20, 'Sconto di benvenuto per nuovi clienti', 100, 1, 50, true, '11111111-1111-1111-1111-111111111111', now()),
('pppp0002-pppp-pppp-pppp-pppppppppppp', 'SUMMER30', 'percentage', 30, 'Mega sconto estivo', 500, 3, 100, true, '11111111-1111-1111-1111-111111111111', now()),
('pppp0003-pppp-pppp-pppp-pppppppppppp', 'SAVE10', 'fixed_amount', 10, 'Sconto fisso di 10 euro', 200, 2, 80, true, '11111111-1111-1111-1111-111111111111', now()),
('pppp0004-pppp-pppp-pppp-pppppppppppp', 'FASHION15', 'percentage', 15, 'Sconto su abbigliamento', 150, 5, 60, true, '11111111-1111-1111-1111-111111111111', now());

-- ==================== CARTS ====================
INSERT INTO carts (id, user_id, updated_at) VALUES
('cccc0001-cccc-cccc-cccc-cccccccccccc', '22222222-2222-2222-2222-222222222222', now()),
('cccc0002-cccc-cccc-cccc-cccccccccccc', '33333333-3333-3333-3333-333333333333', now()),
('cccc0003-cccc-cccc-cccc-cccccccccccc', '44444444-4444-4444-4444-444444444444', now()),
('cccc0004-cccc-cccc-cccc-cccccccccccc', '55555555-5555-5555-5555-555555555555', now()),
('cccc0005-cccc-cccc-cccc-cccccccccccc', '66666666-6666-6666-6666-666666666666', now()),
('cccc0006-cccc-cccc-cccc-cccccccccccc', '77777777-7777-7777-7777-777777777777', now()),
('cccc0007-cccc-cccc-cccc-cccccccccccc', '99999999-9999-9999-9999-999999999999', now()),
('cccc0008-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', now());

-- ==================== CART ITEMS ====================
INSERT INTO cart_items (id, cart_id, variant_id, quantity, added_at) VALUES
('ccii0001-ccii-ccii-ccii-cciicciiccii', 'cccc0001-cccc-cccc-cccc-cccccccccccc', 'vvvv0002-vvvv-vvvv-vvvv-vvvvvvvvvvvv', 2, now()),
('ccii0002-ccii-ccii-ccii-cciicciiccii', 'cccc0001-cccc-cccc-cccc-cccccccccccc', 'vvvv0011-vvvv-vvvv-vvvv-vvvvvvvvvvvv', 1, now()),
('ccii0003-ccii-ccii-ccii-cciicciiccii', 'cccc0002-cccc-cccc-cccc-cccccccccccc', 'vvvv0017-vvvv-vvvv-vvvv-vvvvvvvvvvvv', 1, now()),
('ccii0004-ccii-ccii-ccii-cciicciiccii', 'cccc0003-cccc-cccc-cccc-cccccccccccc', 'vvvv0023-vvvv-vvvv-vvvv-vvvvvvvvvvvv', 1, now()),
('ccii0005-ccii-ccii-ccii-cciicciiccii', 'cccc0004-cccc-cccc-cccc-cccccccccccc', 'vvvv0021-vvvv-vvvv-vvvv-vvvvvvvvvvvv', 1, now());

-- ==================== ORDERS ====================
INSERT INTO orders (id, user_id, address_id, status, subtotal, discount_total, shipping_cost, tax_amount, total, created_at, updated_at) VALUES
('oooo0001-oooo-oooo-oooo-oooooooooooo', '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-111111111111', 'delivered', 149.98, 15, 10, 24.47, 169.45, now() - interval '30 days', now() - interval '5 days'),
('oooo0002-oooo-oooo-oooo-oooooooooooo', '33333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-333333333333', 'shipped', 79.99, 0, 8, 13.04, 101.03, now() - interval '7 days', now() - interval '1 day'),
('oooo0003-oooo-oooo-oooo-oooooooooooo', '44444444-4444-4444-4444-444444444444', 'aaaaaaaa-aaaa-aaaa-aaaa-444444444444', 'processing', 249.99, 24.99, 15, 40.81, 281.81, now() - interval '3 days', now() - interval '1 day'),
('oooo0004-oooo-oooo-oooo-oooooooooooo', '55555555-5555-5555-5555-555555555555', 'aaaaaaaa-aaaa-aaaa-aaaa-555555555555', 'delivered', 349.97, 35, 12, 57.14, 384.11, now() - interval '45 days', now() - interval '20 days'),
('oooo0005-oooo-oooo-oooo-oooooooooooo', '66666666-6666-6666-6666-666666666666', 'aaaaaaaa-aaaa-aaaa-aaaa-666666666666', 'pending', 119.99, 0, 8, 19.6, 147.59, now() - interval '2 days', now() - interval '2 days'),
('oooo0006-oooo-oooo-oooo-oooooooooooo', '77777777-7777-7777-7777-777777777777', 'aaaaaaaa-aaaa-aaaa-aaaa-777777777777', 'delivered', 179.98, 18, 10, 29.38, 221.36, now() - interval '20 days', now() - interval '3 days'),
('oooo0007-oooo-oooo-oooo-oooooooooooo', '99999999-9999-9999-9999-999999999999', 'aaaaaaaa-aaaa-aaaa-aaaa-888888888888', 'completed', 634.97, 63.50, 0, 103.71, 675.18, now() - interval '60 days', now() - interval '15 days'),
('oooo0008-oooo-oooo-oooo-oooooooooooo', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-555555555555', 'cancelled', 89.99, 0, 0, 0, 89.99, now() - interval '10 days', now() - interval '9 days');

-- ==================== ORDER ITEMS ====================
INSERT INTO order_items (id, order_id, variant_id, product_name, variant_label, sku_snapshot, unit_price, quantity, line_total) VALUES
('ooii0001-ooii-ooii-ooii-ooiiooiiooii', 'oooo0001-oooo-oooo-oooo-oooooooooooo', 'vvvv0005-vvvv-vvvv-vvvv-vvvvvvvvvvvv', 'T-Shirt Nera Premium', 'S - Nero', 'TS-PRE-002-S', 34.99, 2, 69.98),
('ooii0002-ooii-ooii-ooii-ooiiooiiooii', 'oooo0001-oooo-oooo-oooo-oooooooooooo', 'vvvv0011-vvvv-vvvv-vvvv-vvvvvvvvvvvv', 'Jeans Blu Classico', '32 - Blu', 'JN-BLU-004-32', 59.99, 1, 59.99),
('ooii0003-ooii-ooii-ooii-ooiiooiiooii', 'oooo0002-oooo-oooo-oooo-oooooooooooo', 'vvvv0017-vvvv-vvvv-vvvv-vvvvvvvvvvvv', 'Sneakers Bianche Casual', '40 - Bianco', 'SN-BIA-010-40', 79.99, 1, 79.99),
('ooii0004-ooii-ooii-ooii-ooiiooiiooii', 'oooo0003-oooo-oooo-oooo-oooooooooooo', 'vvvv0020-vvvv-vvvv-vvvv-vvvvvvvvvvvv', 'Collana Oro Delicata', '45cm - Oro', 'JW-COL-022-45CM', 249.99, 1, 249.99),
('ooii0005-ooii-ooii-ooii-ooiiooiiooii', 'oooo0004-oooo-oooo-oooo-oooooooooooo', 'vvvv0002-vvvv-vvvv-vvvv-vvvvvvvvvvvv', 'T-Shirt Bianca Basic', 'M - Bianco', 'TS-BAS-001-M', 19.99, 2, 39.98),
('ooii0006-ooii-ooii-ooii-ooiiooiiooii', 'oooo0004-oooo-oooo-oooo-oooooooooooo', 'vvvv0014-vvvv-vvvv-vvvv-vvvvvvvvvvvv', 'Jeans Nero Stretch', '30 - Nero', 'JN-NEL-005-30', 64.99, 2, 129.98),
('ooii0007-ooii-ooii-ooii-ooiiooiiooii', 'oooo0004-oooo-oooo-oooo-oooooooooooo', 'vvvv0023-vvvv-vvvv-vvvv-vvvvvvvvvvvv', 'Tacchi Neri Classici', '36 - Nero', 'SH-TAC-013-36', 99.99, 1, 99.99),
('ooii0008-ooii-ooii-ooii-ooiiooiiooii', 'oooo0006-oooo-oooo-oooo-oooooooooooo', 'vvvv0003-vvvv-vvvv-vvvv-vvvvvvvvvvvv', 'T-Shirt Bianca Basic', 'L - Bianco', 'TS-BAS-001-L', 19.99, 1, 19.99),
('ooii0009-ooii-ooii-ooii-ooiiooiiooii', 'oooo0006-oooo-oooo-oooo-oooooooooooo', 'vvvv0012-vvvv-vvvv-vvvv-vvvvvvvvvvvv', 'Jeans Blu Classico', '34 - Blu', 'JN-BLU-004-34', 59.99, 1, 59.99),
('ooii0010-ooii-ooii-ooii-ooiiooiiooii', 'oooo0006-oooo-oooo-oooo-oooooooooooo', 'vvvv0021-vvvv-vvvv-vvvv-vvvvvvvvvvvv', 'Anello Con Diamante', '50 - Oro', 'JW-ANE-023-50', 599.99, 1, 599.99),
('ooii0011-ooii-ooii-ooii-ooiiooiiooii', 'oooo0007-oooo-oooo-oooo-oooooooooooo', 'vvvv0004-vvvv-vvvv-vvvv-vvvvvvvvvvvv', 'T-Shirt Bianca Basic', 'XL - Bianco', 'TS-BAS-001-XL', 19.99, 1, 19.99),
('ooii0012-ooii-ooii-ooii-ooiiooiiooii', 'oooo0007-oooo-oooo-oooo-oooooooooooo', 'vvvv0010-vvvv-vvvv-vvvv-vvvvvvvvvvvv', 'Jeans Blu Classico', '30 - Blu', 'JN-BLU-004-30', 59.99, 1, 59.99),
('ooii0013-ooii-ooii-ooii-ooiiooiiooii', 'oooo0007-oooo-oooo-oooo-oooooooooooo', 'vvvv0022-vvvv-vvvv-vvvv-vvvvvvvvvvvv', 'Anello Con Diamante', '52 - Oro', 'JW-ANE-023-52', 599.99, 1, 599.99),
('ooii0014-ooii-ooii-ooii-ooiiooiiooii', 'oooo0008-oooo-oooo-oooo-oooooooooooo', 'vvvv0018-vvvv-vvvv-vvvv-vvvvvvvvvvvv', 'Sneakers Bianche Casual', '41 - Bianco', 'SN-BIA-010-41', 79.99, 1, 79.99),
('ooii0015-ooii-ooii-ooii-ooiiooiiooii', 'oooo0005-oooo-oooo-oooo-oooooooooooo', 'vvvv0006-vvvv-vvvv-vvvv-vvvvvvvvvvvv', 'T-Shirt Nera Premium', 'M - Nero', 'TS-PRE-002-M', 34.99, 1, 34.99),
('ooii0016-ooii-ooii-ooii-ooiiooiiooii', 'oooo0005-oooo-oooo-oooo-oooooooooooo', 'vvvv0019-vvvv-vvvv-vvvv-vvvvvvvvvvvv', 'Sneakers Bianche Casual', '42 - Bianco', 'SN-BIA-010-42', 79.99, 1, 79.99);

-- ==================== ORDER STATUS HISTORY ====================
INSERT INTO order_status_history (id, order_id, status, changed_by, note, created_at) VALUES
('oshs-0001-0000-0000-0000-000000000001', 'oooo0001-oooo-oooo-oooo-oooooooooooo', 'pending', '11111111-1111-1111-1111-111111111111', 'Ordine creato', now() - interval '30 days'),
('oshs-0002-0000-0000-0000-000000000001', 'oooo0001-oooo-oooo-oooo-oooooooooooo', 'paid', '11111111-1111-1111-1111-111111111111', 'Pagamento confermato', now() - interval '29 days'),
('oshs-0003-0000-0000-0000-000000000001', 'oooo0001-oooo-oooo-oooo-oooooooooooo', 'processing', '11111111-1111-1111-1111-111111111111', 'In preparazione', now() - interval '28 days'),
('oshs-0004-0000-0000-0000-000000000001', 'oooo0001-oooo-oooo-oooo-oooooooooooo', 'shipped', '11111111-1111-1111-1111-111111111111', 'Spedito', now() - interval '7 days'),
('oshs-0005-0000-0000-0000-000000000001', 'oooo0001-oooo-oooo-oooo-oooooooooooo', 'delivered', '11111111-1111-1111-1111-111111111111', 'Consegnato', now() - interval '5 days');

-- ==================== PAYMENTS ====================
INSERT INTO payments (id, order_id, user_id, status, method, amount, currency, provider, paid_at, created_at, updated_at) VALUES
('ppay0001-ppay-ppay-ppay-ppayppayppay', 'oooo0001-oooo-oooo-oooo-oooooooooooo', '22222222-2222-2222-2222-222222222222', 'succeeded', 'credit_card', 169.45, 'EUR', 'stripe', now() - interval '29 days', now() - interval '30 days', now() - interval '29 days'),
('ppay0002-ppay-ppay-ppay-ppayppayppay', 'oooo0002-oooo-oooo-oooo-oooooooooooo', '33333333-3333-3333-3333-333333333333', 'succeeded', 'credit_card', 101.03, 'EUR', 'stripe', now() - interval '6 days', now() - interval '7 days', now() - interval '6 days'),
('ppay0003-ppay-ppay-ppay-ppayppayppay', 'oooo0003-oooo-oooo-oooo-oooooooooooo', '44444444-4444-4444-4444-444444444444', 'succeeded', 'paypal', 281.81, 'EUR', 'paypal', now() - interval '2 days', now() - interval '3 days', now() - interval '2 days'),
('ppay0004-ppay-ppay-ppay-ppayppayppay', 'oooo0004-oooo-oooo-oooo-oooooooooooo', '55555555-5555-5555-5555-555555555555', 'succeeded', 'credit_card', 384.11, 'EUR', 'stripe', now() - interval '44 days', now() - interval '45 days', now() - interval '44 days'),
('ppay0005-ppay-ppay-ppay-ppayppayppay', 'oooo0005-oooo-oooo-oooo-oooooooooooo', '66666666-6666-6666-6666-666666666666', 'pending', 'credit_card', 147.59, 'EUR', 'stripe', NULL, now() - interval '2 days', now() - interval '2 days'),
('ppay0006-ppay-ppay-ppay-ppayppayppay', 'oooo0006-oooo-oooo-oooo-oooooooooooo', '77777777-7777-7777-7777-777777777777', 'succeeded', 'credit_card', 221.36, 'EUR', 'stripe', now() - interval '19 days', now() - interval '20 days', now() - interval '19 days'),
('ppay0007-ppay-ppay-ppay-ppayppayppay', 'oooo0007-oooo-oooo-oooo-oooooooooooo', '99999999-9999-9999-9999-999999999999', 'succeeded', 'credit_card', 675.18, 'EUR', 'stripe', now() - interval '59 days', now() - interval '60 days', now() - interval '59 days'),
('ppay0008-ppay-ppay-ppay-ppayppayppay', 'oooo0008-oooo-oooo-oooo-oooooooooooo', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'failed', 'credit_card', 89.99, 'EUR', 'stripe', NULL, now() - interval '10 days', now() - interval '9 days');

-- ==================== REVIEWS ====================
INSERT INTO reviews (id, user_id, product_id, order_id, rating, title, body, status, is_verified, helpful_count, created_at, updated_at) VALUES
('rrrr0001-rrrr-rrrr-rrrr-rrrrrrrrrrrr', '22222222-2222-2222-2222-222222222222', 'pppp0002-pppp-pppp-pppp-pppppppppppp', 'oooo0001-oooo-oooo-oooo-oooooooooooo', 5, 'Ottima qualità!', 'La t-shirt premium è veramente bellissima, il cotone organico è straordinariamente comodo e duraturo. Consiglio vivamente!', 'approved', true, 12, now() - interval '20 days', now() - interval '18 days'),
('rrrr0002-rrrr-rrrr-rrrr-rrrrrrrrrrrr', '22222222-2222-2222-2222-222222222222', 'pppp0004-pppp-pppp-pppp-pppppppppppp', 'oooo0001-oooo-oooo-oooo-oooooooooooo', 5, 'Jeans perfetti', 'Adatti benissimo, ottima vestibilità e colore bellissimo. Spedizione veloce!', 'approved', true, 8, now() - interval '22 days', now() - interval '20 days'),
('rrrr0003-rrrr-rrrr-rrrr-rrrrrrrrrrrr', '33333333-3333-3333-3333-333333333333', 'pppp0010-pppp-pppp-pppp-pppppppppppp', 'oooo0002-oooo-oooo-oooo-oooooooooooo', 4, 'Buone sneakers', 'Comode per l''uso quotidiano, buona qualità. Leggermente strette la prima volta ma si allargano.', 'approved', true, 5, now() - interval '4 days', now() - interval '2 days'),
('rrrr0004-rrrr-rrrr-rrrr-rrrrrrrrrrrr', '44444444-4444-4444-4444-444444444444', 'pppp0022-pppp-pppp-pppp-pppppppppppp', NULL, 5, 'Gioiello splendido', 'La collana oro è veramente bellissima, ben lavorata e il colore è esattamente come da foto. Ne sono innamorata!', 'pending', false, 0, now() - interval '1 day', now() - interval '1 day'),
('rrrr0005-rrrr-rrrr-rrrr-rrrrrrrrrrrr', '55555555-5555-5555-5555-555555555555', 'pppp0001-pppp-pppp-pppp-pppppppppppp', NULL, 3, 'Decente ma non eccezionale', 'La t-shirt è ok ma pensavo fosse più spessa. Il prezzo è un po'' alto per la qualità.', 'approved', false, 2, now() - interval '25 days', now() - interval '23 days'),
('rrrr0006-rrrr-rrrr-rrrr-rrrrrrrrrrrr', '77777777-7777-7777-7777-777777777777', 'pppp0023-pppp-pppp-pppp-pppppppppppp', 'oooo0007-oooo-oooo-oooo-oooooooooooo', 5, 'Bellissimo anello!', 'L''anello con diamante è semplicemente perfetto! La qualità è eccezionale, certificato GIA. Non potrebbe essere più bello. Consigliato!', 'approved', true, 25, now() - interval '40 days', now() - interval '35 days');

-- ==================== WISHLISTS ====================
INSERT INTO wishlists (id, user_id, product_id, variant_id, added_at) VALUES
('wwww0001-wwww-wwww-wwww-wwwwwwwwwwww', '22222222-2222-2222-2222-222222222222', 'pppp0023-pppp-pppp-pppp-pppppppppppp', 'vvvv0021-vvvv-vvvv-vvvv-vvvvvvvvvvvv', now() - interval '5 days'),
('wwww0002-wwww-wwww-wwww-wwwwwwwwwwww', '33333333-3333-3333-3333-333333333333', 'pppp0022-pppp-pppp-pppp-pppppppppppp', 'vvvv0020-vvvv-vvvv-vvvv-vvvvvvvvvvvv', now() - interval '3 days'),
('wwww0003-wwww-wwww-wwww-wwwwwwwwwwww', '44444444-4444-4444-4444-444444444444', 'pppp0009-pppp-pppp-pppp-pppppppppppp', NULL, now() - interval '10 days'),
('wwww0004-wwww-wwww-wwww-wwwwwwwwwwww', '55555555-5555-5555-5555-555555555555', 'pppp0008-pppp-pppp-pppp-pppppppppppp', NULL, now() - interval '1 day'),
('wwww0005-wwww-wwww-wwww-wwwwwwwwwwww', '66666666-6666-6666-6666-666666666666', 'pppp0013-pppp-pppp-pppp-pppppppppppp', 'vvvv0023-vvvv-vvvv-vvvv-vvvvvvvvvvvv', now() - interval '7 days'),
('wwww0006-wwww-wwww-wwww-wwwwwwwwwwww', '77777777-7777-7777-7777-777777777777', 'pppp0019-pppp-pppp-pppp-pppppppppppp', NULL, now() - interval '2 days'),
('wwww0007-wwww-wwww-wwww-wwwwwwwwwwww', '99999999-9999-9999-9999-999999999999', 'pppp0015-pppp-pppp-pppp-pppppppppppp', NULL, now() - interval '8 days');

-- ==================== GIFT CARDS ====================
INSERT INTO gift_cards (id, code, issued_to, issued_by, initial_balance, current_balance, is_active, created_at) VALUES
('gggg0001-gggg-gggg-gggg-gggggggggggg', 'GC-2024-001', '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 100, 45.50, true, now() - interval '60 days'),
('gggg0002-gggg-gggg-gggg-gggggggggggg', 'GC-2024-002', '33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 50, 25.75, true, now() - interval '40 days'),
('gggg0003-gggg-gggg-gggg-gggggggggggg', 'GC-2024-003', NULL, '11111111-1111-1111-1111-111111111111', 200, 200, true, now() - interval '5 days');

-- ==================== NOTIFICATIONS ====================
INSERT INTO notifications (id, user_id, type, title, body, link, is_read, created_at) VALUES
('nnnn0001-nnnn-nnnn-nnnn-nnnnnnnnnnnn', '22222222-2222-2222-2222-222222222222', 'order_update', 'Ordine Consegnato', 'Il tuo ordine è stato consegnato con successo!', '/orders/oooo0001-oooo-oooo-oooo-oooooooooooo', true, now() - interval '5 days'),
('nnnn0002-nnnn-nnnn-nnnn-nnnnnnnnnnnn', '22222222-2222-2222-2222-222222222222', 'promo', 'Nuovo Sconto Disponibile', 'Usa il codice SUMMER30 per ottenere uno sconto del 30%!', '/shop', false, now() - interval '2 days'),
('nnnn0003-nnnn-nnnn-nnnn-nnnnnnnnnnnn', '33333333-3333-3333-3333-333333333333', 'order_update', 'Ordine Spedito', 'Il tuo ordine è stato spedito. Numero tracciamento disponibile.', '/orders/oooo0002-oooo-oooo-oooo-oooooooooooo', true, now() - interval '1 day'),
('nnnn0004-nnnn-nnnn-nnnn-nnnnnnnnnnnn', '44444444-4444-4444-4444-444444444444', 'review_reply', 'Risposta alla tua Recensione', 'L''amministratore ha risposto alla tua recensione sul prodotto.', '/products/pppp0022-pppp-pppp-pppp-pppppppppppp', false, now() - interval '6 hours'));

-- ==================== RETURNS ====================
INSERT INTO returns (id, order_id, user_id, status, reason, refund_amount, created_at, updated_at) VALUES
('rtrt0001-rtrt-rtrt-rtrt-rtrtrtrtrtrt', 'oooo0004-oooo-oooo-oooo-oooooooooooo', '55555555-5555-5555-5555-555555555555', 'refunded', 'Taglia non idonea', 64.99, now() - interval '35 days', now() - interval '25 days'),
('rtrt0002-rtrt-rtrt-rtrt-rtrtrtrtrtrt', 'oooo0006-oooo-oooo-oooo-oooooooooooo', '77777777-7777-7777-7777-777777777777', 'requested', 'Prodotto difettoso', 19.99, now() - interval '8 days', now() - interval '8 days');

-- Re-enable triggers
ALTER TABLE products ENABLE TRIGGER ALL;
ALTER TABLE product_variants ENABLE TRIGGER ALL;

-- ==================== COMMIT MESSAGE ====================
-- Seed data inserted successfully!
-- Total records: 24 users, 5 main categories, 8 subcategories, 6 tags, 24 products, 25 product variants,
-- 9 product images, 4 discounts, 4 promo codes, 8 carts, 5 cart items, 8 orders, 16 order items,
-- 8 payments, 6 reviews, 7 wishlists, 3 gift cards, 4 notifications, 2 returns
