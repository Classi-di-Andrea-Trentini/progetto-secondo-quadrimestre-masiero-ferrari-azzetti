# Frontend — le pagine

`e-commerce/src/app/pages/`. Una cartella per pagina, con `.ts`, `.html` e — quando
serve — `.css` di componente.

## La tabella delle rotte

Da `app.routes.ts`:

| Percorso | Componente | Guardia |
|---|---|---|
| `/` | redirect a `/home` | — |
| `/home` | `Home` | — |
| `/about` | `About` | — |
| `/products` | `Products` | — |
| `/product/:slug` | `ProductDetail` | — |
| `/login` | `Login` | — |
| `/register` | `Register` | — |
| `/forgot-password` | `ForgotPassword` | — |
| `/reset-password` | `ResetPassword` | — |
| `/verify-email/:token` | `VerifyEmail` | — |
| `/legal/:pagina` | `Legal` | — |
| `/me` | `MeComponent` | `authGuardGuard` |
| `/checkout` | `Checkout` | `authGuardGuard` |
| `/admin` → `dashboard`, `products`, `orders`, `users`, `promo`, `reviews`, `returns` | `Admin` + figli | `adminGuardGuard` |
| `**` | `NotFound` | — |

`/about` era importato ma la rotta non era mai stata registrata: il link "About us"
nella barra cadeva nel jolly e riportava alla home.

## Home

Prodotti in evidenza, un carosello di collezioni con navigazione a frecce e
puntini, e una vetrina di promozioni. Le illustrazioni vengono da
`public/media/catalogo/`, non piu' da URL Unsplash cablati nel codice.

## Products — catalogo

Filtri per categoria, marca, colore, taglia e fascia di prezzo, ordinamento e
paginazione, tutti riflessi nei parametri dell'URL (cosi' un filtro si puo'
condividere con un link). Legge anche `?q=` e lo passa al backend come `search`.

> Nessun componente scrive `?q=`: **la casella di ricerca non esiste**. Vedi
> [11-what-is-missing.md](./11-what-is-missing.md).

## ProductDetail — scheda prodotto

Galleria immagini per colore selezionato, scelta di colore e taglia, prezzo
calcolato sulla variante scelta, disponibilita', recensioni, prodotti correlati,
"visti di recente", breadcrumb, e la sezione a fisarmonica con spedizioni e resi.

Quando la variante scelta e' esaurita compare l'iscrizione all'avviso "torna
disponibile" (`POST /stock-alerts`).

`SeoService.setProduct()` scrive qui il JSON-LD con prezzo e disponibilita': e' la
pagina che porta traffico dai motori di ricerca, ed e' resa lato server apposta.

## Checkout

Passi: `address` → `shipping` → `review`. Indirizzo esistente o nuovo, metodo di
spedizione (standard/express, gratis sopra 100 €), codice promo, **gift card** e
punti fedelta', riepilogo e conferma.

> **Non c'e' un passo di pagamento**, e il riquadro in fondo dichiara per iscritto
> che il pagamento e' simulato.

## Me — area personale

Cinque schede (`TabSection`): `profile`, `orders`, `favorites`, `addresses`,
`settings`. Il contenuto di ciascuna si carica alla prima apertura, non tutto
all'ingresso.

In `settings` ci sono cambio password, cambio email, **export dei propri dati** e
**cancellazione dell'account** (i due diritti GDPR). In `orders` ci sono lo storico,
la fattura in PDF, l'annullamento e la richiesta di reso.

> Il pulsante "imposta come indirizzo predefinito" chiama
> `PATCH /api/addresses/{id}/default`, mentre il backend espone `/set-default`:
> risponde 404.

## Legal

Una sola pagina parametrica su cinque chiavi: `privacy`, `cookies`, `terms`,
`recesso`, `spedizioni-e-resi`. Tutte in italiano.

`recesso` e `spedizioni-e-resi` sono obbligatorie per vendere online in UE (artt. 49
e 52 del Codice del consumo) e prima non esistevano. I dati aziendali sono
segnaposto **voluti** (`[RAGIONE SOCIALE]`, `[P.IVA]`, `[SEDE LEGALE]`, `[PEC]`,
`[REA]`): inventare una partita IVA per far sembrare completa una pagina e' peggio
di un buco evidente.

Una chiave sconosciuta mostra una 404 dentro la pagina, e non ricade piu' su
`privacy`: prima `/legal/qualsiasi-cosa` serviva l'informativa privacy con stato
200, cioe' contenuto duplicato per i motori di ricerca e un documento che nessuno
aveva chiesto per le persone.

## NotFound — la 404

Jolly delle rotte, con **stato HTTP 404 vero** (`app.routes.server.ts`). Mostra
l'indirizzo richiesto, due bottoni del design system verso catalogo e home, e un
elenco di pagine da cui ripartire. Chiede ai motori di ricerca di non indicizzarla.

Prima il jolly faceva `redirectTo: 'home'`.

## Accesso, registrazione, password, verifica email

`Login`, `Register`, `ForgotPassword`, `ResetPassword`, `VerifyEmail`. Reactive
Forms con validatori, fra cui `passwordComplexity` (maiuscola + minuscola + cifra) e
`passwordMatch` a livello di gruppo.

## Admin

`Admin` e' il guscio con la barra laterale richiudibile; i figli si rendono in
`<router-outlet>`. Pagine: dashboard (KPI, grafico, ordini recenti), prodotti,
ordini, utenti, promo, recensioni, resi.

Il backend espone anche magazzino e gift card, che **non hanno nessuna schermata**.
