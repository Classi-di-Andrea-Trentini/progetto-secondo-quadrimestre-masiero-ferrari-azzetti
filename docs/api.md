# API

Tutti gli endpoint del backend Java (`server-java/src/main/java/it/commonera/backend/controllers/`).

- **Prefisso**: `/api` (`server.servlet.context-path`). In Docker il backend sta su
  `http://localhost:3000`, quindi `http://localhost:3000/api/...`.
- **Autenticazione**: cookie HttpOnly `access_token`. Dal browser ogni chiamata va
  fatta con `withCredentials: true`; non esiste nessun header `Authorization`.
- **Errori**: `{ "message": …, "error": …, "statusCode": … }`. Su un errore di
  validazione `message` e' una **lista** di messaggi.
- **401** = non autenticato (il frontend manda al login), **403** = autenticato ma
  senza permessi.
- Gli importi sono numeri JSON, non stringhe.

Legenda della colonna "Accesso": **pubblico**, **utente** (serve la sessione),
**admin** (serve il ruolo `admin`).

---

## Autenticazione — `/auth`

| Metodo | Percorso | Accesso | Corpo / parametri | Risposta |
|---|---|---|---|---|
| POST | `/auth/register` | pubblico | `{ email, password (min 8), fullName (2-255) }` | `{ message, user }` |
| POST | `/auth/login` | pubblico | `{ email, password }` | `{ user }` + cookie di sessione |
| POST | `/auth/logout` | pubblico | — | `{ message }` + cookie svuotato |
| POST | `/auth/forgot-password` | pubblico | `{ email }` | `{ message }` — **sempre lo stesso**, esista o no l'indirizzo |
| POST | `/auth/reset-password` | pubblico | `{ token, password }` | `{ message }` |
| GET | `/auth/me` | utente | — | l'utente della sessione |
| GET | `/config` | pubblico | — | `{ googleAuthEnabled, googleAuthUrl }` |
| GET | `/auth/oauth2/authorize/google` | pubblico | — | redirect alla schermata di consenso di Google |
| GET | `/auth/oauth2/callback/google` | pubblico | `?code&state` | cookie di sessione + redirect al frontend |

`login` e' limitato a 5 tentativi falliti in 15 minuti per indirizzo email. E'
l'**unica** rotta con un limite di richieste.

### Accedi con Google

Le due rotte `/auth/oauth2/**` **esistono solo se** `GOOGLE_CLIENT_ID` e
`GOOGLE_CLIENT_SECRET` sono configurate; senza, rispondono 404 e `/config` dice
`googleAuthEnabled: false`, cosi' il frontend non disegna il bottone. Stesso
trattamento di Stripe: l'applicazione parte comunque.

Il giro e' un authorization code flow **lato server**: l'`id_token` non arriva mai
al JavaScript della pagina, e al ritorno il backend emette lo **stesso** cookie
`access_token` del login con password — un solo modello di sessione.

Le regole con cui un'identita' Google viene associata a un account esistente stanno
in `GoogleAccountService`, che ne e' anche la documentazione. In breve: si accetta
solo con `email_verified: true`; si riconosce l'utente dal `sub` e non dall'email;
un indirizzo gia' presente e **verificato** si collega, uno **non verificato** viene
**rifiutato** (altrimenti chi registra l'indirizzo di un altro senza confermarlo si
prenderebbe il suo account Google).

## Catalogo — `/products`

| Metodo | Percorso | Accesso | Note |
|---|---|---|---|
| GET | `/products` | pubblico | filtri e paginazione, vedi sotto |
| GET | `/products/filters` | pubblico | valori possibili dei filtri |
| GET | `/products/by-ids?ids=a,b,c` | pubblico | id malformati ignorati in silenzio |
| GET | `/products/{slug}` | pubblico | scheda + prodotti correlati |

