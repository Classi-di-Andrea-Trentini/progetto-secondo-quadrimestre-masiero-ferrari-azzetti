# Schema del database

Fonte di verita': **`database/init/001_schema.sql`**. Non esiste nessuno schema
generato da un ORM, e non esistono migrazioni: le entita' JPA inseguono questo file,
e `ddl-auto=validate` fa fallire l'avvio se una non combacia.

Dati di prova: `database/init/002_seed_data.sql` — 24 prodotti, 10 categorie, tutto
in italiano.

Postgres esegue questi script **solo al primo avvio del volume**. Per rileggerli:
`docker compose down -v && docker compose up -d`.

Tutte le chiavi primarie sono UUID generati da `gen_random_uuid()` (estensione
`pgcrypto`). Tutti i timestamp sono `timestamp without time zone` — per questo le
entita' usano `LocalDateTime` e non `Instant`.

## Enum Postgres

I nomi sono in PascalCase **fra virgolette**, ereditati da come li generava Prisma.
In JPA vanno mappati con `@JdbcTypeCode(SqlTypes.NAMED_ENUM)`.

| Tipo | Valori |
|---|---|
| `"UserRole"` | `user`, `admin` |
| `"OrderStatus"` | `pending`, `paid`, `processing`, `shipped`, `delivered`, `completed`, `cancelled`, `refunded` |
| `"DiscountType"` | `percentage`, `fixed_amount` |
| `"PaymentStatus"` | `pending`, `succeeded`, `failed`, `refunded` |
| `"PaymentMethod"` | `credit_card`, `paypal`, `gift_card`, `bank_transfer` |
| `"ReturnStatus"` | `requested`, `approved`, `rejected`, `received`, `refunded` |
| `"ReviewStatus"` | `pending`, `approved`, `rejected` |
| `"NotificationType"` | `order_update`, `promo`, `system`, `review_reply`, `outfit_suggestion` |
| `"AiFeedback"` | `liked`, `disliked`, `ignored` |

> `"PaymentStatus"` non ha `partially_refunded`: un reso parziale non e'
> rappresentabile. E gli ultimi due tipi appartengono a tabelle che nessun codice
> usa.

## Le tabelle

### Persone e accesso

| Tabella | Note |
|---|---|
| `users` | `role` e' l'enum `"UserRole"`; `deleted_at` per la cancellazione **logica**; `is_active` per la sospensione |
| `user_addresses` | indirizzi di spedizione, con predefinito |
| `sessions` | una riga per sessione viva. `token_hash`, non il token; `ip_address` e' di tipo **`inet`** e resta fuori dall'entita' JPA |
| `email_verifications`, `password_resets` | token monouso, salvati come impronta |
| `notifications` | **nessun codice la usa** |

### Catalogo

| Tabella | Note |
|---|---|
| `categories` | gerarchiche, `parent_id` punta a se stessa (`ON DELETE SET NULL`) |
| `products` | `deleted_at` per la cancellazione logica; `avg_rating` e `sold_count` denormalizzati |
| `product_variants` | taglia, colore, `color_hex`, SKU, `stock_qty`, `price_override` |
| `product_images` | `is_cover = true` per la principale, `sort_order = 1` per quella al passaggio del mouse |
| `discounts` | sconti su prodotto o variante, con `"DiscountType"` |
| `tags`, `product_tags` | **nessun codice le usa** |

### Acquisto

| Tabella | Note |
|---|---|
| `carts` | **una per utente**: `user_id` e' `UNIQUE` |
| `cart_items` | `variant_id` e' `ON DELETE RESTRICT`: un prodotto nel carrello di qualcuno non si cancella |
| `orders` | `user_id` e' `ON DELETE RESTRICT`; `address_id` e' `ON DELETE SET NULL` |
| `order_items` | nome prodotto, etichetta variante e SKU sono **copiati**, non riferiti |
| `order_status_history` | ogni cambio di stato, con chi l'ha fatto |
| `payments` | vedi sotto |
| `promo_codes`, `promo_code_uses` | codici e loro utilizzi, per contare i tetti |
| `gift_cards`, `gift_card_transactions` | saldo e movimenti |
| `loyalty_entries` | i movimenti dei punti: il saldo e' una somma, non un campo |
| `returns`, `return_items` | resi |

### Dopo l'acquisto

| Tabella | Note |
|---|---|
| `reviews` | con `"ReviewStatus"` per la moderazione |
| `review_helpful_votes` | vincolo unico (recensione, utente): il "utile" non si puo' far salire ricaricando |
| `review_replies` | **nessun codice la usa** |
| `stock_alerts` | avvisi "torna disponibile", con `notified_at` |
| `ai_outfit_suggestions`, `ai_outfit_suggestion_items` | **nessun codice le usa** |
| `audit_logs` | **nessun codice le usa** |

## `payments`, per esteso

```sql
id, order_id, user_id,
status "PaymentStatus" DEFAULT 'pending',
method "PaymentMethod",
amount NUMERIC(10,2), currency VARCHAR(3) DEFAULT 'EUR',
provider VARCHAR(50),
provider_tx_id TEXT UNIQUE,     -- la chiave di idempotenza del webhook
provider_payload JSONB,
refunded_amount NUMERIC(10,2),
failed_reason TEXT,
paid_at TIMESTAMP, created_at, updated_at
```

Lo schema e' gia' pronto per un incasso vero: `provider_tx_id` e' **`UNIQUE`**, ed e'
il vincolo di database — non un `if` applicativo — a impedire che un webhook
ripetuto incassi due volte.

Il codice attuale scrive `status`, `method`, `amount` e `paid_at`, e lascia vuoto
tutto il resto. `refunded_amount` non viene mai valorizzato.

## Regole di cancellazione da conoscere

`ON DELETE RESTRICT` sulle righe che documentano una vendita:
`orders.user_id`, `orders.items.variant_id`, `returns.order_id`, `payments.order_id`,
`reviews.user_id`, `cart_items.variant_id`.

E' il motivo per cui la cancellazione di un account e' **logica** e non reale: i
documenti fiscali vanno conservati, e il database si rifiuterebbe comunque. Vedi
`PrivacyService` e [03-backend-users-mail.md](./03-backend-users-mail.md).

`ON DELETE SET NULL` dove il riferimento e' un contorno e non il fatto:
`orders.address_id`, `orders.promo_code_id`, `orders.gift_card_id`,
`categories.parent_id`.

`ON DELETE CASCADE` dove la riga figlia non ha senso da sola: sessioni, token,
righe di carrello, immagini e varianti di un prodotto, voti sulle recensioni.
