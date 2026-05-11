# Common Era — E-commerce

Progetto di fine secondo quadrimestre realizzato con Angular 21, NestJS 11 e PostgreSQL 16.

## Scadenze

| Data | Consegna |
|------|----------|
| 02/03/2026 | Canva + nome + descrizione + API + schema colore + Figma |
| 13/04/2026 | Versione 0.1 — servizi e componenti principali |
| **11/05/2026** | **Consegna finale + presentazione** |

## Avvio rapido

Tutto gira in Docker. Dalla root del repository:

```bash
docker compose up -d
```

- Frontend: http://localhost:4200
- Backend API: http://localhost:3000

Per popolare il database con dati di test:

```bash
bash database/seed.sh
```

Credenziali admin di default dopo il seed: `admin@commonera.it` / `Admin1234!`

---

## Criteri obbligatori del progetto

### 1. Multi-componente

L'applicazione è suddivisa in componenti Angular **standalone** riutilizzabili:

| Componente | Percorso | Ruolo |
|-----------|----------|-------|
| `NavBar` | `components/nav-bar/` | Barra di navigazione con scroll hide/show, badge carrello, avatar utente |
| `Cart` | `components/cart/` | Drawer carrello laterale con lista item, quantità, subtotale |
| `SearchBar` | `components/search-bar/` | Barra di ricerca con navigazione a `/products?q=...` |
| `Footer` | `components/footer/` | Footer statico con link a pagine legali |
| `Skeleton` | `components/skeleton/` | Placeholder di caricamento animato |
| `Breadcrumb` | `components/breadcrumb/` | Navigazione gerarchica nelle pagine prodotto |
| `Toast` | `components/toast/` | Notifiche temporanee a scomparsa |

Ogni pagina è a sua volta un componente standalone: `Home`, `Products`, `ProductDetail`, `MeComponent`, `Login`, `Register`, `Checkout`, `Admin`, `AdminDashboard`, `AdminProducts`, `AdminOrders`, `AdminUsers`, `AdminPromo`, `AdminReviews`, `AdminReturns`, `ForgotPassword`, `ResetPassword`, `VerifyEmail`, `Legal`.

---

### 2. Routing

La tabella delle route è definita in [`e-commerce/src/app/app.routes.ts`](e-commerce/src/app/app.routes.ts):

| Path | Componente | Guard |
|------|-----------|-------|
| `/home` | `Home` | — |
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

Le route `/admin/*` usano la struttura **parent/children**: `Admin` è il layout con sidebar, i figli renderizzano il contenuto via `<router-outlet>`. La navigazione usa `routerLink` e `routerLinkActive`.

---

### 3. API

Il backend espone oltre 30 endpoint REST. Tutti passano per il prefisso `/api`. Esempi principali:

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
- `GET /api/addresses`, `POST /api/addresses`, `PATCH /api/addresses/:id/default`, `DELETE /api/addresses/:id`

**Admin** (solo ruolo `admin`)
- `GET /api/admin/stats` — dashboard KPI (ricavi, ordini, utenti, prodotti)
- `GET /api/admin/orders`, `PATCH /api/admin/orders/:id/status`
- `GET /api/admin/users`, `PATCH /api/admin/users/:id`
- `POST /api/admin/products`, `PATCH /api/admin/products/:id`, `DELETE /api/admin/products/:id`
- `GET /api/admin/promo`, `POST /api/admin/promo`
- `GET /api/admin/reviews`, `PATCH /api/admin/reviews/:id`
- `GET /api/admin/returns`, `PATCH /api/admin/returns/:id`

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
| `CartService` | `cart-service.ts` | Segnale `items`, `itemCount`, `subtotal`, `addItem`, `removeItem`, `updateQuantity`, `placeOrder()` |
| `AdminService` | `admin.service.ts` | `getStats()` e operazioni CRUD per la dashboard admin |
| `ReviewsService` | `reviews.service.ts` | `getByProduct()`, `create()` |
| `UsersService` | `users-service.ts` | Aggiornamento profilo, cambio password/email |
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
| Frontend | Angular 21 (standalone components, SSR con Angular Universal) |
| Stile | Tailwind CSS 4 |
| Backend | NestJS 11 |
| ORM | Prisma 7 |
| Database | PostgreSQL 16 |
| Auth | JWT in cookie HttpOnly + tabella `sessions` (revoca reale) |
| Email | Resend (benvenuto, verifica email, reset password, alert cambio password) |
| Infrastruttura | Docker Compose (3 servizi: frontend, backend, db) |

---

## Struttura del repository

```
├── e-commerce/          # Frontend Angular
│   └── src/app/
│       ├── components/  # Componenti condivisi (NavBar, Cart, SearchBar, …)
│       ├── guards/      # authGuardGuard, adminGuardGuard
│       ├── pages/       # Pagine (Home, Products, Admin, …)
│       └── services/    # Servizi singleton
├── server/              # Backend NestJS
│   └── src/
│       ├── auth/        # Login, logout, sessioni, JWT
│       ├── products/    # Catalogo prodotti
│       ├── orders/      # Ordini e checkout
│       ├── users/       # Profilo, indirizzi, cambio email/password
│       ├── admin/       # Endpoint admin
│       └── prisma/      # Schema e client Prisma
├── database/
│   └── seed.sh          # Dati di test
├── docs/                # Documentazione tecnica dettagliata
└── docker-compose.yml
```

Documentazione tecnica approfondita: [`docs/`](docs/README.md)

---

## Crediti

Creato da:
- [Giacomo Masiero](https://www.gmasiero.it)
- [Alessio Ferrari](https://github.com/AlessioFerrari8)
- [Amedeo Azzetti](https://github.com/amedeoazzetti)
