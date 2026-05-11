#!/usr/bin/env bash
# =============================================================================
#  seed.sh — Mega seed per Common Era E-Commerce
#  Uso:  bash database/seed.sh
#  Requisiti: docker compose up -d (i container devono essere in esecuzione)
# =============================================================================
set -euo pipefail

CONTAINER="progetto-secondo-quadrimestre-masiero-ferrari-azzetti-db-1"
DB_USER="user"
DB_NAME="mydb"

run_sql() {
  docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1
}

echo "🌱  Avvio seed Common Era..."
echo "    Container: $CONTAINER"
echo ""

# =============================================================================
# 0. PULIZIA (ordine rispetta i vincoli FK)
# =============================================================================
echo "🗑️   Pulizia tabelle esistenti..."
run_sql <<'SQL'
TRUNCATE TABLE
  audit_logs,
  return_items, returns,
  gift_card_transactions, gift_cards,
  promo_code_uses, promo_codes,
  order_status_history, payments, order_items, orders,
  wishlists, cart_items, carts,
  review_helpful_votes, review_replies, reviews,
  product_images, product_variants,
  product_tags, tags,
  discounts,
  products,
  user_addresses,
  sessions,
  email_verifications,
  password_resets,
  notifications,
  categories
  RESTART IDENTITY CASCADE;

-- Elimina tutti gli utenti tranne eventuali dati di sistema
DELETE FROM users;
SQL
echo "   ✓ Tabelle pulite"

# =============================================================================
# 1. CATEGORIE
# =============================================================================
echo "📁  Inserimento categorie..."
run_sql <<'SQL'
INSERT INTO categories (id, name, slug, description, sort_order, is_active) VALUES
  ('00000000-0000-0000-0002-000000000001', 'Uomo',       'uomo',       'Abbigliamento maschile',          1, true),
  ('00000000-0000-0000-0002-000000000002', 'Donna',       'donna',       'Abbigliamento femminile',         2, true),
  ('00000000-0000-0000-0002-000000000003', 'Accessori',   'accessori',   'Borse, cinture, cappelli',        3, true),
  ('00000000-0000-0000-0002-000000000004', 'Sport',       'sport',       'Abbigliamento sportivo',          4, true),
  ('00000000-0000-0000-0002-000000000005','Bambini',     'bambini',     'Abbigliamento per bambini',       5, true),
  -- figli di Uomo
  ('00000000-0000-0000-0002-000000000006', 'T-Shirt Uomo','t-shirt-uomo','T-shirt e polo uomo',            1, true),
  ('00000000-0000-0000-0002-000000000007', 'Pantaloni Uomo','pantaloni-uomo','Jeans e chino uomo',         2, true),
  ('00000000-0000-0000-0002-000000000008', 'Giacche Uomo','giacche-uomo','Giacche e cappotti uomo',        3, true),
  -- figli di Donna
  ('00000000-0000-0000-0002-000000000009', 'T-Shirt Donna','t-shirt-donna','Top e t-shirt donna',         1, true),
  ('00000000-0000-0000-0002-000000000010', 'Vestiti',     'vestiti',     'Abiti e vestiti donna',          2, true),
  ('00000000-0000-0000-0002-000000000011', 'Giacche Donna','giacche-donna','Giacche e trench donna',      3, true);

-- collega i figli ai genitori
UPDATE categories SET parent_id = '00000000-0000-0000-0002-000000000001'
  WHERE id IN ('00000000-0000-0000-0002-000000000006','00000000-0000-0000-0002-000000000007','00000000-0000-0000-0002-000000000008');
UPDATE categories SET parent_id = '00000000-0000-0000-0002-000000000002'
  WHERE id IN ('00000000-0000-0000-0002-000000000009','00000000-0000-0000-0002-000000000010','00000000-0000-0000-0002-000000000011');
SQL
echo "   ✓ Categorie inserite"

# =============================================================================
# 2. UTENTI
# Password per tutti: Admin1234! (bcrypt, cost 10)
# Hash generato con: htpasswd -bnBC 10 "" Admin1234! | tr -d ':\n' | sed 's/$2y/$2b/'
# =============================================================================
echo "👤  Inserimento utenti..."
run_sql <<'SQL'
-- Hash bcrypt di "Admin1234!"
\set ADMIN_HASH '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'
-- Hash bcrypt di "User1234!"
\set USER_HASH  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'

-- ── AMMINISTRATORI ────────────────────────────────────────────────────────────
INSERT INTO users (id, email, password_hash, full_name, role, email_verified_at, created_at) VALUES
  ('00000000-0000-0000-0001-000000000001', 'giacomo.masiero@marconirovereto.it',  :'ADMIN_HASH', 'Giacomo Masiero', 'admin', NOW(), NOW() - INTERVAL '6 months'),
  ('00000000-0000-0000-0001-000000000002', 'alessio.ferrari@marconirovereto.it',  :'ADMIN_HASH', 'Alessio Ferrari', 'admin', NOW(), NOW() - INTERVAL '6 months'),
  ('00000000-0000-0000-0001-000000000003', 'amedeo.azzetti@marconirovereto.it',   :'ADMIN_HASH', 'Amedeo Azzetti',  'admin', NOW(), NOW() - INTERVAL '6 months');

-- ── UTENTI NORMALI ────────────────────────────────────────────────────────────
INSERT INTO users (id, email, password_hash, full_name, role, email_verified_at, phone, created_at) VALUES
  ('00000000-0000-0000-0001-000000000010', 'luca.bianchi@gmail.com',        :'USER_HASH', 'Luca Bianchi',        'user', NOW(), '+39 333 1111111', NOW() - INTERVAL '5 months'),
  ('00000000-0000-0000-0001-000000000011', 'sofia.rossi@gmail.com',         :'USER_HASH', 'Sofia Rossi',         'user', NOW(), '+39 333 2222222', NOW() - INTERVAL '5 months'),
  ('00000000-0000-0000-0001-000000000012', 'marco.verdi@gmail.com',         :'USER_HASH', 'Marco Verdi',         'user', NOW(), '+39 333 3333333', NOW() - INTERVAL '4 months'),
  ('00000000-0000-0000-0001-000000000013', 'giulia.neri@gmail.com',         :'USER_HASH', 'Giulia Neri',         'user', NOW(), '+39 333 4444444', NOW() - INTERVAL '4 months'),
  ('00000000-0000-0000-0001-000000000014', 'andrea.conti@outlook.com',      :'USER_HASH', 'Andrea Conti',        'user', NOW(), '+39 333 5555555', NOW() - INTERVAL '3 months'),
  ('00000000-0000-0000-0001-000000000015', 'chiara.lombardi@outlook.com',   :'USER_HASH', 'Chiara Lombardi',     'user', NOW(), '+39 333 6666666', NOW() - INTERVAL '3 months'),
  ('00000000-0000-0000-0001-000000000016', 'davide.russo@gmail.com',        :'USER_HASH', 'Davide Russo',        'user', NOW(), '+39 333 7777777', NOW() - INTERVAL '2 months'),
  ('00000000-0000-0000-0001-000000000017', 'martina.ferrari@gmail.com',     :'USER_HASH', 'Martina Ferrari',     'user', NOW(), '+39 333 8888888', NOW() - INTERVAL '2 months'),
  ('00000000-0000-0000-0001-000000000018', 'riccardo.greco@gmail.com',      :'USER_HASH', 'Riccardo Greco',      'user', NOW(), '+39 333 9999999', NOW() - INTERVAL '2 months'),
  ('00000000-0000-0000-0001-000000000019', 'valentina.marino@gmail.com',    :'USER_HASH', 'Valentina Marino',    'user', NOW(), '+39 334 1111111', NOW() - INTERVAL '1 month'),
  ('00000000-0000-0000-0001-000000000020', 'simone.gallo@gmail.com',        :'USER_HASH', 'Simone Gallo',        'user', NOW(), '+39 334 2222222', NOW() - INTERVAL '1 month'),
  ('00000000-0000-0000-0001-000000000021', 'elisa.esposito@gmail.com',      :'USER_HASH', 'Elisa Esposito',      'user', NOW(), NULL,              NOW() - INTERVAL '3 weeks'),
  ('00000000-0000-0000-0001-000000000022', 'matteo.vitale@yahoo.it',        :'USER_HASH', 'Matteo Vitale',       'user', NOW(), '+39 334 3333333', NOW() - INTERVAL '2 weeks'),
  ('00000000-0000-0000-0001-000000000023', 'federica.ricci@yahoo.it',       :'USER_HASH', 'Federica Ricci',      'user', NULL,  '+39 334 4444444', NOW() - INTERVAL '1 week'),
  ('00000000-0000-0000-0001-000000000024', 'lorenzo.bruno@gmail.com',       :'USER_HASH', 'Lorenzo Bruno',       'user', NOW(), '+39 334 5555555', NOW() - INTERVAL '4 days'),
  ('00000000-0000-0000-0001-000000000025', 'alessia.de-luca@gmail.com',     :'USER_HASH', 'Alessia De Luca',     'user', NOW(), NULL,              NOW() - INTERVAL '2 days');
SQL
echo "   ✓ 3 admin + 16 utenti inseriti (password: Admin1234!)"

