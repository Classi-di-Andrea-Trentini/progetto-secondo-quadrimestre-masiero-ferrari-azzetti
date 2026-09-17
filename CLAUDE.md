# CLAUDE.md

Guida per Claude Code (claude.ai/code) quando lavora su questo repository.

> Se qualcosa qui dentro non combacia con il codice, **vince il codice**: questo file
> ha gia' descritto per mesi un backend che non era piu' quello in esecuzione.

## Cos'e' il progetto

E-commerce "Common Era", full-stack.

| Pezzo | Tecnologia | Dove |
|---|---|---|
| Backend **in uso** | Spring Boot 4.1 · Java 21 · Gradle · Spring Security · JJWT · Lombok · OpenPDF · stripe-java | `server-java/` |
| Backend **dismesso** | NestJS + Prisma | `server/` |
| Frontend | Angular 21 (standalone, SSR) · Tailwind CSS 4 · Vitest | `e-commerce/` |
| Database | PostgreSQL 16, schema in SQL a mano | `database/init/` |
| Infrastruttura | Docker Compose: `frontend`, `backend`, `db` | `docker-compose.yml` |

**`server/` non e' agganciato al compose e non va modificato.** Resta nel repo come
riferimento: i due backend parlavano lo stesso database e la stessa API, e il
confronto e' servito durante la riscrittura. Ogni lavoro sul backend si fa in
`server-java/`.

## Far girare il progetto

```bash
cp .env.example .env     # e riempire JWT_SECRET e DB_PASSWORD, altrimenti non parte
docker compose up -d
```

- Frontend: <http://localhost:4200>
- API: <http://localhost:3000/api>
- Postgres: `localhost:5433` (utente `user`, database `mydb`)

Il compose **non** monta i sorgenti: le immagini contengono il costruito di
produzione. Per lavorare col ricaricamento automatico si sta fuori da Docker.

```bash
# backend, col solo Postgres in Docker
docker compose up -d db
cd server-java
DATABASE_URL_JDBC="jdbc:postgresql://localhost:5433/mydb" DB_USER=user DB_PASSWORD=... \
  JWT_SECRET="$(openssl rand -base64 48)" PORT=8080 ./gradlew bootRun

# frontend, con il proxy verso la porta 8080
cd e-commerce && npm run start:local
```

## Database

**Lo schema non lo genera nessun ORM.** Nasce da `database/init/001_schema.sql`, che
Postgres esegue al primo avvio del volume, e i dati di prova da
`002_seed_data.sql`. Hibernate gira con `ddl-auto=validate`: se un'entita' non
combacia con la tabella, **l'applicazione non parte**. E' voluto.

Quindi: una modifica allo schema si scrive **prima** in `database/init/001_schema.sql`,
poi si adegua l'entita' JPA. Non esistono migrazioni generate, non esiste
`prisma migrate`, non esiste `ddl-auto=update`.

```bash
# psql interattivo
docker compose exec db psql -U user -d mydb

# ricreare il database da zero (il volume tiene i dati: senza cancellarlo,
# gli script di init NON vengono rieseguiti)
docker compose down -v && docker compose up -d
```

Tre trappole trovate proprio grazie a `validate`, da ricordare scrivendo entita':

1. `users.role` e' un **enum Postgres** (`"UserRole"`), non una varchar: va
   `@JdbcTypeCode(NAMED_ENUM)`, altrimenti ogni scrittura fallisce con un errore
   di tipo che non nomina la colonna.
2. `sessions.ip_address` e' di tipo **`inet`**: mapparlo come stringa fa fallire
   ogni inserimento. Resta fuori dall'entita'.
3. I timestamp sono **`timestamp without time zone`**: `Instant` pretenderebbe
   `timestamptz` e la validazione blocca l'avvio. Si usa `LocalDateTime`.

## Backend — `server-java/`

```bash
cd server-java
./gradlew test      # 81 test, Testcontainers: serve Docker in esecuzione
./gradlew bootJar   # jar eseguibile
./gradlew bootRun   # avvio locale
```

I test fanno partire un **Postgres vero** in un container e ci caricano dentro lo
stesso `001_schema.sql` di produzione. Senza un demone Docker raggiungibile la
suite non parte proprio.

### Come e' fatto

Struttura piatta per ruolo, non per funzionalita':

```
controllers/   traducono HTTP in una chiamata al servizio, niente logica
services/      tutta la logica, tutte le transazioni
repositories/  Spring Data JPA, con @Query dove serve un UPDATE condizionale
entities/      le tabelle di database/init/001_schema.sql
dtos/          record Java, la forma che esce dall'API
security/      JwtCookieFilter, JwtService, AuthCookie, CurrentUser
config/        SecurityConfig, WebConfig, PaymentConfig, AdminBootstrap
exceptions/    ApiException + ApiExceptionHandler
```

- **`open-in-view=false`.** Le associazioni lazy non si possono toccare dal
  controller: la conversione in DTO avviene **dentro il servizio**, in transazione.
  Fuori si prende una `LazyInitializationException`.
