# Common Era — E-commerce

Progetto di fine secondo quadrimestre: un negozio online completo, realizzato con
**Angular 21**, **Spring Boot 4 / Java 21** e **PostgreSQL 16**.

> Il backend era inizialmente in NestJS + Prisma. E' stato riscritto in Java: il
> backend in uso e' `server-java/`, e `server/` resta nel repository come
> riferimento, fuori dal `docker-compose.yml`.

## Scadenze

| Data | Consegna |
|------|----------|
| 02/03/2026 | Canva + nome + descrizione + API + schema colore + Figma |
| 13/04/2026 | Versione 0.1 — servizi e componenti principali |
| **11/05/2026** | **Consegna finale + presentazione** |

## Avvio rapido

```bash
cp .env.example .env    # riempire almeno JWT_SECRET e DB_PASSWORD
docker compose up -d
```

- Frontend: <http://localhost:4200>
- API: <http://localhost:3000/api>
- Database: `localhost:5433` (utente `user`, database `mydb`)

Il database si popola **da solo** al primo avvio: Postgres esegue
`database/init/001_schema.sql` (lo schema) e `002_seed_data.sql` (24 prodotti, 10
categorie). Per rifarlo da zero: `docker compose down -v && docker compose up -d`.

Per entrare nel pannello di amministrazione si valorizzano `ADMIN_EMAIL` e
`ADMIN_PASSWORD` nel `.env`: all'avvio il backend crea l'account (o promuove quello
esistente). L'admin del seed, `admin@ecommerce.it`, ha un hash di cui non si conosce
la password.

> `database/seed.sh` e' un vecchio script di popolamento che punta a un container
> di nome `progetto-secondo-quadrimestre-masiero-ferrari-azzetti-db-1`: in questo
> repository il container si chiama `...-java-db-1`, quindi **non funziona cosi'
> com'e'**. La via buona e' `database/init/`.

---

## Criteri obbligatori del progetto

### 1. Multi-componente

L'applicazione è suddivisa in componenti Angular **standalone** riutilizzabili:

| Componente | Percorso | Ruolo |
|-----------|----------|-------|
| `NavBar` | `components/nav-bar/` | Barra di navigazione con scroll hide/show, badge carrello, avatar utente |
| `Cart` | `components/cart/` | Drawer carrello laterale con lista item, quantità, subtotale |
| `ProductImage` | `components/product-image/` | Immagine prodotto con segnaposto disegnato quando l'URL manca o non risponde |
| `Footer` | `components/footer/` | Footer statico con link a pagine legali |
| `Skeleton` | `components/skeleton/` | Placeholder di caricamento animato |
| `Breadcrumb` | `components/breadcrumb/` | Navigazione gerarchica nelle pagine prodotto |
| `Toast` | `components/toast/` | Notifiche temporanee a scomparsa |

Ogni pagina è a sua volta un componente standalone: `Home`, `Products`, `ProductDetail`, `MeComponent`, `Login`, `Register`, `Checkout`, `Admin`, `AdminDashboard`, `AdminProducts`, `AdminOrders`, `AdminUsers`, `AdminPromo`, `AdminReviews`, `AdminReturns`, `ForgotPassword`, `ResetPassword`, `VerifyEmail`, `Legal`, `About`, `NotFound`.

---

### 2. Routing

La tabella delle route è definita in [`e-commerce/src/app/app.routes.ts`](e-commerce/src/app/app.routes.ts):

| Path | Componente | Guard |
|------|-----------|-------|
| `/home` | `Home` | — |
| `/about` | `About` | — |
| `/products` | `Products` | — |
| `/product/:slug` | `ProductDetail` | — |
| `/login` | `Login` | — |
| `/register` | `Register` | — |
| `/forgot-password` | `ForgotPassword` | — |
| `/reset-password` | `ResetPassword` | — |
| `/verify-email/:token` | `VerifyEmail` | — |
| `/me` | `MeComponent` | `authGuardGuard` |
| `/checkout` | `Checkout` | `authGuardGuard` |
| `/legal/:pagina` | `Legal` | — |
| `/admin` | `Admin` | `adminGuardGuard` |
| `/admin/dashboard` | `AdminDashboard` | `adminGuardGuard` |
| `/admin/products` | `AdminProducts` | `adminGuardGuard` |
| `/admin/orders` | `AdminOrders` | `adminGuardGuard` |
| `/admin/users` | `AdminUsers` | `adminGuardGuard` |
| `/admin/promo` | `AdminPromo` | `adminGuardGuard` |
| `/admin/reviews` | `AdminReviews` | `adminGuardGuard` |
| `/admin/returns` | `AdminReturns` | `adminGuardGuard` |
| `**` | `NotFound` | — |

Le route `/admin/*` usano la struttura **parent/children**: `Admin` è il layout con sidebar, i figli renderizzano il contenuto via `<router-outlet>`. La navigazione usa `routerLink` e `routerLinkActive`.

