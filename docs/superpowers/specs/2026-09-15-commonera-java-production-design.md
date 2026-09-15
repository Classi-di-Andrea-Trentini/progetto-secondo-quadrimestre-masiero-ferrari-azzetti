# Common Era (backend Java) — da progetto scolastico a negozio production-grade

Data: 2026-09-15
Stato: approvato, da implementare
Repo: `progetto-secondo-quadrimestre-masiero-ferrari-azzetti-java`, branch `main` (push disabilitato, copia locale)

## Obiettivo

Portare il negozio allo stato **"production-grade, chiavi dopo"**: tutto costruito,
cablato e verificato senza account reali. Il giorno in cui si vuole vendere davvero si
incollano le chiavi Stripe di produzione, le credenziali SMTP e un dominio, e il negozio
e' online. Nessuna parte del lavoro deve restare in attesa di una decisione dell'utente.

Non e' in questo spec: aprire davvero un'attivita' (P.IVA, contratto col corriere,
registrazione fiscale). Lo spec prepara il software, non l'impresa.

## Stato di partenza verificato (2026-09-15)

- Backend Java `server-java` (Spring Boot 4.1, Java 21), unico backend in `docker-compose.yml`.
  `server/` (NestJS) resta nel repo come riferimento, fuori dal compose.
- 59 test backend (Testcontainers + Postgres reale), 20 test frontend (di cui **18 smoke
  generati dallo schematic**).
- `main` e' 68 commit avanti su origin. `git status` pulito.
- Maven Central raggiungibile a ~800 KB/s: il fallimento di `docker compose build backend`
  del 2026-08-27 era rete transitoria, non un difetto del Dockerfile.

### Correzioni allo stato che il vault e `docs/` riportavano male

`docs/11-what-is-missing.md` e tutta `docs/` descrivono il backend **Node**, dismesso.
Tre affermazioni risultavano false:

| Creduto mancante | Realta' |
|---|---|
| Carrello non persistente | Persistente: `localStorage` da ospite, server-side da loggato, merge al login (`cart-service.ts`) |
| Nessun cookie banner | Esiste (`app.ts` + `app.html`), con pannello "Customize" |
| Gift card assenti dal frontend | Presenti nel checkout, insieme a promo e punti fedelta' |

## Blocco 1 — Pagamenti reali (Stripe, test mode)

### Il problema

`CheckoutService.placeOrder` e' **una sola `@Transactional`** di 14 passi che si affida al
rollback per compensare (scarico giacenza, riscatto gift card, riscatto punti). Una
chiamata HTTP a Stripe dentro questa transazione:

1. tiene aperta una connessione di database per tutta la latenza di rete;
2. se Stripe risponde dopo un rollback, **incassa denaro per un ordine che non esiste**.

### La soluzione: tre fasi

**Fase A — `POST /checkout`** (transazione 1)
Valida indirizzo e righe, calcola prezzi/promo/spedizione come oggi, poi:
- crea `orders` in stato `pending`;
- **riserva la giacenza** (`ProductVariantRepository.decrementStock`, gia' condizionale e
  anti-oversell): la riserva avviene qui, non al webhook, perche' altrimenti due clienti
  possono comprare lo stesso pezzo mentre pagano;