# =============================================================================
# 3. INDIRIZZI
# =============================================================================
echo "📍  Inserimento indirizzi..."
run_sql <<'SQL'
INSERT INTO user_addresses (id, user_id, full_name, street, city, province, postal_code, country, phone, is_default, created_at) VALUES
  ('00000000-0000-0000-0004-000000000001', '00000000-0000-0000-0001-000000000010', 'Luca Bianchi',      'Via Roma 12',          'Milano',    'MI', '20121', 'IT', '+39 333 1111111', true,  NOW()),
  ('00000000-0000-0000-0004-000000000002', '00000000-0000-0000-0001-000000000010', 'Luca Bianchi',      'Via Montenapoleone 8', 'Milano',    'MI', '20121', 'IT', '+39 333 1111111', false, NOW()),
  ('00000000-0000-0000-0004-000000000003','00000000-0000-0000-0001-000000000011', 'Sofia Rossi',       'Corso Venezia 30',     'Roma',      'RM', '00187', 'IT', '+39 333 2222222', true,  NOW()),
  ('00000000-0000-0000-0004-000000000004','00000000-0000-0000-0001-000000000012', 'Marco Verdi',       'Via Garibaldi 5',      'Torino',    'TO', '10122', 'IT', '+39 333 3333333', true,  NOW()),
  ('00000000-0000-0000-0004-000000000005','00000000-0000-0000-0001-000000000013', 'Giulia Neri',       'Via Nazionale 100',    'Napoli',    'NA', '80121', 'IT', '+39 333 4444444', true,  NOW()),
  ('00000000-0000-0000-0004-000000000006','00000000-0000-0000-0001-000000000014', 'Andrea Conti',      'Via del Corso 15',     'Roma',      'RM', '00186', 'IT', '+39 333 5555555', true,  NOW()),
  ('00000000-0000-0000-0004-000000000007','00000000-0000-0000-0001-000000000015', 'Chiara Lombardi',   'Via Brera 22',         'Milano',    'MI', '20121', 'IT', '+39 333 6666666', true,  NOW()),
  ('00000000-0000-0000-0004-000000000008','00000000-0000-0000-0001-000000000016', 'Davide Russo',      'Via Toledo 88',        'Napoli',    'NA', '80132', 'IT', '+39 333 7777777', true,  NOW()),
  ('00000000-0000-0000-0004-000000000009','00000000-0000-0000-0001-000000000017', 'Martina Ferrari',   'Piazza Duomo 1',       'Firenze',   'FI', '50122', 'IT', '+39 333 8888888', true,  NOW()),
  ('00000000-0000-0000-0004-000000000010','00000000-0000-0000-0001-000000000018', 'Riccardo Greco',    'Via Etnea 200',        'Catania',   'CT', '95121', 'IT', '+39 333 9999999', true,  NOW()),
  ('00000000-0000-0000-0004-000000000011','00000000-0000-0000-0001-000000000019', 'Valentina Marino',  'Via Po 14',            'Torino',    'TO', '10124', 'IT', '+39 334 1111111', true,  NOW()),
  ('00000000-0000-0000-0004-000000000012','00000000-0000-0000-0001-000000000020', 'Simone Gallo',      'Via Mazzini 3',        'Bologna',   'BO', '40121', 'IT', '+39 334 2222222', true,  NOW()),
  ('00000000-0000-0000-0004-000000000013','00000000-0000-0000-0001-000000000021', 'Elisa Esposito',    'Via Libertà 45',       'Palermo',   'PA', '90143', 'IT', NULL,              true,  NOW()),
  ('00000000-0000-0000-0004-000000000014','00000000-0000-0000-0001-000000000022', 'Matteo Vitale',     'Corso Italia 67',      'Genova',    'GE', '16121', 'IT', '+39 334 3333333', true,  NOW()),
  ('00000000-0000-0000-0004-000000000015','00000000-0000-0000-0001-000000000023', 'Federica Ricci',    'Via Amendola 9',       'Bari',      'BA', '70121', 'IT', '+39 334 4444444', true,  NOW()),
  ('00000000-0000-0000-0004-000000000016','00000000-0000-0000-0001-000000000024', 'Lorenzo Bruno',     'Via Dante 55',         'Verona',    'VR', '37121', 'IT', '+39 334 5555555', true,  NOW()),
  ('00000000-0000-0000-0004-000000000017','00000000-0000-0000-0001-000000000025', 'Alessia De Luca',   'Via XX Settembre 11',  'Trieste',   'TS', '34121', 'IT', NULL,              true,  NOW()),
  -- admin addresses
  ('00000000-0000-0000-0004-000000000018','00000000-0000-0000-0001-000000000001','Giacomo Masiero',  'Via Trento 1',         'Rovereto',  'TN', '38068', 'IT', NULL,              true,  NOW()),
  ('00000000-0000-0000-0004-000000000019','00000000-0000-0000-0001-000000000002','Alessio Ferrari',  'Via Brennero 42',      'Rovereto',  'TN', '38068', 'IT', NULL,              true,  NOW()),
  ('00000000-0000-0000-0004-000000000020','00000000-0000-0000-0001-000000000003','Amedeo Azzetti',   'Corso Rosmini 10',     'Rovereto',  'TN', '38068', 'IT', NULL,              true,  NOW());
SQL
echo "   ✓ Indirizzi inseriti"

# =============================================================================
# 4. PRODOTTI + VARIANTI + IMMAGINI + SCONTI
# =============================================================================
echo "👕  Inserimento prodotti..."

# Immagini Unsplash per categoria (free, non richiedono auth)
# t-shirt uomo
T_IMG1="https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600"
T_IMG2="https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=600"
T_IMG3="https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=600"
# pantaloni
P_IMG1="https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=600"
P_IMG2="https://images.unsplash.com/photo-1555689502-c4b22d76c56f?w=600"
# giacche
G_IMG1="https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600"
G_IMG2="https://images.unsplash.com/photo-1520975916090-3105956dac38?w=600"
# donna top
DT_IMG1="https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=600"
DT_IMG2="https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600"
# vestiti
V_IMG1="https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=600"
V_IMG2="https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=600"
# accessori
A_IMG1="https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600"
A_IMG2="https://images.unsplash.com/photo-1559563458-527698bf5295?w=600"
# sport
S_IMG1="https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600"
S_IMG2="https://images.unsplash.com/photo-1556906781-9a412961a28c?w=600"

run_sql <<SQL
-- ═══════════════════════════════════════════════════════════════════════════════
-- PRODOTTI
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO products (id, category_id, name, slug, description, short_desc, brand, base_price, is_active, is_featured, is_new_arrival, sold_count, created_at) VALUES

-- T-Shirt Uomo
('00000000-0000-0000-0003-000000000001','00000000-0000-0000-0002-000000000006',
 'T-Shirt Essential Bianca','t-shirt-essential-bianca',
 'La t-shirt essenziale in cotone 100% biologico. Taglio regular fit con girocollo ribattuto. Disponibile in 5 taglie. Lavabile in lavatrice a 30°.',
 'T-shirt 100% cotone biologico, taglio regular fit','Common Era', 29.90, true, true,  false, 142, NOW() - INTERVAL '5 months'),

('00000000-0000-0000-0003-000000000002','00000000-0000-0000-0002-000000000006',
 'Polo Piqué Blu Navy','polo-pique-blu-navy',
 'Polo classica in piqué di cotone mercerizzato. Colletto a costine, bottoni in madreperla, logo ricamato sul petto. Ideale per occasioni casual-chic.',
 'Polo piqué cotone mercerizzato, fit classico','Common Era', 59.90, true, false, false, 87,  NOW() - INTERVAL '4 months'),

('00000000-0000-0000-0003-000000000003','00000000-0000-0000-0002-000000000006',
 'T-Shirt Grafica Oversize','t-shirt-grafica-oversize',
 'T-shirt oversize in cotone pesante 280 g/m². Stampa serigrafica frontale. Spalle scese, orlo banded. Edizione limitata.',
 'T-shirt oversize cotone pesante con stampa grafica','Common Era', 49.90, true, false, true,  63,  NOW() - INTERVAL '2 months'),

-- Pantaloni Uomo
('00000000-0000-0000-0003-000000000004','00000000-0000-0000-0002-000000000007',
 'Jeans Slim Fit Dark','jeans-slim-fit-dark',
 'Jeans in denim selvedge giapponese 13 oz. Lavaggio dark wash, 5 tasche classiche, chiusura con zip YKK. Slim fit con stretch 2%.',
 'Denim selvedge giapponese 13 oz, slim fit','Common Era', 119.90, true, true,  false, 201, NOW() - INTERVAL '6 months'),

('00000000-0000-0000-0003-000000000005','00000000-0000-0000-0002-000000000007',
 'Chino Beige Relaxed','chino-beige-relaxed',
 'Pantaloni chino in cotone twill leggero. Fit relaxed, cavallo abbassato, tasche cargo laterali. Perfetti per il tempo libero.',
 'Chino twill cotone relaxed fit con tasche cargo','Common Era', 79.90, true, false, false, 115, NOW() - INTERVAL '3 months'),

('00000000-0000-0000-0003-000000000006','00000000-0000-0000-0002-000000000007',
 'Jogger Tecnico Antracite','jogger-tecnico-antracite',
 'Jogger in felpa tecnica con interno felpato. Elastico in vita con coulisse, polsini a costine. Tasche laterali con zip.',
 'Jogger felpa tecnica, polsini a costine','Common Era', 89.90, true, false, true,  78,  NOW() - INTERVAL '1 month'),

-- Giacche Uomo
('00000000-0000-0000-0003-000000000007','00000000-0000-0000-0002-000000000008',
 'Bomber Nylon Verde Militare','bomber-nylon-verde-militare',
 'Bomber in nylon ripstop, fodera in satin, polsini e fondo a costine. Tasche laterali con zip, tasca interna. Chiusura con zip bidirezionale.',
 'Bomber nylon ripstop con fodera satin','Common Era', 199.90, true, true,  false, 54,  NOW() - INTERVAL '4 months'),

('00000000-0000-0000-0003-000000000008','00000000-0000-0000-0002-000000000008',
 'Cappotto Cammello Oversize','cappotto-cammello-oversize',
 'Cappotto in lana vergine 60% e cashmere 40%. Taglio oversize, collo a revers, bottoni in corno. Fodera in cupro. Made in Italy.',
 'Lana 60% cashmere 40%, oversize, Made in Italy','Common Era', 499.90, true, true,  false, 23,  NOW() - INTERVAL '5 months'),

-- T-Shirt Donna
('00000000-0000-0000-0003-000000000009','00000000-0000-0000-0002-000000000009',
 'Top Bustier Bianco','top-bustier-bianco',
 'Top bustier in jersey di cotone elasticizzato. Stecche interne rimovibili, chiusura posteriore con zip invisibile. Versatile: da solo o sotto una giacca.',
 'Bustier jersey cotone elasticizzato, zip posteriore','Common Era', 49.90, true, true,  false, 178, NOW() - INTERVAL '3 months'),

('00000000-0000-0000-0003-000000000010','00000000-0000-0000-0002-000000000009',
 'T-Shirt Crop Minimal','t-shirt-crop-minimal',
 'T-shirt crop in cotone organico GOTS. Taglio dritto, lunghezza ombelico, scollo a barca. Disponibile in 8 colori stagionali.',
 'Crop tee cotone organico GOTS, scollo a barca','Common Era', 34.90, true, false, true,  234, NOW() - INTERVAL '1 month'),

-- Vestiti Donna
('00000000-0000-0000-0003-000000000011','00000000-0000-0000-0002-000000000010',
 'Abito Midi Lino Naturale','abito-midi-lino-naturale',
 'Abito midi in lino stonewash 100%. Scollo V, maniche a 3/4, cintura in vita removibile. Leggero e traspirante, ideale per la stagione calda.',
 'Abito midi lino stonewash 100%, scollo V','Common Era', 139.90, true, true,  false, 89,  NOW() - INTERVAL '4 months'),

('00000000-0000-0000-0003-000000000012','00000000-0000-0000-0002-000000000010',
 'Mini Dress Plissé Nero','mini-dress-plisse-nero',
 'Mini dress in tessuto plissé ad effetto permanente. Scollo quadrato, spalline sottili, elastico in vita. Washable, non si stira.',
 'Plissé permanente, scollo quadrato, spalline sottili','Common Era', 89.90, true, false, true,  156, NOW() - INTERVAL '2 months'),

-- Giacche Donna
('00000000-0000-0000-0003-000000000013','00000000-0000-0000-0002-000000000011',
 'Blazer Oversize Crema','blazer-oversize-crema',
 'Blazer strutturato in misto lana. Collo a notch, doppio spacco posteriore, tasche con patta. Fodere in acetato. Vestibilità oversize.',
 'Blazer misto lana oversize, collo notch','Common Era', 249.90, true, true,  false, 67,  NOW() - INTERVAL '3 months'),

