# Frontend — Services

All services are in `e-commerce/src/app/services/` and are provided in the root injector (`providedIn: 'root'`), meaning a single instance is shared across the entire application.

---

## AuthService — auth.ts

The central auth service. Every part of the app that needs to know who is logged in reads from this service.

### State

Four signals are exposed:

- `currentUser` — `Signal<AuthUser | null>`. Null means not logged in or not yet checked.
- `isAuthenticated` — `computed(() => currentUser() !== null)`.
- `isAdmin` — `computed(() => currentUser()?.role === 'admin')`.
- `isLoading` — `Signal<boolean>`. True during the initial `GET /auth/me` check. Used by the auth guard to wait before deciding whether to redirect.

### Initialisation

The constructor calls `checkAuth()` only when running in the browser (`isPlatformBrowser`). On the server it just sets `isLoading` to false and leaves `currentUser` as null. `checkAuth` calls `GET /auth/me` with credentials and sets the user signal from the response.

### Methods

**login(payload)** — posts to `/auth/login`, sets the `currentUser` signal from the response. Throws on error — the caller handles it.

**register(payload)** — posts to `/auth/register`. Does not set any state because registration does not log the user in automatically.

**logout()** — posts to `/auth/logout` to delete the session, clears `currentUser` to null, navigates to `/home`. The `finally` block ensures state is cleared even if the logout request fails.

**updateProfile(payload)** — patches `/users/me` and updates the `currentUser` signal with the returned user data. This keeps the navbar and profile page in sync without a page reload.

**sendVerificationEmail() / confirmVerification(token) / changePassword() / requestEmailChange()** — thin wrappers that call the corresponding user endpoints and return the server's message string.

**extractErrorMessage(err)** — a utility used by components to get a human-readable string from an `HttpErrorResponse`. Handles array messages from class-validator (joins them with `. `), connection errors, and rate limiting.

---

## ProductsService — products.service.ts

Handles all product-related API calls. Stateless — no signals.

### Interfaces exported from this file

`ProductImage`, `ProductVariant`, `ProductDiscount`, `ProductCategory`, `ProductListItem`, `ProductFull` (extends `ProductListItem` with `description`), `ProductFilters`, `ProductsResponse`, `GetProductsParams`.

These interfaces are used by multiple components across the app, so they live in the service file rather than a separate interfaces directory (which contains older and partially redundant interfaces from an earlier iteration).

### Methods

**getProducts(params)** — builds `HttpParams` incrementally from the provided `GetProductsParams` object. Array params (`colors`, `sizes`) are appended multiple times using `p.append()`. Returns an Observable of `ProductsResponse`.

**getFilters()** — calls `GET /products/filters`. Returns an Observable of `ProductFilters`.

**getProductBySlug(slug)** — calls `GET /products/:slug`. Returns an Observable of `{ product: ProductFull; related: ProductListItem[] }`.

These methods return Observables rather than Promises because the Products page needs to subscribe and re-call on filter changes without the overhead of converting.

---

## WishlistService — wishlist.service.ts

Manages the user's saved items. Has a small amount of client-side state.

### State

- `savedIds` — `Signal<Set<string>>`. The set of product IDs currently saved. Used on listing pages to render filled or empty heart icons without fetching full item data.
- `items` — `Signal<WishlistItem[]>`. The full list with product data, loaded separately when needed (e.g. on the `/me` page).
- `_loaded` — a private boolean flag that prevents loading IDs twice.

### Methods

**loadIds()** — calls `GET /wishlist/ids` if not already loaded. Sets the `savedIds` signal.

**loadItems()** — calls `GET /wishlist` with full product data. Updates both `items` and `savedIds` from the response.

**isSaved(productId)** — synchronous, reads from the `savedIds` signal. Used in templates.

**toggle(productId)** — calls `POST /wishlist/:productId/toggle`. Updates `savedIds` based on the response. If removed, also filters the product out of `items` if that list is loaded.

**reset()** — clears all state. Called by the logout flow to avoid showing stale wishlist data after a new user logs in.

---

## CartService — cart-service.ts

Gestisce il carrello lato client (nessun endpoint carrello sul backend — il carrello viene inviato al backend solo al momento del checkout).

### Interfacce

`CartItem` — `{ variantId, productId, productName, slug, variantLabel, size, color, colorHex, imageUrl, unitPrice, originalPrice, quantity }`.

`AddressData` — struttura degli indirizzi di spedizione, condivisa con il Checkout.

### State

- `items` — `Signal<CartItem[]>`.
- `isOpen` — `Signal<boolean>`.
- `itemCount` — `computed` che somma le quantità.
- `subtotal` — `computed` che somma `unitPrice * quantity`.

### Methods

`open()`, `close()`, `toggle()` — gestiscono il drawer.

`addItem(item)` — se il variantId esiste già incrementa la quantità, altrimenti aggiunge.

`removeItem(variantId)`, `updateQuantity(variantId, qty)`, `clear()`.

`getAddresses()` — chiama `GET /addresses` e restituisce una Promise.

`placeOrder(payload)` — chiama `POST /checkout` e svuota il carrello al successo.

**Nota:** il carrello è in-memory. Non viene persistito in localStorage — si azzera al ricaricamento della pagina.