- riscatta gift card e punti (gia' UPDATE condizionali);
- crea il `Payment` in stato `pending` con `provider = "stripe"` e
  `provider_tx_id = <PaymentIntent id>`;
- risponde `{ orderId, clientSecret, amountToPay }`.

La `PaymentIntent` viene creata **prima** di aprire la transazione, e il suo id passato
dentro: la chiamata di rete resta fuori dalla transazione. Se la transazione fallisce dopo
che la PaymentIntent esiste, la si annulla (`paymentIntents.cancel`) nel blocco di
compensazione; se anche quello fallisce, l'intent scade da solo e il reaper (sotto) ripulisce.

**Fase B — webhook `payment_intent.succeeded`** (transazione 2)
- ordine `pending` → `paid` tramite `OrderRepository.updateStatusIfCurrentIn` (transizione
  atomica gia' esistente);
- `Payment` → `succeeded`, `paid_at`, `provider_payload` = evento grezzo;
- assegna i punti fedelta' (`LoyaltyService.award`);
- svuota il carrello lato server;
- **manda l'email di conferma d'ordine**, che oggi non esiste in nessuna forma.

**Idempotenza**: `payments.provider_tx_id` e' `UNIQUE` nello schema. Stripe ripete gli
eventi; il vincolo di database e' la difesa, non un `if` applicativo. Un secondo evento
sullo stesso intent trova l'ordine gia' fuori da `pending` e non fa nulla.

**Fase C — fallimento / abbandono**
- webhook `payment_intent.payment_failed` o `.canceled` → rilascia la giacenza, restituisce
  gift card e punti, ordine → `cancelled`, `Payment` → `failed` con `failed_reason`;
- **job periodico** (`@Scheduled`, ogni 5 minuti): ordini `pending` piu' vecchi di 30 minuti
  vengono annullati con le stesse compensazioni. Senza questo, una riserva abbandonata
  blocca la merce per sempre. Oggi non esiste niente del genere.

La compensazione e' **una sola funzione** (`CheckoutCompensationService`) usata da C e dal
reaper, cosi' non esistono due implementazioni che possono divergere.

### Schema

**Nessuna migrazione.** La tabella `payments` ha gia' `provider`, `provider_tx_id TEXT
UNIQUE`, `provider_payload JSONB`, `refunded_amount`. L'entity `Payment.java` ne mappa tre
su sette: si aggiungono i campi mancanti. (`ddl-auto=validate` controlla le colonne
dichiarate, non il contrario — stessa scappatoia gia' usata per `sessions.ip_address`.)

### Rimborsi

- `OrderService.cancel` e `ReturnService.updateStatus` creano un **Refund Stripe** reale e
  scrivono `refunded_amount` + stato `refunded`/`partially_refunded` su `payments`. Oggi il
  codice restituisce gift card e punti ma **non scrive mai una riga di rimborso**.

### Sicurezza del webhook

Endpoint `POST /payments/webhook`, aggiunto ai `permitAll` di `SecurityConfig` (oggi
`anyRequest().authenticated()` lo bloccherebbe). Verifica obbligatoria della firma
(`Stripe-Signature`, `STRIPE_WEBHOOK_SECRET`): senza firma valida, 400 e nessun effetto.
Escluso da CORS. Il corpo grezzo va letto prima di qualunque deserializzazione, altrimenti
la firma non torna.

### Frontend

- quarto passo `payment` nell'union `CheckoutStep`, fra `shipping` e `review`;
- Stripe Elements (`@stripe/stripe-js`), chiave pubblicabile da variabile d'ambiente;
- se `amountToPay()` e' 0 (gift card che copre tutto) il passo si salta e si va dritti a
  `review`, che conferma senza incasso;
- rimossa la nota "Il pagamento e' simulato" da `checkout.html`.

### Configurazione

`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`. Se **non** sono
impostate, il backend parte lo stesso e il checkout usa il percorso simulato di oggi,
dichiarandolo in un log di avvio. Cosi' il progetto scolastico continua a funzionare senza
chiavi, e il negozio vero si accende riempiendo tre variabili.

## Blocco 2 — Deploy: nginx, TLS, rete

- Servizio `nginx` nel compose, unica origine pubblica (`:80`/`:443`): serve il frontend e
  inoltra `/api` e `/uploads` al backend. Il proxy dentro `src/server.ts` resta per lo
  sviluppo fuori Docker.
- **Due reti**: `edge` (nginx + frontend + backend) e `internal` (backend + db). La porta
  `5433` del database **non e' piu' esposta sull'host** — oggi Postgres e' raggiungibile
  dall'esterno del bridge.
- `COOKIE_SECURE=true` e `TRUST_PROXY=1` diventano accendibili, e vanno accesi nel profilo
  di produzione.
- TLS: configurazione pronta per Let's Encrypt (`certbot` webroot), piu' uno script che
  genera un certificato self-signed per provare l'intera catena in locale.
- Security headers in nginx: HSTS, `X-Content-Type-Options`, `Referrer-Policy`,
  `X-Frame-Options`, e una **CSP** compatibile con Stripe Elements (che richiede
  `js.stripe.com` e un frame).
- Due file compose: quello di sviluppo resta com'e' (porte aperte, niente TLS);
  `docker-compose.prod.yml` aggiunge nginx, chiude le porte e accende i flag.

## Blocco 3 — Sicurezza

1. **Rate limiting oltre il login.** Oggi e' protetto **solo** `POST /auth/login`
   (`LoginRateLimiterService`, in memoria, chiave = email). Si generalizza a un filtro con
   politiche per rotta: registrazione, `forgot-password`, `checkout`, `reviews`, e un tetto
   globale per IP. Chiave per IP **e** per identita' dove ha senso.
2. **Transizioni di stato ordine validate.** `AdminService.updateOrderStatus` non usa la
   transizione atomica ne' controlla la legittimita': un admin puo' portare un ordine
   `cancelled` a `delivered` senza nessuna compensazione su giacenza, punti e buono. Si
   introduce una macchina a stati esplicita con le transizioni ammesse.
3. **Rimborsi registrati** su `payments` (vedi Blocco 1).
4. **Firma del webhook** verificata (vedi Blocco 1).
5. Revisione finale con il sottoagente di security review sul percorso soldi, come gia'
   fatto il 2026-08-26.

## Blocco 4 — Legale e GDPR

Testi **in italiano**, struttura corretta, dati aziendali come segnaposto evidenti
(`[RAGIONE SOCIALE]`, `[P.IVA]`, `[SEDE]`, `[PEC]`, `[REA]`). Non si inventano dati di
un'azienda che non esiste.

Pagine (tutte sotto `/legal/:pagina`, oggi tre e in inglese):
- `privacy` — riscritta: titolare, base giuridica, categorie di dati, destinatari,
  conservazione, diritti dell'interessato, reclamo al Garante;
- `cookies` — la piu' curata gia' oggi, tradotta e aggiornata coi cookie Stripe;
- `terms` — condizioni generali, che oggi dicono *"non-commercial school demo"*;
- **`recesso`** (nuova) — diritto di recesso a 14 giorni, modulo tipo, obbligatoria per
  vendere online in UE;
- **`spedizioni-e-resi`** (nuova) — tempi, costi, procedura di reso.

Piu':
- banner cookie **in italiano**, riapribile da un link "Gestisci cookie" nel footer (oggi
  la scelta e' definitiva e non c'e' modo di tornarci);
- `decline()` e `acceptAll()` devono avere effetti distinti, o il rifiuto va tolto: oggi
  salvano entrambi `essential: true` e cambia solo un flag;
- **export dei propri dati** e **cancellazione dell'account** in `/me` → impostazioni. Il
  GDPR li richiede e oggi non esistono. La cancellazione e' logica (`users.deleted_at`, gia'
  nello schema) perche' `orders.user_id` e' `ON DELETE RESTRICT`, con anonimizzazione dei
  dati personali e conservazione dei documenti fiscali, che la legge impone di tenere.
- il fallback di `asLegalKey()` su `privacy` diventa un 404.

## Blocco 5 — Catalogo e immagini

- **24 illustrazioni SVG**, una per prodotto, nel linguaggio monocromatico editoriale
  (una rampa d'inchiostro, l'accento usato con parsimonia), servite da `public/`. Oggi
  **6 prodotti su 24** hanno un'immagine, e tutte e 9 le righe di `product_images`
  puntano a `via.placeholder.com`, **servizio dismesso**: il catalogo e' di fatto senza
  immagini.
- Illustrazioni anche per le **10 categorie** (stesso problema).
- **Categorie tutte in italiano**: oggi `Clothing`, `Shoes`, `Accessories`, `Bags`
  convivono con `Gioielli` e `Tacchi`.
- Riscrittura di `002_seed_data.sql`: nomi e descrizioni in italiano, immagini per tutti e
  24 i prodotti, e **hash bcrypt diversi e reali** per gli utenti seed (oggi tutti e 10
  condividono l'hash-esempio della documentazione bcrypt, password ignota).
- Via i **6 URL Unsplash cablati** in `home.ts`.
- **Fallback immagine ovunque**: catalogo, scheda prodotto e wishlist mostrano oggi un
  `<img>` con `src` vuoto e nessun `onerror` — un'immagine rotta visibile. Un componente
  unico che degrada a un segnaposto disegnato.

## Blocco 6 — Passata visiva

Direzione confermata: **si spinge il monocromo editoriale esistente**, non si cambia
registro. I token OKLCH con contrasto misurato restano.

- **Il flusso di autenticazione rientra nel design system**: `login`, `register`,
  `forgot-password`, `reset-password` e `verify-email` ricostruiscono oggi i bottoni a
  mano (`bg-black text-white px-6 py-2.5 ...`) invece di usare `.btn`, e `verify-email`
  usa `font-serif` invece di `font-display`.
- Stesso lavoro su `me.html` (20 occorrenze) e `admin-products.html` (12).
- I due colori cablati nei CSS di componente (`#8f8f8f` in `products.css`, `#6CD0D0` in
  `home.css`) passano ai token.
- Passata di composizione su home, catalogo, scheda prodotto e checkout: fotografia
  (illustrazioni), spazio, scala tipografica, micro-animazioni gia' previste dai token.
- **Verifica a occhio in un browser vero** con Playwright, desktop e 390px, su ogni pagina
  pubblica e ogni pagina admin. Non e' mai stata fatta dopo il redesign del 2026-08-26.

## Contorno

- `CLAUDE.md` (root) e `docs/` riscritti sul backend Java. Oggi descrivono NestJS + Prisma,
  comandi `npx prisma migrate`, e un branch attivo `products`: chi apre il repo legge
  istruzioni false. `docs/11-what-is-missing.md` va rifatto da zero.
- **CI GitHub Actions**: `.github/` contiene solo un `.keep` vuoto. Un workflow che fa
  girare i test backend (con Docker per Testcontainers) e frontend a ogni push.
- **404 vera**: oggi il wildcard fa `redirectTo: 'home'`.
- `.env.example` allineato (manca `ADMIN_*` nel `.env` reale, e `RESEND_SENDER_EMAIL` non
  esiste piu').
- Rimozione del componente orfano `search-bar` e delle 11 interfacce vuote in
  `src/app/interfaces/`, oppure loro riempimento — non entrambi a meta'.

## Test

Ogni blocco porta i propri test, scritti prima del codice dove il codice e' testabile.

- **Blocco 1**: il piu' coperto. Fase A senza fase B (ordine resta `pending`, giacenza
  riservata); webhook ripetuto due volte (idempotenza); webhook con firma non valida;
  fallimento del pagamento e compensazione completa; reaper su ordine scaduto; gift card
  che copre l'intero importo (nessun incasso); rimborso su annullo.
- **Blocco 3**: transizioni di stato illegittime rifiutate; rate limit per ogni rotta nuova.
- **Blocco 4**: export dati, cancellazione account, 404 su chiave legale sconosciuta.
- **Blocco 6**: i 18 smoke test generati diventano test veri almeno per carrello, checkout
  e scheda prodotto, oggi senza copertura.

Obiettivo dichiarato: nessun test scritto per far passare la suite. Ogni test nuovo su un
bug va prima verificato **rosso** rimettendo il bug, come gia' fatto il 2026-08-20.

## Rischi

1. **La riserva della giacenza in fase A e' la scelta piu' delicata.** L'alternativa
   (scaricare al webhook) elimina il bisogno del reaper ma consente l'oversell. Si sceglie
   la riserva perche' un negozio vero non puo' vendere due volte lo stesso pezzo.
2. **Il reaper e' codice che gira da solo.** Un errore qui restituisce merce o denaro senza
   che nessuno lo chieda. Va testato con piu' cura del resto.
3. **Stripe non e' verificabile fino in fondo senza chiavi di test.** Tutto si costruisce e
   si testa contro un doppio; la verifica dal vivo richiede `sk_test_`/`pk_test_`.
4. **Disco al 94%** (24 GB liberi). I build Docker sono grossi; nell'agosto 2026 il disco
   pieno ha fatto cadere Docker tre volte.

## Ordine di lavoro

Percorso principale, in sequenza: **Blocco 1 → Blocco 3 → Blocco 2**. L'infrastruttura
viene dopo la correttezza, perche' il TLS serve a proteggere qualcosa che dev'essere gia'
giusto. Poi **Blocco 6**, che dipende dal Blocco 5.

In parallelo, su sottoagenti, fin dall'inizio: **Blocco 4** (legale e GDPR) e **Blocco 5**
(catalogo e illustrazioni). Non toccano il percorso soldi e non hanno dipendenze da 1-3.

Il **contorno** chiude, quando il resto e' fermo e la documentazione puo' descrivere uno
stato definitivo.

Il Blocco 1 resta in mano al processo principale, mai delegato: e' dove si perdono soldi
se si sbaglia.