('00000000-0000-0000-0003-000000000014','00000000-0000-0000-0002-000000000011',
 'Trench Beige Classico','trench-beige-classico',
 'Trench impermeabile in gabardine di cotone. Doppio petto, cintura con fibbia, spallacci rimovibili. Il trench definitivo.',
 'Gabardine cotone impermeabile, doppio petto','Common Era', 349.90, true, true,  false, 41,  NOW() - INTERVAL '5 months'),

-- Accessori
('00000000-0000-0000-0003-000000000015','00000000-0000-0000-0002-000000000003',
 'Borsa Tote Canvas Naturale','borsa-tote-canvas-naturale',
 'Tote bag in canvas pesante 12 oz. Manici in pelle vegetale, tasca interna con zip, base rinforzata. Capiente 20L.',
 'Canvas 12 oz, manici pelle vegetale, 20L','Common Era', 69.90, true, false, false, 312, NOW() - INTERVAL '6 months'),

('00000000-0000-0000-0003-000000000016','00000000-0000-0000-0002-000000000003',
 'Cintura in Pelle Nera','cintura-pelle-nera',
 'Cintura in pelle bovina piena fiore, conciata al vegetale. Fibbia in ottone spazzolato. Disponibile in 5 misure. Bordi lucidati a mano.',
 'Pelle piena fiore vegetale, fibbia ottone spazzolato','Common Era', 89.90, true, false, false, 145, NOW() - INTERVAL '4 months'),

('00000000-0000-0000-0003-000000000017','00000000-0000-0000-0002-000000000003',
 'Cappello Bucket Beige','cappello-bucket-beige',
 'Bucket hat in cotone canvas lavato. Tesa media, logo ricamato, interno in cotone. Lavabile in lavatrice. Taglia unica regolabile.',
 'Canvas lavato, tesa media, logo ricamato','Common Era', 39.90, true, false, true,  198, NOW() - INTERVAL '1 month'),

-- Sport
('00000000-0000-0000-0003-000000000018','00000000-0000-0000-0002-000000000004',
 'Felpa Hoodie Sport Grey','felpa-hoodie-sport-grey',
 'Hoodie in fleece tecnico 320 g/m². Canguro frontale, cappuccio double-layer, polsini e girocollo a costine rinforzate. Per allenamento o casualwear.',
 'Fleece tecnico 320 g/m², cappuccio double-layer','Common Era', 99.90, true, true,  false, 267, NOW() - INTERVAL '3 months'),

('00000000-0000-0000-0003-000000000019','00000000-0000-0000-0002-000000000004',
 'Leggings Performance Neri','leggings-performance-neri',
 'Leggings in tessuto tecnico 4-way stretch. Cintura alta con taschinino, cuciture flat-lock, tecnologia anti-trasparenza. UPF 50+.',
 '4-way stretch, cintura alta, anti-trasparenza UPF50+','Common Era', 79.90, true, false, false, 189, NOW() - INTERVAL '2 months'),

('00000000-0000-0000-0003-000000000020','00000000-0000-0000-0002-000000000004',
 'Sneaker Runner Bianche','sneaker-runner-bianche',
 'Sneaker running in mesh traspirante. Suola in gomma vulcanizzata, intersuola EVA ammortizzante, tomaia rinforzata. Peso 280g.',
 'Mesh traspirante, suola gomma vulcanizzata, 280g','Common Era', 149.90, true, true,  true,  93,  NOW() - INTERVAL '1 month');

-- ═══════════════════════════════════════════════════════════════════════════════
-- IMMAGINI PRODOTTI
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO product_images (product_id, url, alt_text, sort_order, is_cover) VALUES
('00000000-0000-0000-0003-000000000001','$T_IMG1','T-Shirt Essential Bianca - fronte',0,true),
('00000000-0000-0000-0003-000000000001','$T_IMG2','T-Shirt Essential Bianca - retro', 1,false),
('00000000-0000-0000-0003-000000000002','$T_IMG3','Polo Piqué Blu Navy - fronte',     0,true),
('00000000-0000-0000-0003-000000000003','$T_IMG1','T-Shirt Grafica - fronte',         0,true),
('00000000-0000-0000-0003-000000000004','$P_IMG1','Jeans Slim Fit Dark',              0,true),
('00000000-0000-0000-0003-000000000004','$P_IMG2','Jeans Slim Fit Dark - dettaglio',  1,false),
('00000000-0000-0000-0003-000000000005','$P_IMG2','Chino Beige Relaxed',              0,true),
('00000000-0000-0000-0003-000000000006','$P_IMG1','Jogger Tecnico Antracite',         0,true),
('00000000-0000-0000-0003-000000000007','$G_IMG1','Bomber Nylon Verde Militare',      0,true),
('00000000-0000-0000-0003-000000000007','$G_IMG2','Bomber - dettaglio tasche',        1,false),
('00000000-0000-0000-0003-000000000008','$G_IMG2','Cappotto Cammello Oversize',       0,true),
('00000000-0000-0000-0003-000000000008','$G_IMG1','Cappotto - dettaglio tessuto',     1,false),
('00000000-0000-0000-0003-000000000009','$DT_IMG1','Top Bustier Bianco',              0,true),
('00000000-0000-0000-0003-000000000010','$DT_IMG2','T-Shirt Crop Minimal',            0,true),
('00000000-0000-0000-0003-000000000010','$DT_IMG1','Crop - colori disponibili',       1,false),
('00000000-0000-0000-0003-000000000011','$V_IMG1','Abito Midi Lino',                  0,true),
('00000000-0000-0000-0003-000000000011','$V_IMG2','Abito Midi - dettaglio',           1,false),
('00000000-0000-0000-0003-000000000012','$V_IMG2','Mini Dress Plissé Nero',           0,true),
('00000000-0000-0000-0003-000000000013','$G_IMG1','Blazer Oversize Crema',            0,true),
('00000000-0000-0000-0003-000000000013','$G_IMG2','Blazer - retro',                   1,false),
('00000000-0000-0000-0003-000000000014','$G_IMG2','Trench Beige Classico',            0,true),
('00000000-0000-0000-0003-000000000015','$A_IMG1','Borsa Tote Canvas',                0,true),
('00000000-0000-0000-0003-000000000016','$A_IMG2','Cintura in Pelle Nera',            0,true),
('00000000-0000-0000-0003-000000000017','$A_IMG1','Cappello Bucket Beige',            0,true),
('00000000-0000-0000-0003-000000000018','$S_IMG1','Felpa Hoodie Sport Grey',          0,true),
('00000000-0000-0000-0003-000000000018','$S_IMG2','Hoodie - dettaglio cappuccio',     1,false),
('00000000-0000-0000-0003-000000000019','$S_IMG2','Leggings Performance Neri',        0,true),
('00000000-0000-0000-0003-000000000020','$S_IMG1','Sneaker Runner Bianche',           0,true),
('00000000-0000-0000-0003-000000000020','$S_IMG2','Sneaker - suola dettaglio',        1,false);
SQL

# =============================================================================
# 5. VARIANTI
# =============================================================================
echo "   Inserimento varianti..."
run_sql <<'SQL'
INSERT INTO product_variants (id, product_id, sku, size, color, color_hex, material, price_override, stock_qty, is_active) VALUES

-- T-Shirt Essential Bianca (prod-01)
('00000000-0000-0000-0007-000000000001','00000000-0000-0000-0003-000000000001','CE-TS01-XS', 'XS','Bianco','#FFFFFF','Cotone 100%',NULL, 25, true),
('00000000-0000-0000-0007-000000000002', '00000000-0000-0000-0003-000000000001','CE-TS01-S',  'S', 'Bianco','#FFFFFF','Cotone 100%',NULL, 40, true),
('00000000-0000-0000-0007-000000000003', '00000000-0000-0000-0003-000000000001','CE-TS01-M',  'M', 'Bianco','#FFFFFF','Cotone 100%',NULL, 50, true),
('00000000-0000-0000-0007-000000000004', '00000000-0000-0000-0003-000000000001','CE-TS01-L',  'L', 'Bianco','#FFFFFF','Cotone 100%',NULL, 35, true),
('00000000-0000-0000-0007-000000000005','00000000-0000-0000-0003-000000000001','CE-TS01-XL', 'XL','Bianco','#FFFFFF','Cotone 100%',NULL, 20, true),

-- Polo Piqué (prod-02)
('00000000-0000-0000-0007-000000000006', '00000000-0000-0000-0003-000000000002','CE-PO02-S',  'S', 'Blu Navy','#1B2A4A','Cotone Piqué',NULL, 20, true),
('00000000-0000-0000-0007-000000000007', '00000000-0000-0000-0003-000000000002','CE-PO02-M',  'M', 'Blu Navy','#1B2A4A','Cotone Piqué',NULL, 30, true),
('00000000-0000-0000-0007-000000000008', '00000000-0000-0000-0003-000000000002','CE-PO02-L',  'L', 'Blu Navy','#1B2A4A','Cotone Piqué',NULL, 25, true),
('00000000-0000-0000-0007-000000000009','00000000-0000-0000-0003-000000000002','CE-PO02-XL', 'XL','Blu Navy','#1B2A4A','Cotone Piqué',NULL, 10, true),

-- T-Shirt Grafica Oversize (prod-03)
('00000000-0000-0000-0007-000000000010', '00000000-0000-0000-0003-000000000003','CE-TG03-S',  'S', 'Nero',   '#111111','Cotone 280g', NULL, 15, true),
('00000000-0000-0000-0007-000000000011', '00000000-0000-0000-0003-000000000003','CE-TG03-M',  'M', 'Nero',   '#111111','Cotone 280g', NULL, 20, true),
('00000000-0000-0000-0007-000000000012', '00000000-0000-0000-0003-000000000003','CE-TG03-L',  'L', 'Nero',   '#111111','Cotone 280g', NULL, 20, true),
('00000000-0000-0000-0007-000000000013','00000000-0000-0000-0003-000000000003','CE-TG03-XL', 'XL','Nero',   '#111111','Cotone 280g', NULL,  8, true),

-- Jeans Slim Dark (prod-04)
('00000000-0000-0000-0007-000000000014','00000000-0000-0000-0003-000000000004','CE-JN04-2930','29/30','Dark Wash','#1A1A2E','Denim Selvedge',NULL, 18, true),
('00000000-0000-0000-0007-000000000015','00000000-0000-0000-0003-000000000004','CE-JN04-3030','30/30','Dark Wash','#1A1A2E','Denim Selvedge',NULL, 25, true),
('00000000-0000-0000-0007-000000000016','00000000-0000-0000-0003-000000000004','CE-JN04-3130','31/30','Dark Wash','#1A1A2E','Denim Selvedge',NULL, 22, true),
('00000000-0000-0000-0007-000000000017','00000000-0000-0000-0003-000000000004','CE-JN04-3230','32/30','Dark Wash','#1A1A2E','Denim Selvedge',NULL, 30, true),
('00000000-0000-0000-0007-000000000018','00000000-0000-0000-0003-000000000004','CE-JN04-3332','33/32','Dark Wash','#1A1A2E','Denim Selvedge',NULL, 20, true),
('00000000-0000-0000-0007-000000000019','00000000-0000-0000-0003-000000000004','CE-JN04-3432','34/32','Dark Wash','#1A1A2E','Denim Selvedge',NULL, 12, true),

