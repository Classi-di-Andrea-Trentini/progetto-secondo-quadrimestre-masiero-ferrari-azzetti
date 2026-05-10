# Common Era — API Reference

Base URL: `http://localhost:3000/api`  
Formato: JSON  
Autenticazione: cookie HttpOnly `access_token` (JWT, 7 giorni)  
Rate limiting globale: **100 req/min per IP**

---

## Indice

- [Auth](#auth)
- [Users](#users)
- [Products](#products)
- [Wishlist](#wishlist)
- [Addresses](#addresses)
- [Checkout](#checkout)
- [Orders](#orders)
- [Promo Codes](#promo-codes)
- [Reviews](#reviews)
- [Returns](#returns)
- [Newsletter](#newsletter)
- [Admin](#admin)

---

## Auth

### `POST /api/auth/register`
Registra un nuovo utente.  
**Rate limit:** 5 req / 15 min per IP.

**Body:**
```json
{
  "fullName": "Mario Rossi",
  "email": "mario@example.com",
  "password": "Password1"
}
```

| Campo | Tipo | Regole |
|-------|------|--------|
| `fullName` | string | 2–255 caratteri |
| `email` | string | email valida, max 255 |
| `password` | string | 8–72 car., ≥1 maiusc., ≥1 minusc., ≥1 cifra |

**Risposta `201`:**
```json
{
  "message": "Registrazione completata",
  "user": {
    "id": "uuid",
    "email": "mario@example.com",
    "fullName": "Mario Rossi",
    "role": "user"
  }
}
```

---

### `POST /api/auth/login`
Effettua il login. Imposta il cookie `access_token`.  
**Rate limit:** 10 req / 15 min per IP.

**Body:**
```json
{
  "email": "mario@example.com",
  "password": "Password1"
}
```

**Risposta `200`:**
```json
{
  "message": "Login effettuato",
  "user": {
    "id": "uuid",
    "email": "mario@example.com",
    "fullName": "Mario Rossi",
    "role": "user",
    "phone": null,
    "birthDate": null,
    "gender": null,
    "emailVerifiedAt": null,
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
}
```

---

### `POST /api/auth/logout`
Invalida la sessione e cancella il cookie.  
**Auth:** richiesta.

**Risposta `200`:**
```json
{ "message": "Logout effettuato" }
```

---

### `GET /api/auth/me`
Restituisce i dati dell'utente autenticato corrente.  
**Auth:** richiesta.

**Risposta `200`:** oggetto utente (stesso schema di login).

---

## Users

### `PATCH /api/users/me`
Aggiorna il profilo dell'utente autenticato.  
**Auth:** richiesta.

**Body (tutti opzionali):**
```json
{
  "fullName": "Mario Rossi",
  "phone": "+39 333 1234567",
  "birthDate": "1990-05-15",
  "gender": "male"
}
```

**Risposta `200`:** oggetto utente aggiornato.

---

### `POST /api/users/me/change-password`
Cambia la password. Invalida tutte le sessioni tranne quella corrente.  
**Auth:** richiesta.

**Body:**
```json
{
  "currentPassword": "OldPass1",
  "newPassword": "NewPass1",
  "confirmPassword": "NewPass1"
}
```

**Risposta `200`:**
```json
{ "message": "Password aggiornata" }
```

---

### `POST /api/users/me/change-email`
Avvia la procedura di cambio email (invia mail di conferma al nuovo indirizzo).  
**Auth:** richiesta.

**Body:**
```json
{
  "newEmail": "nuovo@example.com",
  "currentPassword": "Password1"
}
```

**Risposta `200`:**
```json
{ "message": "Email di conferma inviata a nuovo@example.com" }
```

---

### `POST /api/users/me/send-verification`
Invia (o reinvia) l'email di verifica dell'indirizzo attuale.  
**Auth:** richiesta.

**Risposta `200`:**
```json
{ "message": "Email di verifica inviata" }
```

---

### `GET /api/users/verify-email/:token`
Verifica l'indirizzo email tramite token ricevuto via mail.

**Risposta `200`:**
```json
{ "message": "Email verificata con successo" }
```

---

### `GET /api/users/confirm-email/:token`
Conferma il cambio email tramite token ricevuto via mail.

**Risposta `200`:**
```json
{ "message": "Email aggiornata con successo" }
```

---

## Products

### `GET /api/products`
Lista prodotti con filtri, ordinamento e paginazione.

**Query params:**

| Param | Tipo | Default | Descrizione |
|-------|------|---------|-------------|
| `search` | string | — | Ricerca full-text su nome / descrizione |
| `categoryId` | string (UUID) | — | Filtra per categoria |
| `brand` | string | — | Filtra per brand |
| `minPrice` | number | — | Prezzo minimo (€) |
| `maxPrice` | number | — | Prezzo massimo (€) |
| `isFeatured` | boolean | — | Solo prodotti in evidenza |
| `isNewArrival` | boolean | — | Solo nuovi arrivi |
| `colors[]` | string[] | — | Filtra per colori esadecimali es. `#000000` |
| `sizes[]` | string[] | — | Filtra per taglie es. `M`, `L` |
| `sortBy` | string | `newest` | `newest` \| `popular` \| `price_asc` \| `price_desc` \| `rating` |
| `page` | number | `1` | Pagina |
| `limit` | number | `24` | Elementi per pagina (max 100) |

**Risposta `200`:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "T-Shirt Classic",
      "slug": "t-shirt-classic",
      "description": "...",
      "basePrice": "49.90",
      "isActive": true,
      "rating": "4.5",
      "soldCount": 120,
      "category": { "id": "uuid", "name": "T-Shirt" },
      "images": [{ "url": "https://...", "isCover": true }],
      "discounts": [{ "type": "percentage", "value": "10", "isActive": true }],
      "variants": [...]
    }
  ],
  "meta": {
    "total": 48,
    "page": 1,
    "limit": 24,
    "totalPages": 2
  }
}
```

> **Nota:** `basePrice`, `rating`, `discounts[].value` sono stringhe (Prisma Decimal) — convertire con `parseFloat()` nel client.

---

### `GET /api/products/filters`
Restituisce i metadati disponibili per costruire i filtri UI.

**Risposta `200`:**
```json
{
  "categories": [{ "id": "uuid", "name": "T-Shirt", "slug": "t-shirt" }],
  "colors": ["#000000", "#FFFFFF", "#FF0000"],
  "sizes": ["XS", "S", "M", "L", "XL"],
  "priceRange": { "min": 19.90, "max": 299.90 }
}
```

---

### `GET /api/products/:slug`
Dettaglio singolo prodotto per slug.

**Risposta `200`:** oggetto prodotto completo con varianti, immagini, sconti, rating, recensioni approvate.

**Risposta `404`:** prodotto non trovato.

---

## Wishlist

> Tutti gli endpoint richiedono autenticazione.

### `GET /api/wishlist`
Lista completa dei prodotti salvati dall'utente (con dettagli prodotto e immagini).

---

### `GET /api/wishlist/ids`
Array degli ID prodotto nella wishlist — utile per marcare i cuoricini nell'UI senza caricare tutti i dati.

**Risposta `200`:**
```json
["uuid-prodotto-1", "uuid-prodotto-2"]
```

---

### `POST /api/wishlist/:productId/toggle`
Aggiunge o rimuove un prodotto dalla wishlist (toggle).

**Risposta `200`:**
```json
{ "saved": true }
```
oppure `{ "saved": false }` se è stato rimosso.

---

## Addresses

> Tutti gli endpoint richiedono autenticazione.

### `GET /api/addresses`
Lista tutti gli indirizzi dell'utente, ordinati per default prima, poi per data di creazione.

**Risposta `200`:**
```json
[
  {
    "id": "uuid",
    "label": "Casa",
    "fullName": "Mario Rossi",
    "phone": "+39 333 123456",
    "street": "Via Roma 12",
    "street2": null,
    "city": "Milano",
    "province": "MI",
    "postalCode": "20100",
    "country": "IT",
    "isDefault": true,
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
]
```

---

### `POST /api/addresses`
Crea un nuovo indirizzo.

**Body:**
```json
{
  "fullName": "Mario Rossi",
  "phone": "+39 333 123456",
  "street": "Via Roma 12",
  "street2": "Int. 3",
  "city": "Milano",
  "province": "MI",
  "postalCode": "20100",
  "country": "IT",
  "isDefault": false,
  "label": "Ufficio"
}
```

| Campo | Obbligatorio | Note |
|-------|-------------|------|
| `fullName` | ✅ | 2–255 car. |
| `street` | ✅ | 2–255 car. |
| `city` | ✅ | 2–100 car. |
| `postalCode` | ✅ | 3–20 car. |
| `street2` | ❌ | max 255 |
| `province` | ❌ | max 50 |
| `country` | ❌ | default `IT` |
| `phone` | ❌ | max 30 |
| `label` | ❌ | max 50 |
| `isDefault` | ❌ | se `true` disimposta gli altri |

**Risposta `201`:** indirizzo creato.

---

### `PUT /api/addresses/:id`
Sostituisce completamente un indirizzo esistente.  
**Richiede proprietà** dell'indirizzo.

**Body:** stesso schema di POST.

---

### `DELETE /api/addresses/:id`
Elimina un indirizzo.  
**Richiede proprietà** dell'indirizzo.

**Risposta `200`:** vuoto.

---

### `PATCH /api/addresses/:id/set-default`
Imposta un indirizzo come predefinito (disimposta tutti gli altri).

**Risposta `200`:** indirizzo aggiornato.

---

## Checkout

> Richiede autenticazione.

### `POST /api/checkout`
Crea un ordine a partire dal carrello. Il pagamento è simulato (l'ordine viene creato direttamente con status `paid`).

**Body:**
```json
{
  "items": [
    { "variantId": "uuid-variante", "quantity": 2 }
  ],
  "addressId": "uuid-indirizzo",
  "shippingMethod": "standard",
  "promoCode": "ESTATE20",
  "notes": "Lasciare in portineria"
}
```

| Campo | Obbligatorio | Note |
|-------|-------------|------|
| `items` | ✅ | array, ogni item: `variantId` (UUID) + `quantity` (≥1) |
| `addressId` | ✅ | UUID di un indirizzo dell'utente |
| `shippingMethod` | ❌ | `standard` (default) \| `express` |
| `promoCode` | ❌ | codice promo da validare e applicare |
| `notes` | ❌ | note libere |

**Risposta `201`:**
```json
{
  "orderId": "uuid",
  "total": 89.80,
  "status": "paid"
}
```

**Risposta `400`:** variante non trovata, stock insufficiente, codice promo non valido.

---

## Orders

> Tutti gli endpoint richiedono autenticazione.

### `GET /api/orders`
Lista degli ordini dell'utente autenticato, dal più recente.

**Query params:**

| Param | Default |
|-------|---------|
| `page` | `1` |
| `limit` | `10` |

**Risposta `200`:**
```json
{
  "data": [
    {
      "id": "uuid",
      "status": "shipped",
      "total": "89.80",
      "subtotal": "99.80",
      "shippingCost": "0.00",
      "discountTotal": "10.00",
      "createdAt": "2026-05-01T10:00:00.000Z",
      "items": [
        { "productName": "T-Shirt Classic", "quantity": 2, "lineTotal": "89.80" }
      ],
      "payments": [{ "status": "completed" }]
    }
  ],
  "meta": { "total": 3, "page": 1, "limit": 10, "totalPages": 1 }
}
```

---

### `GET /api/orders/:id`
Dettaglio ordine singolo. Restituisce solo ordini dell'utente autenticato.

**Risposta `200`:** ordine completo con indirizzo, items, pagamenti, cronologia stato.  
**Risposta `404`:** ordine non trovato o non appartenente all'utente.

---

## Promo Codes

> Richiede autenticazione.

### `POST /api/promo-codes/validate`
Valida un codice promozionale e calcola lo sconto applicabile.

**Body:**
```json
{
  "code": "ESTATE20",
  "orderAmount": 150.00
}
```

**Risposta `200`:**
```json
{
  "discountValue": 30.00,
  "promoCodeId": "uuid",
  "message": "Sconto del 20% applicato"
}
```

**Risposta `400`:** codice non valido, scaduto, limite utilizzi raggiunto, ordine sotto il minimo.

---

## Reviews

### `GET /api/reviews/product/:productId`
Lista recensioni approvate per un prodotto, ordinate per data decrescente.

**Query params:**

| Param | Default |
|-------|---------|
| `page` | `1` |
| `limit` | `10` |

**Risposta `200`:**
```json
{
  "data": [
    {
      "id": "uuid",
      "rating": 5,
      "title": "Ottimo prodotto",
      "body": "Qualità eccellente...",
      "status": "approved",
      "helpfulCount": 3,
      "createdAt": "2026-04-01T00:00:00.000Z",
      "user": { "fullName": "M. Rossi" }
    }
  ],
  "meta": { "total": 12, "page": 1, "limit": 10, "totalPages": 2 }
}
```

---

### `POST /api/reviews`
Crea una nuova recensione. Lo stato iniziale è `pending` (in attesa di approvazione admin).  
**Auth:** richiesta.

**Body:**
```json
{
  "productId": "uuid",
  "variantId": "uuid",
  "rating": 4,
  "title": "Buona qualità",
  "body": "Consegna veloce, prodotto come descritto."
}
```

| Campo | Obbligatorio | Regole |
|-------|-------------|--------|
| `productId` | ✅ | UUID |
| `rating` | ✅ | intero 1–5 |
| `variantId` | ❌ | UUID variante acquistata |
| `title` | ❌ | max 255 car. |
| `body` | ❌ | testo libero |

**Risposta `201`:** recensione creata.

---

### `POST /api/reviews/:id/helpful`
Segna una recensione come "utile".  
**Auth:** richiesta.

---

### `DELETE /api/reviews/:id/helpful`
Rimuove il proprio voto "utile".  
**Auth:** richiesta.

---

### `DELETE /api/reviews/:id`
Elimina la propria recensione. Ricalcola il rating del prodotto.  
**Auth:** richiesta. Solo l'autore può eliminare.

**Risposta `204`:** nessun contenuto.

---

## Returns

> Tutti gli endpoint richiedono autenticazione.

### `GET /api/returns`
Lista delle richieste di reso dell'utente.

---

### `GET /api/returns/:id`
Dettaglio di una singola richiesta di reso.

---

### `POST /api/returns`
Apre una richiesta di reso per un ordine.

**Body:**
```json
{
  "orderId": "uuid",
  "reason": "Taglia errata",
  "items": [
    { "orderItemId": "uuid", "quantity": 1 }
  ]
}
```

**Risposta `201`:** richiesta di reso creata.

---

## Newsletter

### `POST /api/newsletter/subscribe`
Iscrive un indirizzo email alla newsletter.

**Body:**
```json
{ "email": "newsletter@example.com" }
```

**Risposta `201`:**
```json
{ "message": "Iscrizione completata" }
```

**Risposta `409`:** email già iscritta.

---

## Admin

> Tutti gli endpoint richiedono autenticazione **e** ruolo `admin`.  
> Header cookie `access_token` con JWT di un utente admin.

### Dashboard

#### `GET /api/admin/dashboard/stats`
KPI aggregati per la homepage del pannello.

**Risposta `200`:**
```json
{
  "totalUsers": 248,
  "totalOrders": 1032,
  "totalProducts": 86,
  "totalRevenue": 48320.50,
  "pendingOrders": 12,
  "recentOrders": [...],
  "topProducts": [
    { "id": "uuid", "name": "T-Shirt Classic", "soldCount": 340, "basePrice": "49.90" }
  ],
  "ordersByStatus": [
    { "status": "paid", "count": 45 },
    { "status": "shipped", "count": 30 }
  ]
}
```

---

### Users

#### `GET /api/admin/users`
Lista utenti paginata con ricerca.

**Query params:** `page`, `limit`, `search` (nome o email).

**Risposta `200`:**
```json
{
  "data": [
    {
      "id": "uuid",
      "email": "mario@example.com",
      "fullName": "Mario Rossi",
      "role": "user",
      "emailVerifiedAt": "2026-01-02T00:00:00.000Z",
      "createdAt": "2026-01-01T00:00:00.000Z",
      "_count": { "orders": 5 }
    }
  ],
  "meta": { "total": 248, "page": 1, "limit": 20, "totalPages": 13 }
}
```

---

#### `PATCH /api/admin/users/:id/role`
Aggiorna il ruolo di un utente.

**Body:**
```json
{ "role": "admin" }
```
Valori possibili: `user` | `admin`.

---

#### `DELETE /api/admin/users/:id`
Elimina un utente e tutti i dati associati (cascade).

**Risposta `200`:** `{ "message": "Utente eliminato" }`.

---

### Products

#### `GET /api/admin/products`
Lista prodotti con ricerca e paginazione.

**Query params:** `page`, `limit`, `search` (nome o slug).

---

#### `POST /api/admin/products`
Crea un nuovo prodotto.

**Body:**
```json
{
  "name": "Linen Shirt",
  "slug": "linen-shirt",
  "description": "Camicia in lino...",
  "categoryId": "uuid",
  "basePrice": 89.90,
  "isActive": true
}
```

**Risposta `400`:** slug già in uso.

---

#### `PATCH /api/admin/products/:id`
Aggiorna parzialmente un prodotto.

**Body (tutti opzionali):** `name`, `description`, `categoryId`, `basePrice`, `isActive`.

---

#### `DELETE /api/admin/products/:id`
Elimina un prodotto.

---

### Orders

#### `GET /api/admin/orders`
Lista ordini con filtro stato e ricerca.

**Query params:** `page`, `limit`, `search` (cliente o ID), `status`.

**Valori `status`:** `pending` | `paid` | `processing` | `shipped` | `delivered` | `completed` | `cancelled` | `refunded`.

---

#### `GET /api/admin/orders/:id`
Dettaglio completo ordine: items (con varianti e immagini), indirizzo, pagamenti, cronologia stati, codice promo.

---

#### `PATCH /api/admin/orders/:id/status`
Aggiorna lo stato di un ordine e crea un record nella cronologia.

**Body:**
```json
{
  "status": "shipped",
  "note": "Tracking: IT123456789"
}
```

**Risposta `200`:** `{ "id": "uuid", "status": "shipped" }`.

---

### Promo Codes

#### `GET /api/admin/promo-codes`
Lista codici promo con ricerca.

**Query params:** `page`, `limit`, `search` (codice).

**Risposta `200`:**
```json
{
  "data": [
    {
      "id": "uuid",
      "code": "ESTATE20",
      "type": "percentage",
      "value": "20",
      "minOrderAmount": "50.00",
      "maxUses": 100,
      "expiresAt": "2026-08-31T23:59:59.000Z",
      "isActive": true,
      "_count": { "uses": 34 }
    }
  ]
}
```

---

#### `POST /api/admin/promo-codes`
Crea un nuovo codice promo.

**Body:**
```json
{
  "code": "AUTUNNO15",
  "discountType": "percentage",
  "discountValue": 15,
  "minOrderAmount": 80,
  "maxUses": 200,
  "expiresAt": "2026-11-30",
  "isActive": true
}
```

| Campo | Obbligatorio | Valori |
|-------|-------------|--------|
| `code` | ✅ | stringa, convertita in uppercase |
| `discountType` | ✅ | `percentage` \| `fixed_amount` |
| `discountValue` | ✅ | numero positivo |
| `minOrderAmount` | ❌ | soglia minima ordine (€) |
| `maxUses` | ❌ | null = illimitati |
| `expiresAt` | ❌ | data ISO (null = nessuna scadenza) |
| `isActive` | ❌ | default `true` |

**Risposta `400`:** codice già esistente.

---

#### `PATCH /api/admin/promo-codes/:id`
Aggiorna un codice promo (isActive, maxUses, expiresAt).

---

#### `DELETE /api/admin/promo-codes/:id`
Elimina un codice promo.

---

### Reviews

#### `GET /api/admin/reviews`
Lista recensioni con filtro stato e ricerca.

**Query params:** `page`, `limit`, `search` (utente o prodotto), `status` (`pending` | `approved` | `rejected`).

---

#### `PATCH /api/admin/reviews/:id/status`
Approva o rifiuta una recensione.

**Body:**
```json
{ "status": "approved" }
```
Valori: `approved` | `rejected`.

---

#### `DELETE /api/admin/reviews/:id`
Elimina una recensione.

---

## Codici di errore comuni

| Codice | Significato |
|--------|-------------|
| `400` | Validazione fallita (body non conforme al DTO) |
| `401` | Non autenticato (cookie assente o scaduto) |
| `403` | Non autorizzato (ruolo insufficiente) |
| `404` | Risorsa non trovata |
| `409` | Conflitto (es. email già registrata, slug duplicato) |
| `429` | Rate limit superato |
| `500` | Errore interno del server |

---

## Note implementative

- Tutti i **valori monetari** (prezzi, totali) vengono serializzati da Prisma come **stringhe** — usare `parseFloat()` nel client prima di qualsiasi operazione aritmetica.
- Le **date** sono in formato ISO 8601 UTC.
- Gli **UUID** seguono lo standard v4 generato da PostgreSQL (`gen_random_uuid()`).
- Il **JWT** non contiene dati sensibili ma è validato anche contro la tabella `sessions` — un logout invalida la sessione server-side indipendentemente dall'expiry del token.
- La **paginazione** è sempre `{ data: T[], meta: { total, page, limit, totalPages } }`.