Parametri di `GET /products`: `search`, `categoryId`, `brand`, `minPrice`,
`maxPrice`, `colors` (ripetibile), `sizes` (ripetibile), `sortBy`
(`price_asc` · `price_desc` · `popular` · `rating` · default `newest`),
`page` (default 1), `limit` (default 24, **massimo 100**).

Risposta: `{ data: [...], meta: { total, page, limit, totalPages } }`.

## Carrello — `/cart`

| Metodo | Percorso | Accesso | Corpo |
|---|---|---|---|
| GET | `/cart` | utente | — |
| POST | `/cart/items` | utente | `{ variantId, quantity }` |
| PATCH | `/cart/items/{variantId}` | utente | `{ quantity }` |
| DELETE | `/cart/items/{variantId}` | utente | — |
| DELETE | `/cart` | utente | — |
| POST | `/cart/merge` | utente | `{ items: [{ variantId, quantity }] }` |

`merge` si chiama subito dopo il login, col carrello che l'utente aveva da ospite.

## Checkout — `/checkout`

| Metodo | Percorso | Accesso |
|---|---|---|
| POST | `/checkout` | utente |

```json
{
  "addressId": "uuid",
  "items": [{ "variantId": "uuid", "quantity": 1 }],
  "shippingMethod": "standard",
  "promoCode": "SALDI20",
  "giftCardCode": "XXXX-XXXX",
  "loyaltyPoints": 500,
  "notes": "citofono rotto"
}
```

Risposta: `{ orderId, total, loyaltyDiscount, giftCardApplied, status: "paid" }`.

Tutti i campi dopo `items` sono facoltativi. Spedizione: 4,90 € standard, 9,90 €
express, gratis sopra 100 € calcolati **al netto del promo**.

> `status` e' `paid` senza che nessun denaro sia stato incassato: non esiste ancora
> un fornitore di pagamento collegato.

## Ordini — `/orders`

| Metodo | Percorso | Accesso | Note |
|---|---|---|---|
| GET | `/orders` | utente | paginato |
| GET | `/orders/{id}` | utente | con cronologia degli stati |
| PATCH | `/orders/{id}/cancel` | utente | rimette giacenza, punti e gift card |
| GET | `/orders/{id}/invoice` | utente | PDF, numerazione progressiva per anno |

## Resi — `/returns`

| Metodo | Percorso | Accesso | Note |
|---|---|---|---|
| GET | `/returns` | utente | i propri |
| GET | `/returns/{id}` | utente | |
| POST | `/returns` | utente | solo su ordini `delivered` o `completed` |

## Sconti e crediti

| Metodo | Percorso | Accesso | Note |
|---|---|---|---|
| POST | `/promo-codes/validate` | utente | `{ code, orderAmount }` |
| GET | `/gift-cards/{code}` | utente | saldo e scadenza |
| GET | `/loyalty` | utente | saldo punti |
| GET | `/loyalty/history` | utente | movimenti |

1 punto per euro, 100 punti = 1 €, riscattabili da 500 punti in su.

## Recensioni — `/reviews`

| Metodo | Percorso | Accesso | Note |
|---|---|---|---|
| GET | `/reviews/product/{productId}` | **pubblico** | paginato |
| POST | `/reviews` | utente | `{ productId, rating, title?, body? }` |
| POST | `/reviews/{id}/helpful` | utente | un voto per persona |
| DELETE | `/reviews/{id}` | utente | solo la propria |

## Wishlist, indirizzi, avvisi, newsletter

| Metodo | Percorso | Accesso | Note |
|---|---|---|---|
| GET | `/wishlist` | utente | elementi completi |
| GET | `/wishlist/ids` | utente | solo gli id, per i cuoricini sulla griglia |
| POST | `/wishlist/{productId}/toggle` | utente | |
| GET | `/addresses` | utente | |
| POST | `/addresses` | utente | |
| PUT | `/addresses/{id}` | utente | |
| DELETE | `/addresses/{id}` | utente | |
| PATCH | **`/addresses/{id}/set-default`** | utente | ⚠️ il frontend chiama `/default`: risponde 404 |
| GET | `/stock-alerts` | utente | |
| POST | `/stock-alerts` | utente | |
| DELETE | `/stock-alerts` | utente | |
| POST | `/newsletter/subscribe` | **pubblico** | chiunque, anche senza account |