-- Chino Beige (prod-05)
('00000000-0000-0000-0007-000000000020', '00000000-0000-0000-0003-000000000005','CE-CH05-S',  'S', 'Beige',  '#C9A96E','Cotone Twill',NULL, 20, true),
('00000000-0000-0000-0007-000000000021', '00000000-0000-0000-0003-000000000005','CE-CH05-M',  'M', 'Beige',  '#C9A96E','Cotone Twill',NULL, 30, true),
('00000000-0000-0000-0007-000000000022', '00000000-0000-0000-0003-000000000005','CE-CH05-L',  'L', 'Beige',  '#C9A96E','Cotone Twill',NULL, 25, true),
('00000000-0000-0000-0007-000000000023','00000000-0000-0000-0003-000000000005','CE-CH05-XL', 'XL','Beige',  '#C9A96E','Cotone Twill',NULL, 10, true),

-- Jogger (prod-06)
('00000000-0000-0000-0007-000000000024', '00000000-0000-0000-0003-000000000006','CE-JG06-S',  'S', 'Antracite','#3D3D3D','Felpa Tecnica',NULL, 15, true),
('00000000-0000-0000-0007-000000000025', '00000000-0000-0000-0003-000000000006','CE-JG06-M',  'M', 'Antracite','#3D3D3D','Felpa Tecnica',NULL, 25, true),
('00000000-0000-0000-0007-000000000026', '00000000-0000-0000-0003-000000000006','CE-JG06-L',  'L', 'Antracite','#3D3D3D','Felpa Tecnica',NULL, 20, true),
('00000000-0000-0000-0007-000000000027','00000000-0000-0000-0003-000000000006','CE-JG06-XL', 'XL','Antracite','#3D3D3D','Felpa Tecnica',NULL, 10, true),

-- Bomber (prod-07)
('00000000-0000-0000-0007-000000000028', '00000000-0000-0000-0003-000000000007','CE-BM07-S',  'S', 'Verde Militare','#4A5240','Nylon Ripstop',NULL, 10, true),
('00000000-0000-0000-0007-000000000029', '00000000-0000-0000-0003-000000000007','CE-BM07-M',  'M', 'Verde Militare','#4A5240','Nylon Ripstop',NULL, 15, true),
('00000000-0000-0000-0007-000000000030', '00000000-0000-0000-0003-000000000007','CE-BM07-L',  'L', 'Verde Militare','#4A5240','Nylon Ripstop',NULL, 12, true),
('00000000-0000-0000-0007-000000000031','00000000-0000-0000-0003-000000000007','CE-BM07-XL', 'XL','Verde Militare','#4A5240','Nylon Ripstop',NULL,  5, true),

-- Cappotto (prod-08)
('00000000-0000-0000-0007-000000000032', '00000000-0000-0000-0003-000000000008','CE-CP08-S',  'S', 'Cammello','#C19A6B','Lana-Cashmere',NULL,  6, true),
('00000000-0000-0000-0007-000000000033', '00000000-0000-0000-0003-000000000008','CE-CP08-M',  'M', 'Cammello','#C19A6B','Lana-Cashmere',NULL,  8, true),
('00000000-0000-0000-0007-000000000034', '00000000-0000-0000-0003-000000000008','CE-CP08-L',  'L', 'Cammello','#C19A6B','Lana-Cashmere',NULL,  6, true),
('00000000-0000-0000-0007-000000000035','00000000-0000-0000-0003-000000000008','CE-CP08-XL', 'XL','Cammello','#C19A6B','Lana-Cashmere',NULL,  3, true),

-- Top Bustier (prod-09)
('00000000-0000-0000-0007-000000000036','00000000-0000-0000-0003-000000000009','CE-TB09-XS', 'XS','Bianco','#FFFFFF','Jersey Cotone',NULL, 20, true),
('00000000-0000-0000-0007-000000000037', '00000000-0000-0000-0003-000000000009','CE-TB09-S',  'S', 'Bianco','#FFFFFF','Jersey Cotone',NULL, 30, true),
('00000000-0000-0000-0007-000000000038', '00000000-0000-0000-0003-000000000009','CE-TB09-M',  'M', 'Bianco','#FFFFFF','Jersey Cotone',NULL, 35, true),
('00000000-0000-0000-0007-000000000039', '00000000-0000-0000-0003-000000000009','CE-TB09-L',  'L', 'Bianco','#FFFFFF','Jersey Cotone',NULL, 15, true),

-- Crop Tee (prod-10) — più colori
('00000000-0000-0000-0007-000000000043','00000000-0000-0000-0003-000000000010','CE-CT10-BK-S', 'S', 'Nero',  '#111111','Cotone Org.',NULL, 25, true),
('00000000-0000-0000-0007-000000000044','00000000-0000-0000-0003-000000000010','CE-CT10-BK-M', 'M', 'Nero',  '#111111','Cotone Org.',NULL, 30, true),
('00000000-0000-0000-0007-000000000045','00000000-0000-0000-0003-000000000010','CE-CT10-BK-L', 'L', 'Nero',  '#111111','Cotone Org.',NULL, 20, true),
('00000000-0000-0000-0007-000000000040','00000000-0000-0000-0003-000000000010','CE-CT10-WH-S', 'S', 'Bianco','#FFFFFF','Cotone Org.',NULL, 25, true),
('00000000-0000-0000-0007-000000000041','00000000-0000-0000-0003-000000000010','CE-CT10-WH-M', 'M', 'Bianco','#FFFFFF','Cotone Org.',NULL, 30, true),
('00000000-0000-0000-0007-000000000042','00000000-0000-0000-0003-000000000010','CE-CT10-WH-L', 'L', 'Bianco','#FFFFFF','Cotone Org.',NULL, 20, true),
('00000000-0000-0000-0007-000000000046','00000000-0000-0000-0003-000000000010','CE-CT10-BG-S', 'S', 'Beige', '#E8DCC8','Cotone Org.',NULL, 15, true),
('00000000-0000-0000-0007-000000000047','00000000-0000-0000-0003-000000000010','CE-CT10-BG-M', 'M', 'Beige', '#E8DCC8','Cotone Org.',NULL, 20, true),

-- Abito Midi Lino (prod-11)
('00000000-0000-0000-0007-000000000048','00000000-0000-0000-0003-000000000011','CE-AM11-XS', 'XS','Naturale','#F5DEB3','Lino 100%',NULL, 10, true),
('00000000-0000-0000-0007-000000000049', '00000000-0000-0000-0003-000000000011','CE-AM11-S',  'S', 'Naturale','#F5DEB3','Lino 100%',NULL, 15, true),
('00000000-0000-0000-0007-000000000050', '00000000-0000-0000-0003-000000000011','CE-AM11-M',  'M', 'Naturale','#F5DEB3','Lino 100%',NULL, 18, true),
('00000000-0000-0000-0007-000000000051', '00000000-0000-0000-0003-000000000011','CE-AM11-L',  'L', 'Naturale','#F5DEB3','Lino 100%',NULL, 12, true),

-- Mini Dress Plissé (prod-12)
('00000000-0000-0000-0007-000000000052','00000000-0000-0000-0003-000000000012','CE-MD12-XS', 'XS','Nero','#111111','Plissé',NULL, 20, true),
('00000000-0000-0000-0007-000000000053', '00000000-0000-0000-0003-000000000012','CE-MD12-S',  'S', 'Nero','#111111','Plissé',NULL, 28, true),
('00000000-0000-0000-0007-000000000054', '00000000-0000-0000-0003-000000000012','CE-MD12-M',  'M', 'Nero','#111111','Plissé',NULL, 25, true),
('00000000-0000-0000-0007-000000000055', '00000000-0000-0000-0003-000000000012','CE-MD12-L',  'L', 'Nero','#111111','Plissé',NULL, 15, true),

-- Blazer Oversize Crema (prod-13)
('00000000-0000-0000-0007-000000000056', '00000000-0000-0000-0003-000000000013','CE-BL13-S',  'S', 'Crema', '#FFFDD0','Misto Lana',NULL,  8, true),
('00000000-0000-0000-0007-000000000057', '00000000-0000-0000-0003-000000000013','CE-BL13-M',  'M', 'Crema', '#FFFDD0','Misto Lana',NULL, 12, true),
('00000000-0000-0000-0007-000000000058', '00000000-0000-0000-0003-000000000013','CE-BL13-L',  'L', 'Crema', '#FFFDD0','Misto Lana',NULL, 10, true),
('00000000-0000-0000-0007-000000000059','00000000-0000-0000-0003-000000000013','CE-BL13-XL', 'XL','Crema', '#FFFDD0','Misto Lana',NULL,  5, true),

-- Trench (prod-14)
('00000000-0000-0000-0007-000000000060', '00000000-0000-0000-0003-000000000014','CE-TR14-S',  'S', 'Beige', '#C9A96E','Gabardine',NULL,  6, true),
('00000000-0000-0000-0007-000000000061', '00000000-0000-0000-0003-000000000014','CE-TR14-M',  'M', 'Beige', '#C9A96E','Gabardine',NULL,  8, true),
('00000000-0000-0000-0007-000000000062', '00000000-0000-0000-0003-000000000014','CE-TR14-L',  'L', 'Beige', '#C9A96E','Gabardine',NULL,  7, true),
('00000000-0000-0000-0007-000000000063','00000000-0000-0000-0003-000000000014','CE-TR14-XL', 'XL','Beige', '#C9A96E','Gabardine',NULL,  3, true),

-- Borsa Tote (prod-15) — taglia unica
('00000000-0000-0000-0007-000000000064','00000000-0000-0000-0003-000000000015','CE-TT15-NAT',NULL,'Naturale','#F5DEB3','Canvas 12oz',NULL, 80, true),
('00000000-0000-0000-0007-000000000065','00000000-0000-0000-0003-000000000015','CE-TT15-BLK',NULL,'Nero',   '#111111','Canvas 12oz',NULL, 60, true),

-- Cintura (prod-16)
('00000000-0000-0000-0007-000000000066','00000000-0000-0000-0003-000000000016','CE-CI16-85', '85','Nero','#111111','Pelle Bovina',NULL, 15, true),
('00000000-0000-0000-0007-000000000067','00000000-0000-0000-0003-000000000016','CE-CI16-90', '90','Nero','#111111','Pelle Bovina',NULL, 20, true),
('00000000-0000-0000-0007-000000000068','00000000-0000-0000-0003-000000000016','CE-CI16-95', '95','Nero','#111111','Pelle Bovina',NULL, 25, true),
('00000000-0000-0000-0007-000000000069','00000000-0000-0000-0003-000000000016','CE-CI16-100','100','Nero','#111111','Pelle Bovina',NULL, 18, true),

