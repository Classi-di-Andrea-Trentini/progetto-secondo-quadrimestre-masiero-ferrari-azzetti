# Panoramica

## Lo stack

**Backend: Spring Boot 4.1 su Java 21**, in `server-java/`, costruito con Gradle
(wrapper 9.5.1). Dipendenze che contano: `spring-boot-starter-data-jpa`,
`-security`, `-validation`, `-webmvc`, `-mail`; JJWT 0.12.6 per i token; Lombok;
OpenPDF 2.0.3 per la fattura in PDF (e non iText 5+, che e' AGPL); `stripe-java`
33.4.2, presente ma non ancora collegata al checkout.

**Frontend: Angular 21** con SSR (`@angular/ssr`), Tailwind CSS 4, test con Vitest
su jsdom. Tutti i componenti sono standalone.

**Database: PostgreSQL 16.** Lo schema **non** e' generato da un ORM: e' scritto a
mano in `database/init/001_schema.sql`, e Hibernate gira con
`spring.jpa.hibernate.ddl-auto=validate`.

**`server/` (NestJS + Prisma) e' dismesso.** Non e' nel `docker-compose.yml` e non
va modificato. E' rimasto perche' i due backend parlavano lo stesso database e
avevano la stessa API, il che ha permesso di accenderli alternati e confrontare i
risultati durante la riscrittura.

## Struttura del repository

```
├── e-commerce/                   frontend Angular
│   ├── public/                   asset statici (illustrazioni del catalogo, icone, manifest)
│   └── src/
│       ├── app/
│       │   ├── components/       NavBar, Cart, Footer, Breadcrumb, ProductImage, Skeleton, Toast
│       │   ├── guards/           authGuardGuard, adminGuardGuard
│       │   ├── pages/            Home, Products, ProductDetail, Checkout, Me, Admin, Legal, NotFound, …
│       │   └── services/         servizi singleton (signal + HttpClient)
│       ├── server.ts             server SSR Express, fa anche da proxy verso /api e /uploads
│       └── styles.css            design system: token OKLCH e vocabolario di classi
├── server-java/                  backend Spring Boot  ← il backend in uso
│   └── src/
│       ├── main/java/it/commonera/backend/
│       │   ├── config/           SecurityConfig, WebConfig, PaymentConfig, AdminBootstrap
│       │   ├── controllers/      un controller per area
│       │   ├── dtos/             record Java: la forma che esce dall'API
│       │   ├── entities/         le tabelle
│       │   ├── exceptions/       ApiException + handler globale
│       │   ├── repositories/     Spring Data JPA
│       │   ├── security/         JwtCookieFilter, JwtService, AuthCookie, CurrentUser
│       │   └── services/         la logica
│       ├── main/resources/application.properties
│       └── test/                 test di integrazione con Testcontainers
├── server/                       backend NestJS dismesso, riferimento storico
├── database/
│   ├── init/001_schema.sql       lo schema: unica fonte di verita'
│   └── init/002_seed_data.sql    dati di prova (24 prodotti, 10 categorie)
├── docs/                         questa documentazione
├── .github/workflows/test.yml    CI: test backend e frontend a ogni push
└── docker-compose.yml
```

## Avvio

```bash
cp .env.example .env     # riempire almeno JWT_SECRET e DB_PASSWORD
docker compose up -d
```

Tre servizi:

- **frontend** — immagine costruita da `e-commerce/Dockerfile` (build di produzione
  + server SSR Node), porta `4200`. Fa anche da proxy verso il backend per `/api` e
  `/uploads`, cosi' il browser resta sempre sulla stessa origine.
- **backend** — immagine costruita da `server-java/Dockerfile` (build Gradle in uno
  stage, poi solo JRE + jar), porta `3000`, prefisso `/api`. Parte dopo che il
  database risponde a `pg_isready`.
- **db** — `postgres:16-alpine`, porta `5433` sull'host. Al **primo** avvio del
  volume esegue tutto quello che trova in `database/init/`.

Il compose non monta i sorgenti: le immagini contengono il costruito. Per
sviluppare con ricaricamento automatico si sta fuori da Docker:

```bash
docker compose up -d db          # solo il database

cd server-java
DATABASE_URL_JDBC="jdbc:postgresql://localhost:5433/mydb" DB_USER=user DB_PASSWORD=… \
  JWT_SECRET="$(openssl rand -base64 48)" PORT=8080 ./gradlew bootRun

cd e-commerce
npm run start:local              # ng serve con proxy.conf.local.json
```

### Comandi utili

```bash
docker compose logs backend --tail=50
docker compose exec db psql -U user -d mydb

# ricreare il database da zero: senza -v il volume sopravvive e gli script di
# init NON vengono rieseguiti, che e' la prima cosa che confonde
docker compose down -v && docker compose up -d
```

## Variabili d'ambiente

Un solo file, **`.env` nella radice**, letto due volte: come `env_file` del
servizio `backend` (finisce dentro il container) e da `docker compose` stesso, che
lo usa per risolvere le scritture `${...}` nel compose.

L'elenco completo, commentato, e' in **`.env.example`**, che contiene solo le
variabili che il backend legge davvero. In sintesi:

| Variabile | A cosa serve |
|---|---|
| `JWT_SECRET` | **obbligatoria**, minimo 32 caratteri: senza, il backend non parte |
| `DB_PASSWORD` | **obbligatoria**: usata sia da Postgres sia dal backend |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | primo amministratore creato all'avvio (`AdminBootstrap`) |
| `DATABASE_URL_JDBC`, `DB_USER` | solo fuori da Docker; formato **JDBC**, non `postgresql://` |
| `FRONTEND_URL` | unica origine ammessa da CORS **e** base dei link nelle email |
| `BACKEND_URL`, `PORT`, `UPLOADS_DIR`, `JWT_TTL_DAYS`, `COOKIE_SECURE` | il resto della configurazione |
| `MAIL_PROVIDER`, `MAIL_FROM`, `SMTP_*` | posta: vuoto = le email finiscono solo nei log |
| `STRIPE_*` | vuote = checkout simulato, l'applicazione parte lo stesso |

Il backend Java **non legge** `NODE_ENV`, `TRUST_PROXY`, `CORS_EXTRA_ORIGINS`,
`DATABASE_URL` in formato `postgresql://`, `SMTP_SSL` ne' `RESEND_*`: erano tutte
del backend Node.

## Il database non lo genera nessun ORM

E' la decisione che condiziona tutto il resto. `001_schema.sql` e' la fonte di
verita'; le entita' JPA la inseguono. `ddl-auto=validate` fa **fallire l'avvio** se
una colonna non combacia, invece di modificare in silenzio uno schema condiviso.

Conseguenze pratiche quando si scrive un'entita':

1. `users.role` e' un enum Postgres (`"UserRole"`): serve
   `@JdbcTypeCode(SqlTypes.NAMED_ENUM)`.
2. `sessions.ip_address` e' di tipo `inet`: non si mappa come stringa, e infatti
   resta fuori dall'entita'.
3. I timestamp sono `timestamp without time zone`: si usa `LocalDateTime`, non
   `Instant`.

## Da sapere prima di toccare il frontend

- **`API_URL` sta in un posto solo**, `services/api.config.ts`. Nel browser e'
  `/api` (stessa origine: niente CORS, niente cookie cross-site); in SSR punta al
  backend per nome di servizio Docker.
- **Gli importi arrivano come numeri JSON.** Jackson serializza `BigDecimal` come
  numero; Prisma li mandava come stringhe. I `parseFloat(String(v))` che si trovano
  in giro sono residui di allora: innocui, ma non servono piu'.
- **Il design system e' in `src/styles.css`.** Un bottone si scrive
  `class="btn btn-primary"`; un campo, `class="field"`. Ricostruirli con utility
  Tailwind fa perdere stati di focus, disabilitato e caricamento.