Il jolly `**` rende una **404 vera**, con stato HTTP 404 assegnato in [`app.routes.server.ts`](e-commerce/src/app/app.routes.server.ts). Prima faceva `redirectTo: 'home'`, quindi un indirizzo sbagliato finiva in home dichiarando 200.

---

### 3. API

Il backend espone oltre 70 endpoint REST, tutti sotto il prefisso `/api`. L'elenco completo è in [`docs/api.md`](docs/api.md); qui i principali:

**Autenticazione**
- `POST /api/auth/register` — registrazione
- `POST /api/auth/login` — login (sessione in cookie HttpOnly)
- `POST /api/auth/logout` — logout e distruzione sessione
- `GET /api/auth/me` — profilo utente autenticato

**Prodotti**
- `GET /api/products` — lista con filtri (categoria, colore, taglia, prezzo, ordinamento, paginazione)
- `GET /api/products/filters` — metadati per i filtri (categorie, colori, taglie, range prezzo)
- `GET /api/products/:slug` — dettaglio prodotto + prodotti correlati

**Commerce**
- `GET /api/wishlist` — lista preferiti
- `POST /api/wishlist/:productId/toggle` — aggiungi/rimuovi preferito
- `POST /api/checkout` — crea ordine (transazione atomica: scalatura stock, applicazione promo)
- `GET /api/orders` — storico ordini
- `POST /api/reviews` — pubblica recensione
- `GET /api/reviews/product/:productId` — recensioni di un prodotto
- `POST /api/returns` — richiesta reso
- `GET /api/addresses`, `POST /api/addresses`, `PUT /api/addresses/:id`, `PATCH /api/addresses/:id/set-default`, `DELETE /api/addresses/:id`
- `POST /api/checkout` — crea l'ordine in una sola transazione
- `GET /api/users/me/export` e `DELETE /api/users/me` — i due diritti GDPR

**Admin** (solo ruolo `admin`)
- `GET /api/admin/dashboard/stats` — KPI (ricavi, ordini, utenti, prodotti)
- `GET /api/admin/orders`, `PATCH /api/admin/orders/:id/status`
- `GET /api/admin/users`, `PATCH /api/admin/users/:id/role`, `DELETE /api/admin/users/:id`
- `POST /api/admin/products`, `PATCH /api/admin/products/:id`, `DELETE /api/admin/products/:id`
- `GET /api/admin/promo-codes`, `POST /api/admin/promo-codes`
- `GET /api/admin/reviews`, `PATCH /api/admin/reviews/:id/status`
- `GET /api/admin/returns`, `PATCH /api/admin/returns/:id/status`
- `GET /api/admin/inventory`, `PATCH /api/admin/inventory/:variantId/stock`
- `GET /api/admin/gift-cards`, `POST /api/admin/gift-cards`

La documentazione completa degli endpoint è in [`docs/api.md`](docs/api.md).

---

### 4. Form

Tutte le form usano **Reactive Forms** di Angular (`FormBuilder`, `Validators`, `ReactiveFormsModule`):

| Form | Dove | Campi / Validatori |
|------|------|--------------------|
| Login | `pages/login/` | email, password — errori in-line |
| Registrazione | `pages/register/` | nome, email, password, conferma — validator custom `passwordComplexity` (maiuscola + minuscola + cifra) e `passwordMatch` (group-level) |
| Checkout — indirizzo | `pages/checkout/` | via, città, CAP, paese — con possibilità di aggiungere nuovo indirizzo |
| Checkout — promo | `pages/checkout/` | input codice sconto con validazione via API |
| Profilo | `pages/me/` | nome, telefono, data di nascita, genere |
| Cambio password | `pages/me/` | password corrente, nuova, conferma — validator cross-field |
| Cambio email | `pages/me/` | nuova email, password corrente |
| Gestione indirizzi | `pages/me/` | CRUD indirizzi di spedizione |
| Recupero password | `pages/forgot-password/` | email |
| Reset password | `pages/reset-password/` | nuova password, conferma |
| Recensione prodotto | `pages/product-detail/` | rating (1–5 stelle), titolo, testo |

---

### 5. Servizio

I servizi sono in `e-commerce/src/app/services/` e sono tutti `providedIn: 'root'` (singleton condiviso):