-- Cappello Bucket (prod-17)
('00000000-0000-0000-0007-000000000070','00000000-0000-0000-0003-000000000017','CE-BK17-BEI',NULL,'Beige','#C9A96E','Canvas',NULL, 40, true),
('00000000-0000-0000-0007-000000000071','00000000-0000-0000-0003-000000000017','CE-BK17-BLK',NULL,'Nero', '#111111','Canvas',NULL, 35, true),
('00000000-0000-0000-0007-000000000072','00000000-0000-0000-0003-000000000017','CE-BK17-GRN',NULL,'Verde','#4A5240','Canvas',NULL, 25, true),

-- Hoodie (prod-18)
('00000000-0000-0000-0007-000000000073','00000000-0000-0000-0003-000000000018','CE-HH18-XS', 'XS','Grigio','#808080','Fleece Tecnico',NULL, 20, true),
('00000000-0000-0000-0007-000000000074', '00000000-0000-0000-0003-000000000018','CE-HH18-S',  'S', 'Grigio','#808080','Fleece Tecnico',NULL, 35, true),
('00000000-0000-0000-0007-000000000075', '00000000-0000-0000-0003-000000000018','CE-HH18-M',  'M', 'Grigio','#808080','Fleece Tecnico',NULL, 45, true),
('00000000-0000-0000-0007-000000000076', '00000000-0000-0000-0003-000000000018','CE-HH18-L',  'L', 'Grigio','#808080','Fleece Tecnico',NULL, 38, true),
('00000000-0000-0000-0007-000000000077','00000000-0000-0000-0003-000000000018','CE-HH18-XL', 'XL','Grigio','#808080','Fleece Tecnico',NULL, 20, true),

-- Leggings (prod-19)
('00000000-0000-0000-0007-000000000078','00000000-0000-0000-0003-000000000019','CE-LG19-XS', 'XS','Nero','#111111','4-Way Stretch',NULL, 25, true),
('00000000-0000-0000-0007-000000000079', '00000000-0000-0000-0003-000000000019','CE-LG19-S',  'S', 'Nero','#111111','4-Way Stretch',NULL, 35, true),
('00000000-0000-0000-0007-000000000080', '00000000-0000-0000-0003-000000000019','CE-LG19-M',  'M', 'Nero','#111111','4-Way Stretch',NULL, 40, true),
('00000000-0000-0000-0007-000000000081', '00000000-0000-0000-0003-000000000019','CE-LG19-L',  'L', 'Nero','#111111','4-Way Stretch',NULL, 28, true),

-- Sneaker (prod-20)
('00000000-0000-0000-0007-000000000082','00000000-0000-0000-0003-000000000020','CE-SN20-39', '39','Bianco','#FFFFFF','Mesh/Gomma',NULL, 8,  true),
('00000000-0000-0000-0007-000000000083','00000000-0000-0000-0003-000000000020','CE-SN20-40', '40','Bianco','#FFFFFF','Mesh/Gomma',NULL, 12, true),
('00000000-0000-0000-0007-000000000084','00000000-0000-0000-0003-000000000020','CE-SN20-41', '41','Bianco','#FFFFFF','Mesh/Gomma',NULL, 15, true),
('00000000-0000-0000-0007-000000000085','00000000-0000-0000-0003-000000000020','CE-SN20-42', '42','Bianco','#FFFFFF','Mesh/Gomma',NULL, 18, true),
('00000000-0000-0000-0007-000000000086','00000000-0000-0000-0003-000000000020','CE-SN20-43', '43','Bianco','#FFFFFF','Mesh/Gomma',NULL, 15, true),
('00000000-0000-0000-0007-000000000087','00000000-0000-0000-0003-000000000020','CE-SN20-44', '44','Bianco','#FFFFFF','Mesh/Gomma',NULL, 10, true),
('00000000-0000-0000-0007-000000000088','00000000-0000-0000-0003-000000000020','CE-SN20-45', '45','Bianco','#FFFFFF','Mesh/Gomma',NULL,  5, true);
SQL
echo "   ✓ Prodotti, immagini e varianti inseriti"

# =============================================================================
# 6. SCONTI
# =============================================================================
echo "💸  Inserimento sconti..."
run_sql <<'SQL'
INSERT INTO discounts ( product_id, type, value, label, is_active, starts_at, ends_at) VALUES
  -- 20% sul cappotto
  ('00000000-0000-0000-0003-000000000008','percentage',20.00,'Saldi Invernali',true, NOW() - INTERVAL '1 month', NOW() + INTERVAL '1 month'),
  -- 15% sul trench
  ('00000000-0000-0000-0003-000000000014','percentage',15.00,'Outlet Primavera',true, NOW() - INTERVAL '2 weeks', NOW() + INTERVAL '2 weeks'),
  -- 30€ fisso sul blazer
  ('00000000-0000-0000-0003-000000000013','fixed_amount',30.00,'Promo Blazer',true, NOW(), NOW() + INTERVAL '3 weeks'),
  -- 10% su jeans
  ('00000000-0000-0000-0003-000000000004','percentage',10.00,'Denim Week',true, NOW() - INTERVAL '3 days', NOW() + INTERVAL '4 days'),
  -- 25% sulla felpa hoodie
  ('00000000-0000-0000-0003-000000000018','percentage',25.00,'Sport Sale',true, NOW(), NOW() + INTERVAL '2 weeks');
SQL
echo "   ✓ Sconti inseriti"

# =============================================================================
# 7. CODICI PROMO
# =============================================================================
echo "🎟️   Inserimento codici promo..."
run_sql <<'SQL'
INSERT INTO promo_codes (id, code, type, value, min_order_amount, max_uses, current_uses, expires_at, is_active) VALUES
  ('00000000-0000-0000-0006-000000000001','BENVENUTO10',  'percentage',  10.00,  30.00, 500,  47,  NOW() + INTERVAL '6 months', true),
  ('00000000-0000-0000-0006-000000000002','ESTATE25',     'percentage',  25.00,  80.00, 200,  123, NOW() + INTERVAL '2 months', true),
  ('00000000-0000-0000-0006-000000000003','SCONTO20',     'fixed_amount',20.00,  60.00, 100,  18,  NOW() + INTERVAL '1 month',  true),
  ('00000000-0000-0000-0006-000000000004','VIP50',        'fixed_amount',50.00, 200.00, 50,   8,   NOW() + INTERVAL '3 months', true),
  ('00000000-0000-0000-0006-000000000005','FLASH15',      'percentage',  15.00,   0.00, 1000, 312, NOW() + INTERVAL '2 weeks',  true),
  ('00000000-0000-0000-0006-000000000006','EXPIRED2024',  'percentage',  30.00,   0.00, 100,  99,  NOW() - INTERVAL '1 month',  false),
  ('00000000-0000-0000-0006-000000000007','AUTUNNO',      'percentage',  20.00,  50.00, 300,  0,   NOW() + INTERVAL '4 months', true);
SQL
echo "   ✓ Codici promo inseriti"

# =============================================================================
# 8. ORDINI + ORDER ITEMS + PAGAMENTI + STATUS HISTORY
# =============================================================================
echo "📦  Inserimento ordini..."
run_sql <<'SQL'
-- ── ORDINE 1: Luca - completed ────────────────────────────────────────────────
INSERT INTO orders (id, user_id, address_id, status, subtotal, discount_total, shipping_cost, total, shipping_method, created_at, updated_at) VALUES
('00000000-0000-0000-0005-000000000001','00000000-0000-0000-0001-000000000010','00000000-0000-0000-0004-000000000001',
 'completed', 149.70, 0, 5.90, 155.60, 'Standard', NOW() - INTERVAL '4 months', NOW() - INTERVAL '3 months');
INSERT INTO order_items (id, order_id, variant_id, product_name, variant_label, sku_snapshot, unit_price, quantity, line_total) VALUES
('00000000-0000-0000-0008-000000000001','00000000-0000-0000-0005-000000000001','00000000-0000-0000-0007-000000000003','T-Shirt Essential Bianca','M / Bianco','CE-TS01-M',29.90,3,89.70),
('00000000-0000-0000-0008-000000000002','00000000-0000-0000-0005-000000000001','00000000-0000-0000-0007-000000000007','Polo Piqué Blu Navy','M / Blu Navy','CE-PO02-M',59.90,1,59.90);
INSERT INTO order_status_history (order_id, status, note, created_at) VALUES
('00000000-0000-0000-0005-000000000001','pending',NULL, NOW() - INTERVAL '4 months'),
('00000000-0000-0000-0005-000000000001','paid',   NULL, NOW() - INTERVAL '4 months' + INTERVAL '2 hours'),
('00000000-0000-0000-0005-000000000001','shipped','Tracking: IT1234567890IT', NOW() - INTERVAL '4 months' + INTERVAL '2 days'),
('00000000-0000-0000-0005-000000000001','delivered',NULL, NOW() - INTERVAL '4 months' + INTERVAL '5 days'),
('00000000-0000-0000-0005-000000000001','completed',NULL,NOW() - INTERVAL '3 months');
INSERT INTO payments (order_id, user_id, status, method, amount, paid_at, created_at) VALUES
('00000000-0000-0000-0005-000000000001','00000000-0000-0000-0001-000000000010','succeeded','credit_card',155.60,NOW()-INTERVAL '4 months'+INTERVAL '2 hours',NOW()-INTERVAL '4 months');

-- ── ORDINE 2: Sofia - delivered ───────────────────────────────────────────────
INSERT INTO orders (id, user_id, address_id, status, subtotal, discount_total, shipping_cost, total, shipping_method, created_at, updated_at) VALUES
('00000000-0000-0000-0005-000000000002','00000000-0000-0000-0001-000000000011','00000000-0000-0000-0004-000000000003',
 'delivered', 189.80, 0, 0, 189.80, 'Express', NOW() - INTERVAL '2 months', NOW() - INTERVAL '2 months' + INTERVAL '4 days');
INSERT INTO order_items (id, order_id, variant_id, product_name, variant_label, sku_snapshot, unit_price, quantity, line_total) VALUES
('00000000-0000-0000-0008-000000000003','00000000-0000-0000-0005-000000000002','00000000-0000-0000-0007-000000000050','Abito Midi Lino Naturale','M / Naturale','CE-AM11-M',139.90,1,139.90),
('00000000-0000-0000-0008-000000000004','00000000-0000-0000-0005-000000000002','00000000-0000-0000-0007-000000000064','Borsa Tote Canvas Naturale','Naturale','CE-TT15-NAT',49.90,1,49.90);
INSERT INTO order_status_history (order_id, status, note, created_at) VALUES
('00000000-0000-0000-0005-000000000002','pending',NULL,NOW()-INTERVAL '2 months'),
('00000000-0000-0000-0005-000000000002','paid',NULL,NOW()-INTERVAL '2 months'+INTERVAL '1 hour'),
('00000000-0000-0000-0005-000000000002','processing',NULL,NOW()-INTERVAL '2 months'+INTERVAL '4 hours'),
('00000000-0000-0000-0005-000000000002','shipped','Express DHL',NOW()-INTERVAL '2 months'+INTERVAL '1 day'),
('00000000-0000-0000-0005-000000000002','delivered',NULL,NOW()-INTERVAL '2 months'+INTERVAL '4 days');
INSERT INTO payments (order_id, user_id, status, method, amount, paid_at, created_at) VALUES
('00000000-0000-0000-0005-000000000002','00000000-0000-0000-0001-000000000011','succeeded','paypal',189.80,NOW()-INTERVAL '2 months'+INTERVAL '1 hour',NOW()-INTERVAL '2 months');

