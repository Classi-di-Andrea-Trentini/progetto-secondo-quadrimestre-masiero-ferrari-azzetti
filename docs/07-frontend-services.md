# Frontend — i servizi

`e-commerce/src/app/services/`. Tutti `providedIn: 'root'`, quindi singleton
condivisi. Nessuno scrive un URL a mano: usano `API_URL` da `api.config.ts`.

| File | Classe | Responsabilita' |
|---|---|---|
| `api.config.ts` | — | `API_URL`: `/api` nel browser, indirizzo diretto in SSR |
| `auth.ts` | `AuthService` | accesso, registrazione, profilo, verifica email, cancellazione account |
| `cart-service.ts` | `CartService` | il carrello, ospite e collegato, piu' indirizzi/promo/gift card del checkout |
| `products.service.ts` | `ProductsService` | catalogo, filtri, scheda per slug |
| `wishlist.service.ts` | `WishlistService` | preferiti |
| `reviews.service.ts` | `ReviewsService` | recensioni di un prodotto |
| `admin.service.ts` | `AdminService` | tutte le chiamate del pannello |
| `cookie-consent.ts` | `CookieConsentService` | l'informativa cookie |
| `recently-viewed.ts` | `RecentlyViewedService` | i prodotti guardati di recente |
| `seo.ts` | `SeoService` | titolo, meta tag, dati strutturati |
| `toast.service.ts` | `ToastService` | notifiche temporanee |
| `users-service.ts` | `UsersService` | **vuota**: una classe senza un solo metodo |

## `AuthService`

Segnali: `currentUser`, `isAuthenticated`, `isAdmin`, `isLoading`.

`isLoading` non e' un dettaglio: all'avvio il servizio chiama `/auth/me`, e finche'
quella risposta non arriva nessuno puo' dire se c'e' un utente. Le guardie e il
carrello lo aspettano — senza, chi ricarica `/me` verrebbe sbattuto al login.

Metodi: `login`, `register`, `logout`, `updateProfile`, `sendVerificationEmail`,
`confirmVerification`, `changePassword`, `requestEmailChange`, `eraseAccount`,
`extractErrorMessage`.

Tutte le chiamate viaggiano con `withCredentials: true`: l'autenticazione e' un
cookie, non un header.

## `CartService`

Segnali: `items`, `itemCount`, `subtotal`, `isOpen`, `isSyncing`, `hasIssues`,
`ready`.

### Dove vive il carrello

- **Da ospite**: in `localStorage`. Prima stava solo in memoria e bastava un
  aggiornamento della pagina per perderlo.
- **Da collegato**: sul server (`carts`/`cart_items`), cosi' segue l'utente fra
  telefono e computer.
- **Al login i due vengono fusi** (`POST /cart/merge`). Senza, chi riempie il
  carrello e poi accede se lo ritrova vuoto: il modo piu' diretto per perdere una
  vendita.

La fusione non puo' avvenire nel costruttore, perche' `isAuthenticated` diventa
vero solo dopo la risposta di `/auth/me`: serve un `effect` che reagisca al
cambiamento.

### `ready`

Falso finche' il carrello non e' stato caricato almeno una volta. Da quando il
carrello vive sul server arriva **dopo** il primo render, e il checkout che
controllava subito `items().length === 0` rimbalzava sul catalogo anche col
carrello pieno. Per un ospite `isAuthenticated` resta falso dall'inizio alla fine:
il ramo che dichiara pronto quando l'autenticazione si conclude senza cambiare
identita' e' l'unico che lo salva dal restare in eterno sullo scheletro.

### Il resto del checkout

`getAddresses`, `createAddress`, `validatePromo`, `checkGiftCard` stanno qui
dentro. Il servizio copre quindi anche la parte "dati per concludere l'ordine", non
solo le righe del carrello.

## `ProductsService`

`getProducts(params)` con filtri, `getFilters()`, `getProductBySlug(slug)`. Le
risposte sono tipizzate nel file stesso, con `basePrice: number`.

## `WishlistService`

`savedIds` e' un `Set` di id: serve ad accendere i cuoricini sulla griglia senza
scaricare i prodotti interi. `items` e' la lista completa, usata in `/me`.
`toggle` e' ottimistico e `reset` va chiamato al logout.

## `CookieConsentService`

**Non e' un banner di consenso, e' un'informativa.** Il negozio usa solo cookie
tecnici — il cookie di sessione, la riga che ricorda che l'avviso e' stato letto, e
i cookie antifrode di Stripe sulla pagina di pagamento. Per i cookie tecnici la
direttiva ePrivacy (art. 5 § 3, e l'art. 122 del Codice privacy) **non chiede il
consenso**: chiede di informare.

Per questo non c'e' un pulsante "Rifiuta". Quello di prima era peggio della sua
assenza: `decline()` e `acceptAll()` scrivevano la stessa identica cosa in
`localStorage` e cambiava solo un flag che nessuno leggeva.

`acknowledge()` chiude l'avviso, `reopen()` lo riapre — ed e' il link "Gestisci
cookie" nel footer a chiamarlo. Lo stato sta in un servizio e non nel componente
proprio perche' a disegnarlo e' `App` e a riaprirlo e' il footer.

Il giorno in cui entrasse un cookie non tecnico, questo servizio va rifatto come
consenso vero: due pulsanti che fanno due cose diverse e granularita' per categoria.

## `RecentlyViewedService`

La cronologia sta nel `localStorage` (al massimo 10 voci) e non sul server: e' una
comodita', non un dato da legare a un account, e cosi' funziona anche da sloggati —
che e' proprio quando serve di piu'. Al server si chiedono solo i dati aggiornati
(`GET /products/by-ids`), perche' prezzo e disponibilita' possono essere cambiati.

## `SeoService`

`setPage(title, description, image?, url?)` scrive titolo, `description`, Open
Graph e Twitter card. `setProduct()` aggiunge il JSON-LD `Product`, che e' quello
che permette a un motore di ricerca di mostrare prezzo e disponibilita' nei
risultati.

Va chiamato **durante** la resa, non dal browser dopo: il sito e' reso lato server
proprio perche' questi tag arrivino gia' nell'HTML.

## `UsersService` — da togliere o da riempire

`users-service.ts` contiene una classe vuota. Le chiamate del profilo stanno dentro
`AuthService` e dentro `me.ts`. Vedi [11-what-is-missing.md](./11-what-is-missing.md).