- **Errori nella forma `{ message, error, statusCode }`**, la stessa del backend
  Node, perche' il frontend la legge cosi'. **401** per chi non e' autenticato e
  **403** per chi non ha i permessi: Spring di suo risponderebbe 403 a entrambi, e
  il frontend usa il 401 per mandare al login.
- **BCrypt costo 10**: gli hash nella tabella `users` sono quelli scritti dal
  backend Node, l'algoritmo non e' una scelta libera.
- **`JWT_SECRET` non ha un default.** Se manca o e' piu' corto di 32 caratteri
  l'applicazione non parte.

### Autenticazione

JWT in un cookie **HttpOnly** di nome `access_token`, `SameSite=Lax`, `path=/`,
`Secure` pilotato da `COOKIE_SECURE`. Il token porta `sub` (utente), `sid`
(sessione) e `role`.

`JwtCookieFilter` non si ferma alla firma: controlla anche che la riga in
`sessions` **esista ancora** e non sia scaduta, e che l'utente sia attivo e non
cancellato. Senza quel secondo passaggio il logout non avrebbe alcun effetto, dato
che un JWT firmato resta valido fino alla scadenza. Durata: 7 giorni
(`JWT_TTL_DAYS`).

## Frontend — `e-commerce/`

```bash
cd e-commerce
npm ci
npm start        # ng serve
npm run build    # build di produzione + prerender
npm test         # 54 test, Vitest su jsdom
```

- **Tutti i componenti sono standalone**, nessun `NgModule`. Sintassi di controllo
  nuova (`@if`, `@for`, `@switch`).
- **Stato con i signal** (`signal`, `computed`, `effect`). L'autenticazione vive in
  `AuthService` (`services/auth.ts`), segnale `currentUser`.
- **`API_URL` sta in un posto solo**: `services/api.config.ts`. Nel browser e'
  `/api` (stessa origine, niente CORS ne' cookie cross-site); in SSR punta al
  backend per nome di servizio Docker. Non si scrive un URL a mano in un servizio.
- **SSR**: `outputMode: "server"`, e ogni rotta sceglie come essere resa in
  `app.routes.server.ts` — prerender per cio' che e' uguale per tutti, server per
  cio' che e' pubblico ma cambia, client per cio' che e' dietro autenticazione.
- **Le guardie controllano `isPlatformBrowser`** e lasciano passare sul server, per
  non innescare cicli di redirect durante l'idratazione.

Il design system sta in `src/styles.css`: token OKLCH con contrasto misurato e un
vocabolario di classi (`.btn`, `.field`, `.badge`, `.display`, `.rule`, `.measure`).
**Un bottone si scrive `class="btn btn-primary"`**, non ricostruito a mano con
utility Tailwind.

## Variabili d'ambiente

Un solo file: **`.env` nella radice**. Il compose lo usa due volte, come `env_file`
del servizio `backend` e per risolvere le scritture `${...}` nel compose stesso.
L'elenco completo e commentato e' in `.env.example`, che e' allineato a quello che
il backend legge davvero. Obbligatorie: `JWT_SECRET` e `DB_PASSWORD`.

Il backend Java **non** legge `NODE_ENV`, `TRUST_PROXY`, `CORS_EXTRA_ORIGINS`,
`DATABASE_URL` in formato `postgresql://` ne' nessuna variabile `RESEND_*`: erano
del backend Node.

## Note sul modello dei dati

- Gli importi sono `NUMERIC` in Postgres e `BigDecimal` in Java, e Jackson li
  serializza come **numeri JSON**. Prisma invece li mandava come **stringhe**: i
  `parseFloat(String(v))` sparsi nel frontend sono il residuo di quella epoca.
  Funzionano anche su un numero, quindi non sono un errore, ma non servono piu'.
- `Discount.type` e' minuscolo: `'percentage' | 'fixed_amount'`.
- La wishlist ha un vincolo unico su `(user_id, product_id, variant_id)`: il toggle
  deve cercare per tutti e tre.
- Immagini prodotto: `is_cover = true` per la principale, `sort_order = 1` per
  quella che appare al passaggio del mouse.
- Le categorie sono gerarchiche via `parent_id` che punta a se stessa.
- La cancellazione di un account e' **logica** (`users.deleted_at`): `orders.user_id`
  e' `ON DELETE RESTRICT` e il database rifiuterebbe la cancellazione vera.

## Convenzioni

- **Documentazione e commenti in italiano.** I commenti spiegano *perche'*, non
  *cosa*: il cosa si legge nel codice.
- **Conventional Commits in inglese**, corti, tipo con l'iniziale maiuscola:
  `Feat(routing): real 404 page`, `Docs: rewrite readme on java backend`.
- **Nessuna attribuzione AI nei commit.** Mai `Co-Authored-By`, mai
  `Claude-Session:`, mai "Generated with Claude Code".
- Niente `git add .`: si aggiungono i file che si sono toccati.
- Branch principale: **`main`**. Non esiste piu' nessun branch `products` attivo.

## Dove guardare

- `docs/README.md` — indice della documentazione tecnica
- `docs/11-what-is-missing.md` — cosa manca davvero, verificato sul codice
- `docs/api.md` — tutti gli endpoint
- `server-java/README.md` — note sulla riscrittura Java