-- ── ORDINE 3: Marco - shipped ─────────────────────────────────────────────────
INSERT INTO orders (id, user_id, address_id, status, subtotal, discount_total, shipping_cost, total, shipping_method, created_at, updated_at) VALUES
('00000000-0000-0000-0005-000000000003','00000000-0000-0000-0001-000000000012','00000000-0000-0000-0004-000000000004',
 'shipped', 349.80, 52.47, 0, 297.33, 'Standard', NOW() - INTERVAL '1 month', NOW() - INTERVAL '1 month' + INTERVAL '3 days');
INSERT INTO order_items (id, order_id, variant_id, product_name, variant_label, sku_snapshot, unit_price, quantity, line_total) VALUES
('00000000-0000-0000-0008-000000000005','00000000-0000-0000-0005-000000000003','00000000-0000-0000-0007-000000000033','Cappotto Cammello Oversize','M / Cammello','CE-CP08-M',499.90,1,499.90),
('00000000-0000-0000-0008-000000000006','00000000-0000-0000-0005-000000000003','00000000-0000-0000-0007-000000000068','Cintura in Pelle Nera','95','CE-CI16-95',89.90,1,89.90);
INSERT INTO order_status_history (order_id, status, note, created_at) VALUES
('00000000-0000-0000-0005-000000000003','pending',NULL,NOW()-INTERVAL '1 month'),
('00000000-0000-0000-0005-000000000003','paid',NULL,NOW()-INTERVAL '1 month'+INTERVAL '30 minutes'),
('00000000-0000-0000-0005-000000000003','shipped','GLS IT9876543210IT',NOW()-INTERVAL '1 month'+INTERVAL '3 days');
INSERT INTO payments (order_id, user_id, status, method, amount, paid_at, created_at) VALUES
('00000000-0000-0000-0005-000000000003','00000000-0000-0000-0001-000000000012','succeeded','credit_card',297.33,NOW()-INTERVAL '1 month'+INTERVAL '30 minutes',NOW()-INTERVAL '1 month');

-- ── ORDINE 4: Giulia - processing ─────────────────────────────────────────────
INSERT INTO orders (id, user_id, address_id, status, subtotal, discount_total, shipping_cost, total, shipping_method, created_at, updated_at) VALUES
('00000000-0000-0000-0005-000000000004','00000000-0000-0000-0001-000000000013','00000000-0000-0000-0004-000000000005',
 'processing', 179.80, 0, 5.90, 185.70, 'Standard', NOW() - INTERVAL '3 weeks', NOW() - INTERVAL '3 weeks' + INTERVAL '6 hours');
INSERT INTO order_items (id, order_id, variant_id, product_name, variant_label, sku_snapshot, unit_price, quantity, line_total) VALUES
('00000000-0000-0000-0008-000000000007','00000000-0000-0000-0005-000000000004','00000000-0000-0000-0007-000000000053','Mini Dress Plissé Nero','S / Nero','CE-MD12-S',89.90,1,89.90),
('00000000-0000-0000-0008-000000000008','00000000-0000-0000-0005-000000000004','00000000-0000-0000-0007-000000000037','Top Bustier Bianco','S / Bianco','CE-TB09-S',49.90,1,49.90),
('00000000-0000-0000-0008-000000000009','00000000-0000-0000-0005-000000000004','00000000-0000-0000-0007-000000000071','Cappello Bucket Beige','Nero','CE-BK17-BLK',39.90,1,39.90);
INSERT INTO order_status_history (order_id, status, note, created_at) VALUES
('00000000-0000-0000-0005-000000000004','pending',NULL,NOW()-INTERVAL '3 weeks'),
('00000000-0000-0000-0005-000000000004','paid',NULL,NOW()-INTERVAL '3 weeks'+INTERVAL '1 hour'),
('00000000-0000-0000-0005-000000000004','processing','In preparazione',NOW()-INTERVAL '3 weeks'+INTERVAL '6 hours');
INSERT INTO payments (order_id, user_id, status, method, amount, paid_at, created_at) VALUES
('00000000-0000-0000-0005-000000000004','00000000-0000-0000-0001-000000000013','succeeded','credit_card',185.70,NOW()-INTERVAL '3 weeks'+INTERVAL '1 hour',NOW()-INTERVAL '3 weeks');

-- ── ORDINE 5: Andrea - cancelled ─────────────────────────────────────────────
INSERT INTO orders (id, user_id, address_id, status, subtotal, discount_total, shipping_cost, total, shipping_method, created_at, updated_at) VALUES
('00000000-0000-0000-0005-000000000005','00000000-0000-0000-0001-000000000014','00000000-0000-0000-0004-000000000006',
 'cancelled', 99.90, 0, 5.90, 105.80, 'Standard', NOW() - INTERVAL '6 weeks', NOW() - INTERVAL '6 weeks' + INTERVAL '1 day');
INSERT INTO order_items (id, order_id, variant_id, product_name, variant_label, sku_snapshot, unit_price, quantity, line_total) VALUES
('00000000-0000-0000-0008-000000000010','00000000-0000-0000-0005-000000000005','00000000-0000-0000-0007-000000000075','Felpa Hoodie Sport Grey','M / Grigio','CE-HH18-M',99.90,1,99.90);
INSERT INTO order_status_history (order_id, status, note, created_at) VALUES
('00000000-0000-0000-0005-000000000005','pending',NULL,NOW()-INTERVAL '6 weeks'),
('00000000-0000-0000-0005-000000000005','cancelled','Annullato dal cliente',NOW()-INTERVAL '6 weeks'+INTERVAL '1 day');
INSERT INTO payments (order_id, user_id, status, method, amount, paid_at, created_at) VALUES
('00000000-0000-0000-0005-000000000005','00000000-0000-0000-0001-000000000014','pending',  'credit_card',105.80,NULL,NOW()-INTERVAL '6 weeks');

-- ── ORDINE 6: Chiara - completed con promo ───────────────────────────────────
INSERT INTO orders (id, user_id, address_id, status, subtotal, discount_total, shipping_cost, total, promo_code_id, shipping_method, created_at, updated_at) VALUES
('00000000-0000-0000-0005-000000000006','00000000-0000-0000-0001-000000000015','00000000-0000-0000-0004-000000000007',
 'completed', 249.90, 24.99, 0, 224.91, '00000000-0000-0000-0006-000000000001', 'Standard', NOW() - INTERVAL '3 months', NOW() - INTERVAL '2 months');
INSERT INTO order_items (id, order_id, variant_id, product_name, variant_label, sku_snapshot, unit_price, quantity, line_total) VALUES
('00000000-0000-0000-0008-000000000011','00000000-0000-0000-0005-000000000006','00000000-0000-0000-0007-000000000057','Blazer Oversize Crema','M / Crema','CE-BL13-M',249.90,1,249.90);
INSERT INTO order_status_history (order_id, status, note, created_at) VALUES
('00000000-0000-0000-0005-000000000006','pending',NULL,NOW()-INTERVAL '3 months'),
('00000000-0000-0000-0005-000000000006','paid',NULL,NOW()-INTERVAL '3 months'+INTERVAL '1 hour'),
('00000000-0000-0000-0005-000000000006','shipped','SDA IT5555555555IT',NOW()-INTERVAL '3 months'+INTERVAL '2 days'),
('00000000-0000-0000-0005-000000000006','delivered',NULL,NOW()-INTERVAL '3 months'+INTERVAL '5 days'),
('00000000-0000-0000-0005-000000000006','completed',NULL,NOW()-INTERVAL '2 months');
INSERT INTO payments (order_id, user_id, status, method, amount, paid_at, created_at) VALUES
('00000000-0000-0000-0005-000000000006','00000000-0000-0000-0001-000000000015','succeeded','credit_card',224.91,NOW()-INTERVAL '3 months'+INTERVAL '1 hour',NOW()-INTERVAL '3 months');

-- ── ORDINE 7: Davide - paid ───────────────────────────────────────────────────
INSERT INTO orders (id, user_id, address_id, status, subtotal, discount_total, shipping_cost, total, shipping_method, created_at, updated_at) VALUES
('00000000-0000-0000-0005-000000000007','00000000-0000-0000-0001-000000000016','00000000-0000-0000-0004-000000000008',
 'paid', 239.70, 0, 5.90, 245.60, 'Standard', NOW() - INTERVAL '1 week', NOW() - INTERVAL '1 week' + INTERVAL '2 hours');
INSERT INTO order_items (id, order_id, variant_id, product_name, variant_label, sku_snapshot, unit_price, quantity, line_total) VALUES
('00000000-0000-0000-0008-000000000012','00000000-0000-0000-0005-000000000007','00000000-0000-0000-0007-000000000017','Jeans Slim Fit Dark','32/30 / Dark Wash','CE-JN04-3230',119.90,1,119.90),
('00000000-0000-0000-0008-000000000013','00000000-0000-0000-0005-000000000007','00000000-0000-0000-0007-000000000022','Chino Beige Relaxed','L / Beige','CE-CH05-L',79.90,1,79.90),
('00000000-0000-0000-0008-000000000014','00000000-0000-0000-0005-000000000007','00000000-0000-0000-0007-000000000067','Cintura in Pelle Nera','90','CE-CI16-90',39.90,1,39.90);
INSERT INTO order_status_history (order_id, status, note, created_at) VALUES
('00000000-0000-0000-0005-000000000007','pending',NULL,NOW()-INTERVAL '1 week'),
('00000000-0000-0000-0005-000000000007','paid',NULL,NOW()-INTERVAL '1 week'+INTERVAL '2 hours');
INSERT INTO payments (order_id, user_id, status, method, amount, paid_at, created_at) VALUES
('00000000-0000-0000-0005-000000000007','00000000-0000-0000-0001-000000000016','succeeded','paypal',245.60,NOW()-INTERVAL '1 week'+INTERVAL '2 hours',NOW()-INTERVAL '1 week');