## Profilo e privacy — `/users`

| Metodo | Percorso | Accesso | Note |
|---|---|---|---|
| PATCH | `/users/me` | utente | solo i campi presenti vengono toccati |
| POST | `/users/me/change-password` | utente | revoca tutte le **altre** sessioni |
| POST | `/users/me/change-email` | utente | conferma al nuovo indirizzo, avviso al vecchio |
| POST | `/users/me/send-verification` | utente | |
| GET | `/users/me/export` | utente | **GDPR art. 20**: JSON scaricato come allegato |
| DELETE | `/users/me` | utente | **GDPR art. 17**: `{ password }`, cancellazione logica |
| GET | `/users/verify-email/{token}` | **pubblico** | ci si arriva dall'email |
| GET | `/users/confirm-email/{token}` | **pubblico** | idem |

## Amministrazione — `/admin`

Tutto sotto `/admin/**` richiede il ruolo `admin`.

### Statistiche e magazzino

| Metodo | Percorso | Interfaccia |
|---|---|---|
| GET | `/admin/dashboard/stats` | si' |
| GET | `/admin/inventory` | **no** |
| PATCH | `/admin/inventory/{variantId}/stock` | **no** — `{ delta }` oppure `{ set }`, non entrambi; fa partire gli avvisi "torna disponibile" |

### Ordini

| Metodo | Percorso |
|---|---|
| GET | `/admin/orders` |
| GET | `/admin/orders/{id}` |
| GET | `/admin/orders/export` (CSV) |
| PATCH | `/admin/orders/{id}/status` |

> `PATCH /admin/orders/{id}/status` **non valida la transizione**: accetta qualunque
> stato e non compensa niente.

### Catalogo

| Metodo | Percorso |
|---|---|
| GET | `/admin/products`, `/admin/products/{id}`, `/admin/products/export` |
| POST | `/admin/products` |
| PATCH | `/admin/products/{id}` |
| DELETE | `/admin/products/{id}` |
| GET | `/admin/categories` |
| POST | `/admin/categories` |
| POST | `/admin/products/{id}/variants` |
| PATCH | `/admin/products/{id}/variants/{variantId}` |
| DELETE | `/admin/products/{id}/variants/{variantId}` |
| POST | `/admin/products/{id}/images` (per URL) |
| POST | `/admin/products/{id}/images/upload` (multipart, max 5 MB) |
| PATCH | `/admin/products/{id}/images/{imageId}/cover` |
| DELETE | `/admin/products/{id}/images/{imageId}` |

Le immagini caricate sono servite su `GET /uploads/**`, **pubblico**: senza,
rispondevano 401 proprio ai clienti che devono vedere la merce.

### Utenti, recensioni, promo, resi, gift card

| Metodo | Percorso | Interfaccia |
|---|---|---|
| GET | `/admin/users`, `/admin/users/export` | elenco si', export **no** |
| PATCH | `/admin/users/{id}/role` | si' |
| DELETE | `/admin/users/{id}` | si' |
| GET | `/admin/reviews` · PATCH `/admin/reviews/{id}/status` · DELETE `/admin/reviews/{id}` | si' |
| GET/POST/PATCH/DELETE | `/admin/promo-codes` | si' |
| GET | `/admin/returns` · PATCH `/admin/returns/{id}/status` | si' |
| GET/POST | `/admin/gift-cards` | **no** |

---

## Cosa non esiste (ancora)

- **Nessun endpoint di pagamento.** Niente `POST /payments/webhook`, e
  `SecurityConfig` non ha nessuna rotta di pagamento fra le pubbliche: un webhook
  verrebbe respinto con 401.
- **Nessun endpoint di ricerca dedicato**: la ricerca e' il parametro `search` di
  `GET /products`.