| Servizio | File | Responsabilità |
|---------|------|----------------|
| `AuthService` | `auth.ts` | Login/logout/registrazione, segnale `currentUser`, `isAuthenticated`, `isAdmin` |
| `ProductsService` | `products.service.ts` | `getProducts()`, `getFilters()`, `getProductBySlug()` |
| `WishlistService` | `wishlist.service.ts` | Segnale `savedIds`, toggle, load ids/items, reset al logout |
| `CartService` | `cart-service.ts` | Segnali `items`, `itemCount`, `subtotal`, `ready`; carrello in `localStorage` da ospite e sul server da collegato, con fusione al login |
| `AdminService` | `admin.service.ts` | `getStats()` e operazioni CRUD per la dashboard admin |
| `ReviewsService` | `reviews.service.ts` | `getByProduct()`, `create()` |
| `CookieConsentService` | `cookie-consent.ts` | L'informativa cookie, riapribile dal footer |
| `RecentlyViewedService` | `recently-viewed.ts` | I prodotti guardati di recente, nel `localStorage` |
| `SeoService` | `seo.ts` | Titolo, meta tag e dati strutturati JSON-LD |
| `ToastService` | `toast.service.ts` | Notifiche temporanee globali |

Lo stato di autenticazione è gestito tramite **Angular signals** (`signal()`, `computed()`): i componenti leggono `auth.currentUser()` e si aggiornano automaticamente senza `EventEmitter` né `BehaviorSubject`.

---

### 6. Guard

Due guard proteggono le route sensibili:

**`authGuardGuard`** — [`guards/auth-guard-guard.ts`](e-commerce/src/app/guards/auth-guard-guard.ts)
- Applicato a `/me` e `/checkout`
- Attende che `AuthService.isLoading()` diventi `false` (evita redirect durante l'idratazione SSR)
- Se non autenticato, reindirizza a `/login`

**`adminGuardGuard`** — [`guards/admin-guard-guard.ts`](e-commerce/src/app/guards/admin-guard-guard.ts)
- Applicato a tutte le route `/admin/*`
- Verifica che l'utente sia autenticato **e** abbia `role === 'admin'`
- Se non admin, reindirizza a `/home`
- Su server (SSR) restituisce `true` direttamente per evitare loop di redirect

---

## Stack tecnico

| Layer | Tecnologia |
|-------|-----------|
| Frontend | Angular 21 (standalone, SSR con `@angular/ssr`) |
| Stile | Tailwind CSS 4, design system a token OKLCH in `src/styles.css` |
| Test frontend | Vitest su jsdom |
| Backend | Spring Boot 4.1 · Java 21 · Gradle · Spring Security · JJWT · Lombok |
| Persistenza | Spring Data JPA con `ddl-auto=validate`: lo schema è SQL scritto a mano, non generato |
| Test backend | JUnit 5 + Testcontainers (un Postgres vero per ogni esecuzione) |
| Database | PostgreSQL 16 |
| Auth | JWT in cookie HttpOnly + tabella `sessions` (revoca reale) |
| Email | SMTP via `spring-boot-starter-mail`; senza configurazione le email finiscono nei log |
| Fatture | OpenPDF (LGPL/MPL), numerazione progressiva per anno |
| Infrastruttura | Docker Compose (3 servizi: frontend, backend, db) |
| CI | GitHub Actions: test backend e frontend a ogni push |

---

## Struttura del repository

```
├── e-commerce/                # Frontend Angular
│   ├── public/                # Illustrazioni del catalogo, icone, manifest
│   └── src/
│       ├── app/
│       │   ├── components/    # NavBar, Cart, Footer, Breadcrumb, ProductImage, Skeleton, Toast
│       │   ├── guards/        # authGuardGuard, adminGuardGuard
│       │   ├── pages/         # Home, Products, ProductDetail, Checkout, Me, Admin, Legal, NotFound…
│       │   └── services/      # Servizi singleton (signal + HttpClient)
│       ├── server.ts          # Server SSR, fa anche da proxy verso /api e /uploads
│       └── styles.css         # Design system
├── server-java/               # Backend Spring Boot  ← il backend in uso
│   └── src/
│       ├── main/java/it/commonera/backend/
│       │   ├── config/        # SecurityConfig, WebConfig, PaymentConfig, AdminBootstrap
│       │   ├── controllers/   # Un controller per area
│       │   ├── dtos/ entities/ repositories/ services/
│       │   ├── exceptions/    # ApiException + handler globale
│       │   └── security/      # JwtCookieFilter, JwtService, AuthCookie
│       └── test/              # Test di integrazione con Testcontainers
├── server/                    # Backend NestJS dismesso, riferimento storico
├── database/init/             # 001_schema.sql (lo schema) + 002_seed_data.sql
├── docs/                      # Documentazione tecnica dettagliata
├── .github/workflows/test.yml # CI
└── docker-compose.yml
```

Documentazione tecnica approfondita: [`docs/`](docs/README.md).
Cosa manca ancora: [`docs/11-what-is-missing.md`](docs/11-what-is-missing.md).

---

## Crediti

Creato da:
- [Giacomo Masiero](https://www.gmasiero.it)
- [Alessio Ferrari](https://github.com/AlessioFerrari8)
- [Amedeo Azzetti](https://github.com/amedeoazzetti)