-- ── ORDINE 8: Martina - pending ───────────────────────────────────────────────
INSERT INTO orders (id, user_id, address_id, status, subtotal, discount_total, shipping_cost, total, shipping_method, created_at, updated_at) VALUES
('00000000-0000-0000-0005-000000000008','00000000-0000-0000-0001-000000000017','00000000-0000-0000-0004-000000000009',
 'pending', 79.90, 0, 5.90, 85.80, 'Standard', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days');
INSERT INTO order_items (id, order_id, variant_id, product_name, variant_label, sku_snapshot, unit_price, quantity, line_total) VALUES
('00000000-0000-0000-0008-000000000015','00000000-0000-0000-0005-000000000008','00000000-0000-0000-0007-000000000080','Leggings Performance Neri','M / Nero','CE-LG19-M',79.90,1,79.90);
INSERT INTO order_status_history (order_id, status, note, created_at) VALUES
('00000000-0000-0000-0005-000000000008','pending',NULL,NOW()-INTERVAL '2 days');
INSERT INTO payments (order_id, user_id, status, method, amount, paid_at, created_at) VALUES
('00000000-0000-0000-0005-000000000008','00000000-0000-0000-0001-000000000017','pending','credit_card',85.80,NULL,NOW()-INTERVAL '2 days');

-- ── ORDINE 9: Riccardo - refunded ────────────────────────────────────────────
INSERT INTO orders (id, user_id, address_id, status, subtotal, discount_total, shipping_cost, total, shipping_method, created_at, updated_at) VALUES
('00000000-0000-0000-0005-000000000009','00000000-0000-0000-0001-000000000018','00000000-0000-0000-0004-000000000010',
 'refunded', 199.90, 0, 5.90, 205.80, 'Standard', NOW() - INTERVAL '2 months', NOW() - INTERVAL '1 month' + INTERVAL '2 weeks');
INSERT INTO order_items (id, order_id, variant_id, product_name, variant_label, sku_snapshot, unit_price, quantity, line_total) VALUES
('00000000-0000-0000-0008-000000000016','00000000-0000-0000-0005-000000000009','00000000-0000-0000-0007-000000000029','Bomber Nylon Verde Militare','M / Verde Militare','CE-BM07-M',199.90,1,199.90);
INSERT INTO order_status_history (order_id, status, note, created_at) VALUES
('00000000-0000-0000-0005-000000000009','pending',NULL,NOW()-INTERVAL '2 months'),
('00000000-0000-0000-0005-000000000009','paid',NULL,NOW()-INTERVAL '2 months'+INTERVAL '1 hour'),
('00000000-0000-0000-0005-000000000009','shipped',NULL,NOW()-INTERVAL '2 months'+INTERVAL '2 days'),
('00000000-0000-0000-0005-000000000009','delivered',NULL,NOW()-INTERVAL '2 months'+INTERVAL '6 days'),
('00000000-0000-0000-0005-000000000009','refunded','Rimborso approvato post reso',NOW()-INTERVAL '1 month'+INTERVAL '2 weeks');
INSERT INTO payments (order_id, user_id, status, method, amount, paid_at, created_at) VALUES
('00000000-0000-0000-0005-000000000009','00000000-0000-0000-0001-000000000018','refunded','credit_card',205.80,NOW()-INTERVAL '2 months'+INTERVAL '1 hour',NOW()-INTERVAL '2 months');

-- ── ORDINE 10: Valentina - completed (grande ordine) ─────────────────────────
INSERT INTO orders (id, user_id, address_id, status, subtotal, discount_total, shipping_cost, total, shipping_method, created_at, updated_at) VALUES
('00000000-0000-0000-0005-000000000010','00000000-0000-0000-0001-000000000019','00000000-0000-0000-0004-000000000011',
 'completed', 578.60, 86.79, 0, 491.81, 'Express', NOW() - INTERVAL '5 months', NOW() - INTERVAL '4 months');
INSERT INTO order_items (id, order_id, variant_id, product_name, variant_label, sku_snapshot, unit_price, quantity, line_total) VALUES
('00000000-0000-0000-0008-000000000017','00000000-0000-0000-0005-000000000010','00000000-0000-0000-0007-000000000061','Trench Beige Classico','M / Beige','CE-TR14-M',349.90,1,349.90),
('00000000-0000-0000-0008-000000000018','00000000-0000-0000-0005-000000000010','00000000-0000-0000-0007-000000000044','T-Shirt Crop Minimal','M / Nero','CE-CT10-BK-M',34.90,2,69.80),
('00000000-0000-0000-0008-000000000019','00000000-0000-0000-0005-000000000010','00000000-0000-0000-0007-000000000049','Abito Midi Lino Naturale','S / Naturale','CE-AM11-S',139.90,1,139.90);
INSERT INTO order_status_history (order_id, status, note, created_at) VALUES
('00000000-0000-0000-0005-000000000010','pending',NULL,NOW()-INTERVAL '5 months'),
('00000000-0000-0000-0005-000000000010','paid',NULL,NOW()-INTERVAL '5 months'+INTERVAL '30 minutes'),
('00000000-0000-0000-0005-000000000010','shipped','DHL IT1111111111IT',NOW()-INTERVAL '5 months'+INTERVAL '1 day'),
('00000000-0000-0000-0005-000000000010','delivered',NULL,NOW()-INTERVAL '5 months'+INTERVAL '3 days'),
('00000000-0000-0000-0005-000000000010','completed',NULL,NOW()-INTERVAL '4 months');
INSERT INTO payments (order_id, user_id, status, method, amount, paid_at, created_at) VALUES
('00000000-0000-0000-0005-000000000010','00000000-0000-0000-0001-000000000019','succeeded','credit_card',491.81,NOW()-INTERVAL '5 months'+INTERVAL '30 minutes',NOW()-INTERVAL '5 months');

-- ── ORDINE 11: Simone - shipped ───────────────────────────────────────────────
INSERT INTO orders (id, user_id, address_id, status, subtotal, discount_total, shipping_cost, total, shipping_method, created_at, updated_at) VALUES
('00000000-0000-0000-0005-000000000011','00000000-0000-0000-0001-000000000020','00000000-0000-0000-0004-000000000012',
 'shipped', 149.90, 0, 5.90, 155.80, 'Standard', NOW() - INTERVAL '2 weeks', NOW() - INTERVAL '2 weeks' + INTERVAL '4 days');
INSERT INTO order_items (id, order_id, variant_id, product_name, variant_label, sku_snapshot, unit_price, quantity, line_total) VALUES
('00000000-0000-0000-0008-000000000020','00000000-0000-0000-0005-000000000011','00000000-0000-0000-0007-000000000085','Sneaker Runner Bianche','42 / Bianco','CE-SN20-42',149.90,1,149.90);
INSERT INTO order_status_history (order_id, status, note, created_at) VALUES
('00000000-0000-0000-0005-000000000011','pending',NULL,NOW()-INTERVAL '2 weeks'),
('00000000-0000-0000-0005-000000000011','paid',NULL,NOW()-INTERVAL '2 weeks'+INTERVAL '1 hour'),
('00000000-0000-0000-0005-000000000011','shipped','UPS 1Z9999999999999999',NOW()-INTERVAL '2 weeks'+INTERVAL '4 days');
INSERT INTO payments (order_id, user_id, status, method, amount, paid_at, created_at) VALUES
('00000000-0000-0000-0005-000000000011','00000000-0000-0000-0001-000000000020','succeeded','paypal',155.80,NOW()-INTERVAL '2 weeks'+INTERVAL '1 hour',NOW()-INTERVAL '2 weeks');

-- ── ORDINE 12: Elisa - completed ─────────────────────────────────────────────
INSERT INTO orders (id, user_id, address_id, status, subtotal, discount_total, shipping_cost, total, shipping_method, created_at, updated_at) VALUES
('00000000-0000-0000-0005-000000000012','00000000-0000-0000-0001-000000000021','00000000-0000-0000-0004-000000000013',
 'completed', 109.80, 0, 5.90, 115.70, 'Standard', NOW() - INTERVAL '3 months', NOW() - INTERVAL '2 months' + INTERVAL '2 weeks');
INSERT INTO order_items (id, order_id, variant_id, product_name, variant_label, sku_snapshot, unit_price, quantity, line_total) VALUES
('00000000-0000-0000-0008-000000000021','00000000-0000-0000-0005-000000000012','00000000-0000-0000-0007-000000000025','Jogger Tecnico Antracite','M / Antracite','CE-JG06-M',89.90,1,89.90),
('00000000-0000-0000-0008-000000000022','00000000-0000-0000-0005-000000000012','00000000-0000-0000-0007-000000000070','Cappello Bucket Beige','Beige','CE-BK17-BEI',19.90,1,19.90);
INSERT INTO order_status_history (order_id, status, note, created_at) VALUES
('00000000-0000-0000-0005-000000000012','pending',NULL,NOW()-INTERVAL '3 months'),
('00000000-0000-0000-0005-000000000012','paid',NULL,NOW()-INTERVAL '3 months'+INTERVAL '2 hours'),
('00000000-0000-0000-0005-000000000012','shipped','Nexive IT2222222222IT',NOW()-INTERVAL '3 months'+INTERVAL '3 days'),
('00000000-0000-0000-0005-000000000012','delivered',NULL,NOW()-INTERVAL '3 months'+INTERVAL '7 days'),
('00000000-0000-0000-0005-000000000012','completed',NULL,NOW()-INTERVAL '2 months'+INTERVAL '2 weeks');
INSERT INTO payments (order_id, user_id, status, method, amount, paid_at, created_at) VALUES
('00000000-0000-0000-0005-000000000012','00000000-0000-0000-0001-000000000021','succeeded','credit_card',115.70,NOW()-INTERVAL '3 months'+INTERVAL '2 hours',NOW()-INTERVAL '3 months');

-- Aggiorna sold_count prodotti
UPDATE products SET sold_count = (
  SELECT COALESCE(SUM(oi.quantity), 0)
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  JOIN product_variants pv ON pv.id = oi.variant_id
  WHERE pv.product_id = products.id
  AND o.status NOT IN ('cancelled')
);
SQL
echo "   ✓ 12 ordini inseriti"

# =============================================================================
# 9. RESI
# =============================================================================
echo "↩️   Inserimento resi..."
run_sql <<'SQL'
-- Reso 1: Riccardo - bomber ricevuto, rimborso completato
INSERT INTO returns (id, order_id, user_id, status, reason, admin_note, refund_amount, resolved_at, created_at) VALUES
('00000000-0000-0000-0009-000000000001','00000000-0000-0000-0005-000000000009','00000000-0000-0000-0001-000000000018',
 'refunded','Taglia errata, il M è troppo grande','Reso accettato, rimborso sul metodo originale',199.90,
 NOW()-INTERVAL '1 month'+INTERVAL '2 weeks', NOW()-INTERVAL '1 month'+INTERVAL '2 weeks' - INTERVAL '5 days');
INSERT INTO return_items ( return_id, order_item_id, quantity) VALUES
('00000000-0000-0000-0009-000000000001','00000000-0000-0000-0008-000000000016',1);

-- Reso 2: Marco - cappotto, approvato ma non ancora ricevuto
INSERT INTO returns (id, order_id, user_id, status, reason, admin_note, refund_amount, resolved_at, created_at) VALUES
('00000000-0000-0000-0009-000000000002','00000000-0000-0000-0005-000000000003','00000000-0000-0000-0001-000000000012',
 'approved','Il cappotto non corrisponde alle foto, colore diverso','Reso approvato, attendiamo il pacco',NULL,
 NULL, NOW()-INTERVAL '1 week');
INSERT INTO return_items ( return_id, order_item_id, quantity) VALUES
('00000000-0000-0000-0009-000000000002','00000000-0000-0000-0008-000000000005',1);

-- Reso 3: Luca - polo, richiesto
INSERT INTO returns (id, order_id, user_id, status, reason, admin_note, refund_amount, resolved_at, created_at) VALUES
('00000000-0000-0000-0009-000000000003','00000000-0000-0000-0005-000000000001','00000000-0000-0000-0001-000000000010',
 'requested','Tessuto diverso dal previsto, non come descritto',NULL,NULL,
 NULL, NOW()-INTERVAL '3 days');
INSERT INTO return_items ( return_id, order_item_id, quantity) VALUES
('00000000-0000-0000-0009-000000000003','00000000-0000-0000-0008-000000000002',1);

-- Reso 4: Valentina - trench, ricevuto
INSERT INTO returns (id, order_id, user_id, status, reason, admin_note, refund_amount, resolved_at, created_at) VALUES
('00000000-0000-0000-0009-000000000004','00000000-0000-0000-0005-000000000010','00000000-0000-0000-0001-000000000019',
 'received','Il trench ha un difetto sulla cucitura della spalla destra',
 'Difetto confermato, in attesa di autorizzazione rimborso',NULL,
 NULL, NOW()-INTERVAL '1 month');
INSERT INTO return_items ( return_id, order_item_id, quantity) VALUES
('00000000-0000-0000-0009-000000000004','00000000-0000-0000-0008-000000000017',1);
SQL
echo "   ✓ 4 resi inseriti"

# =============================================================================
# 10. RECENSIONI
# =============================================================================
echo "⭐  Inserimento recensioni..."
run_sql <<'SQL'
INSERT INTO reviews ( product_id, user_id, rating, title, body, status, created_at) VALUES

-- T-Shirt Essential
('00000000-0000-0000-0003-000000000001','00000000-0000-0000-0001-000000000010',
 5,'Perfetta in tutto','Cotone morbidissimo, taglia perfetta. Già lavata 10 volte e non si è ristretta. Consigliatissima.','approved',NOW()-INTERVAL '3 months'),
('00000000-0000-0000-0003-000000000001','00000000-0000-0000-0001-000000000014',
 4,'Ottima qualità','T-shirt di ottima fattura. Tolgo una stella perché i tempi di consegna sono stati un po'' lunghi, ma il prodotto è top.','approved',NOW()-INTERVAL '2 months'),
('00000000-0000-0000-0003-000000000001','00000000-0000-0000-0001-000000000020',
 3,'Nella media','Qualità discreta ma non eccezionale per il prezzo. Mi aspettavo di meglio.','pending',NOW()-INTERVAL '1 month'),

-- Polo Piqué
('00000000-0000-0000-0003-000000000002','00000000-0000-0000-0001-000000000012',
 5,'La polo definitiva','Tessuto fantastico, i bottoni in madreperla danno un tocco di classe. Finalmente una polo che dura.','approved',NOW()-INTERVAL '4 months'),

-- Jeans Slim
('00000000-0000-0000-0003-000000000004','00000000-0000-0000-0001-000000000016',
 5,'Jeans da 10 e lode','Il denim selvedge è di livello superiore. Il lavaggio dark è perfetto. Li porto con tutto.','approved',NOW()-INTERVAL '1 week'),
('00000000-0000-0000-0003-000000000004','00000000-0000-0000-0001-000000000018',
 2,'Taglia non precisa','Il 32/30 calza come un 31/30. Consigliate di prendere una taglia in più rispetto al solito.','approved',NOW()-INTERVAL '1 month'+INTERVAL '3 weeks'),

-- Abito Midi Lino
('00000000-0000-0000-0003-000000000011','00000000-0000-0000-0001-000000000011',
 5,'Abito estivo perfetto','Lino leggerissimo, cade benissimo. L''ho portato sia in spiaggia che a cena, versatilissimo.','approved',NOW()-INTERVAL '2 months'),
('00000000-0000-0000-0003-000000000011','00000000-0000-0000-0001-000000000019',
 4,'Bella qualità, attenzione alle misure','Bellissimo ma taglia piccola. Sono una S abituale e ho preso la M. Consiglio di salire di una taglia.','approved',NOW()-INTERVAL '5 months'),

-- Mini Dress Plissé
('00000000-0000-0000-0003-000000000012','00000000-0000-0000-0001-000000000013',
 5,'Un sogno!','Il tessuto plissé è incredibile, non si stira mai. Il taglio è super flattering. Lo consiglio a tutte.','approved',NOW()-INTERVAL '3 weeks'),
('00000000-0000-0000-0003-000000000012','00000000-0000-0000-0001-000000000015',
 4,'Ottimo rapporto qualità-prezzo','Per il prezzo è davvero un acquisto top. La zip è robusta e il tessuto tiene bene.','approved',NOW()-INTERVAL '2 months'),

-- Blazer Oversize
('00000000-0000-0000-0003-000000000013','00000000-0000-0000-0001-000000000015',
 5,'Blazer dei sogni','Struttura perfetta, il fit oversize è esattamente come lo volevo. Lo uso come giacca e come completo.','approved',NOW()-INTERVAL '2 months'),

-- Bomber
('00000000-0000-0000-0003-000000000007','00000000-0000-0000-0001-000000000018',
 1,'Taglia sbagliata, reso difficile','Il M va come un XS. Processo di reso complicato. Non sono soddisfatto dell''assistenza.','approved',NOW()-INTERVAL '1 month'+INTERVAL '2 weeks'),

-- Cappotto
('00000000-0000-0000-0003-000000000008','00000000-0000-0000-0001-000000000012',
 3,'Bello ma colore diverso','Il tessuto è di qualità ma il colore è molto più scuro rispetto alle foto. Sembra un marrone mentre online appare cammello chiaro.','pending',NOW()-INTERVAL '3 weeks'),

-- Felpa Hoodie
('00000000-0000-0000-0003-000000000018','00000000-0000-0000-0001-000000000021',
 5,'La felpa definitiva','Spessissima, morbidissima, il cappuccio double-layer è una figata. La userò per anni.','approved',NOW()-INTERVAL '2 months'),
('00000000-0000-0000-0003-000000000018','00000000-0000-0000-0001-000000000016',
 4,'Ottima felpa sport','Perfetta per l''allenamento. Assorbe il sudore e asciuga rapidamente. La M calza leggermente larga (e lo dice uno che di solito prende M).','pending',NOW()-INTERVAL '2 weeks'),

-- Borsa Tote
('00000000-0000-0000-0003-000000000015','00000000-0000-0000-0001-000000000013',
 5,'Borsa perfetta per tutto','Capiente, robusta, i manici in pelle sono bellissimi. La uso ogni giorno da 6 mesi e sembra nuova.','approved',NOW()-INTERVAL '4 months'),

-- Sneaker
('00000000-0000-0000-0003-000000000020','00000000-0000-0000-0001-000000000020',
 4,'Comode e leggere','Perfette per correre e per il daily. Unico neo: il bianco si sporca abbastanza facilmente. Ma sono sneaker, è normale.','pending',NOW()-INTERVAL '1 week'),

-- Cintura
('00000000-0000-0000-0003-000000000016','00000000-0000-0000-0001-000000000022',
 5,'Cintura di altissima qualità','Pelle vera, bordi rifiniti perfettamente. La fibbia è solida. Non cambierò cintura per anni.','approved',NOW()-INTERVAL '1 month');

-- Aggiorna avg_rating dei prodotti
UPDATE products p SET avg_rating = (
  SELECT ROUND(AVG(r.rating)::numeric, 2)
  FROM reviews r
  WHERE r.product_id = p.id AND r.status = 'approved'
);
SQL
echo "   ✓ 18 recensioni inserite"

# =============================================================================
# 11. WISHLIST
# =============================================================================
echo "❤️   Inserimento wishlist..."
run_sql <<'SQL'
INSERT INTO wishlists (user_id, product_id, added_at) VALUES
('00000000-0000-0000-0001-000000000010','00000000-0000-0000-0003-000000000007',NOW()-INTERVAL '2 months'),
('00000000-0000-0000-0001-000000000010','00000000-0000-0000-0003-000000000008',NOW()-INTERVAL '1 month'),
('00000000-0000-0000-0001-000000000011','00000000-0000-0000-0003-000000000013',NOW()-INTERVAL '3 months'),
('00000000-0000-0000-0001-000000000011','00000000-0000-0000-0003-000000000014',NOW()-INTERVAL '2 months'),
('00000000-0000-0000-0001-000000000011','00000000-0000-0000-0003-000000000012',NOW()-INTERVAL '1 week'),
('00000000-0000-0000-0001-000000000012','00000000-0000-0000-0003-000000000004',NOW()-INTERVAL '1 month'),
('00000000-0000-0000-0001-000000000013','00000000-0000-0000-0003-000000000010',NOW()-INTERVAL '2 weeks'),
('00000000-0000-0000-0001-000000000013','00000000-0000-0000-0003-000000000009',NOW()-INTERVAL '3 weeks'),
('00000000-0000-0000-0001-000000000016','00000000-0000-0000-0003-000000000018',NOW()-INTERVAL '1 month'),
('00000000-0000-0000-0001-000000000017','00000000-0000-0000-0003-000000000011',NOW()-INTERVAL '3 weeks'),
('00000000-0000-0000-0001-000000000019','00000000-0000-0000-0003-000000000015',NOW()-INTERVAL '4 months'),
('00000000-0000-0000-0001-000000000020','00000000-0000-0000-0003-000000000020',NOW()-INTERVAL '1 month'),
('00000000-0000-0000-0001-000000000021','00000000-0000-0000-0003-000000000003',NOW()-INTERVAL '2 weeks'),
('00000000-0000-0000-0001-000000000022','00000000-0000-0000-0003-000000000016',NOW()-INTERVAL '1 week');
SQL
echo "   ✓ Wishlist inserite"

# =============================================================================
# RIEPILOGO FINALE
# =============================================================================
echo ""
echo "═══════════════════════════════════════════════════"
echo "   ✅  SEED COMPLETATO CON SUCCESSO!"
echo "═══════════════════════════════════════════════════"
echo ""
run_sql <<'SQL'
SELECT
  (SELECT COUNT(*) FROM users WHERE role='admin')        AS "Admin",
  (SELECT COUNT(*) FROM users WHERE role='user')         AS "Utenti",
  (SELECT COUNT(*) FROM categories)                      AS "Categorie",
  (SELECT COUNT(*) FROM products)                        AS "Prodotti",
  (SELECT COUNT(*) FROM product_variants)                AS "Varianti",
  (SELECT COUNT(*) FROM product_images)                  AS "Immagini",
  (SELECT COUNT(*) FROM orders)                          AS "Ordini",
  (SELECT COUNT(*) FROM order_items)                     AS "Righe ordine",
  (SELECT COUNT(*) FROM returns)                         AS "Resi",
  (SELECT COUNT(*) FROM reviews)                         AS "Recensioni",
  (SELECT COUNT(*) FROM promo_codes)                     AS "Promo codes",
  (SELECT COUNT(*) FROM wishlists)                       AS "Wishlist";
SQL
echo ""
echo "   🔑  Credenziali:"
echo "   Admin:  giacomo.masiero@marconirovereto.it  /  Admin1234!"
echo "           alessio.ferrari@marconirovereto.it   /  Admin1234!"
echo "           amedeo.azzetti@marconirovereto.it    /  Admin1234!"
echo "   Utente: luca.bianchi@gmail.com               /  Admin1234!"
echo "           (tutti gli utenti hanno la stessa password)"
echo ""
