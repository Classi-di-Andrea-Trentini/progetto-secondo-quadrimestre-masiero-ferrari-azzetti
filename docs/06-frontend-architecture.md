# Frontend — architettura

Angular 21, in `e-commerce/`. Tutti i componenti sono **standalone**: nel codice
dell'applicazione non esiste un solo `NgModule`. Si usa la sintassi di controllo
nuova (`@if`, `@for`, `@switch`) e lo stato si tiene nei **signal**.

## Comandi

```bash
cd e-commerce
npm ci
npm start        # ng serve (proxy verso il backend: proxy.conf.json)
npm run start:local   # ng serve con proxy.conf.local.json, per il backend fuori Docker
npm run build    # build di produzione + prerender
npm test         # Vitest su jsdom
```

## L'URL dell'API sta in un posto solo

`services/api.config.ts` esporta `API_URL`, e nessun servizio scrive un indirizzo a
mano.

- **Nel browser** vale `/api`: relativo, stessa origine. Il dev server di Angular e
  il server SSR inoltrano quel percorso al backend, e cosi' non esistono problemi di
  CORS, di cookie cross-site, ne' di visibilita' delle porte su Codespaces.
- **In SSR** `window` non esiste e non si passa per il proxy, quindi si va dritti al
  backend: `BACKEND_URL` se c'e', altrimenti `http://backend:3000/api`, che e' il
  nome del servizio nella rete di Compose.

## SSR: una scelta per rotta

`angular.json` ha `outputMode: "server"`, e `app.routes.server.ts` decide come viene
resa ogni rotta. Il criterio e' uno solo — **chi deve leggere questa pagina?**

| Rotta | Modo | Perche' |
|---|---|---|
| `/`, `/home`, `/about` | Prerender (SSG) | uguali per tutti e cambiano di rado |
| `/legal/:pagina` | Prerender (SSG) | cinque pagine fisse, elenco noto in anticipo |
| `/products` | Server (SSR) | il catalogo cambia e va indicizzato |
| `/product/:slug` | Server (SSR) | prezzo e disponibilita' devono essere freschi |
| login, registrazione, recupero password | Client (SPA) | niente da indicizzare |
| `/me`, `/checkout`, `/admin/**` | Client (SPA) | sul server non c'e' nessun utente da rendere |
| `**` (404) | Server, **`status: 404`** | pubblica, e deve rispondere col codice giusto |

La regola dietro la tabella: **SSG se il contenuto e' uguale per tutti e stabile,
SSR se e' pubblico ma cambia, SPA se e' privato.**

Le pagine legali si prerenderizzano leggendo `LEGAL_KEYS` e non un elenco riscritto
a mano: la copia precedente si era gia' fermata a tre pagine, e una pagina legale
che esiste nell'applicazione ma non viene generata resta invisibile ai motori di
ricerca proprio mentre la legge impone di pubblicarla.

## Il jolly e la 404

`{ path: '**', component: NotFound }` in `app.routes.ts`, con `status: 404` sulla
rotta server. Prima faceva `redirectTo: 'home'`: un indirizzo sbagliato finiva in
home **con stato 200**, quindi chi aveva sbagliato a scrivere non se ne accorgeva e
un motore di ricerca considerava valido qualunque URL inventato.

Lo stato HTTP si puo' scegliere **solo** in `app.routes.server.ts`: dal componente
non si arriva alla risposta.

## Guardie

`guards/auth-guard-guard.ts` (su `/me` e `/checkout`) e
`guards/admin-guard-guard.ts` (su `/admin/**`).

Entrambe controllano `isPlatformBrowser` e **lasciano passare sul server**: durante
l'idratazione SSR non c'e' nessun utente da leggere, e una guardia che redirige li'
innesca un ciclo. `authGuardGuard` aspetta inoltre che `AuthService.isLoading()`
sia `false`, altrimenti manderebbe al login chiunque ricarichi la pagina prima che
`/auth/me` abbia risposto.

## Stato con i signal

Niente `BehaviorSubject`, niente `EventEmitter` per lo stato condiviso: i servizi
espongono `signal()` in sola lettura e `computed()`, i componenti li leggono e si
aggiornano da soli.

```ts
readonly currentUser = this._currentUser.asReadonly();
readonly isAuthenticated = computed(() => this._currentUser() !== null);
readonly isAdmin = computed(() => this._currentUser()?.role === 'admin');
```

Gli `HttpClient` che restituiscono `Observable` vengono consumati con
`firstValueFrom` dove il servizio espone metodi `async`.

## Design system — `src/styles.css`

Monocromo editoriale: **una rampa d'inchiostro**, un accento usato sotto il 10%
della superficie, colori semantici per gli stati. Tutti i colori sono in **OKLCH**,
con il contrasto misurato: `--color-ink-muted` sta a 4,81:1 su `paper` ed e' il
pavimento — sotto quello non si scende per il testo.

Il vocabolario di classi si usa cosi' com'e':

| Classe | Cosa |
|---|---|
| `.btn` + `.btn-primary` / `.btn-outline` / `.btn-ghost` / `.btn-danger`, con `.btn-sm` / `.btn-lg` / `.btn-block` | i bottoni, con tutti gli stati (hover, focus, disabilitato, `data-loading`) |
| `.field`, `.field-error`, `.field-hint` | i campi |
| `.badge` + varianti | le etichette di stato |
| `.display` | i titoli editoriali (serif) |
| `.rule`, `.measure`, `.auto-grid`, `.empty` | filetto, colonna di testo a 68ch, griglia prodotti, stato vuoto |
| `.z-sticky`, `.z-drawer`, `.z-modal`, `.z-toast`, … | scala di `z-index` semantica, al posto dei 90/100/9999 sparsi |

**Ricostruire un bottone con le utility Tailwind e' un errore**: si perdono focus,
stato disabilitato e indicatore di caricamento, e la pagina diverge dal resto del
sito alla prima modifica dei token.
