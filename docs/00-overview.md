# Project Overview

Common Era is a full-stack e-commerce application for a fashion brand. The project covers the complete lifecycle of an online store: product catalogue with filtering and variants, wishlist, shopping cart, order placement with promo codes and shipping options, post-purchase flows (reviews, returns), account management, and a skeleton admin area.

The codebase is a team learning project. It is built to be realistic — authentication, rate limiting, transactional order creation, server-side rendering, and email flows are all properly implemented rather than stubbed — but some features visible in the UI are incomplete on the frontend side. A tracker of what is still missing is in `11-what-is-missing.md`.

---

## Technology stack

### Backend

**NestJS 11** on Node 22. NestJS is an opinionated Node framework that structures the application into modules. Each feature area (auth, products, checkout, etc.) is a self-contained module with its own controller, service, and DTOs. The framework handles dependency injection, request routing, pipes, guards, and middleware in a way that is intentionally similar to Spring Boot in Java.

**Prisma 7** as the ORM. Prisma generates a fully typed client from the schema file. All database queries in the codebase go through `PrismaService`, which extends `PrismaClient`. The schema is in `server/prisma/schema.prisma` and is the single source of truth for the database structure.

**PostgreSQL 16** as the database. It runs in its own Docker container. The schema is initialised from SQL files in `database/init/` which Postgres runs automatically on first startup.

Key backend packages: `@nestjs/jwt` and `passport-jwt` for authentication, `bcrypt` for password hashing, `helmet` for security headers, `cookie-parser` to read HttpOnly cookies, `class-validator` and `class-transformer` for DTO validation, `@nestjs/throttler` for rate limiting.

### Frontend

**Angular 21** with SSR enabled via `@angular/ssr`. Angular SSR runs the app on a Node/Express server to generate the initial HTML response, then the browser takes over (hydration). This improves perceived load time and allows search engines to index the content.

All components are **standalone** — the older NgModule pattern is not used anywhere in the app code. Each component declares its own imports. The control flow uses the new built-in syntax (`@if`, `@for`, `@switch`) rather than `*ngIf` and `*ngFor` directives.

**State management** uses Angular signals (`signal()`, `computed()`, `effect()`). There is no NgRx or other state management library. Signals are used in two ways: local component state (loading flags, form feedback, selected filters) and shared application state in services (`AuthService` holds the current user signal that every component reads).

**Tailwind CSS 4** for styling. Components also have their own `.css` files for structural or layout rules that Tailwind alone does not cover cleanly.

Key frontend packages: `rxjs` (for HttpClient Observables), `@angular/forms` (reactive forms), `@angular/router` (client-side routing with the auth guard), `express` (included for the SSR server adapter).

### Infrastructure

Three Docker containers defined in `docker-compose.yml` at the repository root:

- **frontend** — runs `ng serve` in watch mode on port 4200. Volume-mounts the `e-commerce/` directory so edits to source files are reflected without restarting the container.
- **backend** — runs `nest start --watch` on port 3000. Volume-mounts `server/`. Depends on the `db` container being healthy before starting. Reads environment variables from `.env` at the repo root via `env_file`.
- **db** — PostgreSQL 16 Alpine. Exposes port 5433 on the host (not the standard 5432, to avoid conflicts with a locally installed Postgres). Mounts the `database/init/` directory as `/docker-entrypoint-initdb.d`, meaning any `.sql` files there are run once on first container creation. Data is persisted in the `pgdata` named volume.

There is currently no reverse proxy. The comments at the bottom of `docker-compose.yml` mention a planned Nginx container that would sit in front of both services, handle SSL termination, and route requests — but this is not implemented.

---

## Repository layout

```
/
├── docker-compose.yml
├── .env                          not committed — see env vars section below
├── server/                       NestJS backend
│   ├── src/
│   │   ├── main.ts               bootstrap: middleware, CORS, validation pipe
│   │   ├── app.module.ts         root module: imports all feature modules
│   │   ├── prisma/               PrismaService (extends PrismaClient)
│   │   ├── auth/                 login, register, logout, JWT cookie, session
│   │   ├── users/                profile update, email/password change, verification
│   │   ├── products/             listing with filters, slug detail, related
│   │   ├── wishlist/             toggle saved, list with product data, IDs only
│   │   ├── newsletter/           subscription endpoint
│   │   ├── addresses/            CRUD + set-default
│   │   ├── orders/               read-only listing + detail
│   │   ├── checkout/             place order (full transactional flow)
│   │   ├── reviews/              create, delete, helpful votes, rating recalc
│   │   ├── promo-codes/          validate a code against an order amount
│   │   ├── returns/              create and view return requests
│   │   └── mail/                 MailService + HTML email templates
│   └── prisma/
│       └── schema.prisma         single source of truth for the DB schema
├── e-commerce/                   Angular frontend (SSR)
│   └── src/app/
│       ├── app.routes.ts         route table
│       ├── app.component.*       root shell (nav-bar + cart + router-outlet)
│       ├── components/           nav-bar, footer, cart drawer, search-bar
│       ├── pages/                one directory per route
│       ├── services/             auth, products, wishlist, cart
│       ├── guards/               authGuardGuard
│       └── interfaces/           older interface files (partially superseded)
└── database/
    ├── init/
    │   ├── 001_schema.sql        full DDL — tables, indexes, constraints
    │   └── 002_seed_data.sql     initial category and product data
    └── seed/
        ├── seed-products.sql     dev seed: deletes all products and inserts fresh catalog
        └── seed.sh               shell script to run the seed via Docker
```

---

## Running the project

Everything runs inside Docker. No local Node or Postgres installation is required.

```bash
# start all three containers in detached mode
docker compose up -d

# check that all containers started cleanly
docker compose ps

# view backend logs (NestJS startup output, request logs, email debug output)
docker compose logs backend --tail=50

# view frontend logs (Angular build output, SSR errors)
docker compose logs frontend --tail=50

# restart the backend after adding a new module or changing app.module.ts
docker compose restart backend

# restart the frontend after a dependency change in package.json
docker compose restart frontend
```

The frontend `ng serve` process detects file changes inside the volume-mounted directory and recompiles automatically. The backend `nest start --watch` does the same. For most day-to-day code edits, no restart is needed — only when NestJS fails to detect a module change or after a package installation.

---

## Environment variables

The backend reads from a `.env` file at the repository root (not `server/.env`), mapped via `env_file` in docker-compose. This file is in `.gitignore` and must be created locally.

```env
DATABASE_URL=postgresql://user:password@db:5432/mydb
JWT_SECRET=some_long_random_string_change_this_in_production
FRONTEND_URL=http://localhost:4200
BACKEND_URL=http://localhost:3000
RESEND_API_KEY=re_...
RESEND_SENDER_EMAIL=noreply@yourname.it
RESEND_SENDER_NAME=Common Era
```

**DATABASE_URL** — Prisma uses this to connect. Inside Docker the hostname is `db` (the service name), not `localhost`.

**JWT_SECRET** — used to sign and verify JWT tokens. Must be long (32+ characters) and random in any real environment. Changing it invalidates all existing sessions.

**FRONTEND_URL** — used in two places: the CORS configuration (backend accepts requests only from this origin) and in email links that point back to the frontend (e.g. the email verification link sends users to `FRONTEND_URL/verify-email/:token`).

**BACKEND_URL** — used in email links that point to backend endpoints (e.g. the email change confirmation link points to `BACKEND_URL/users/confirm-email/:token`).

**RESEND_*** — Resend is the transactional email provider. If `RESEND_API_KEY` is empty, `MailService` logs the email content to the console instead of sending it. This means email flows work correctly in development without any email account.

---

## Database access

```bash
# run a SQL file against the running db container
docker compose exec -T db psql -U user -d mydb < database/init/001_schema.sql

# run the product seed (deletes all products and inserts fresh data)
bash database/seed/seed.sh

# open an interactive psql session
docker compose exec db psql -U user -d mydb

# regenerate the Prisma client after editing schema.prisma
docker compose exec backend npx prisma generate

# create and apply a new Prisma migration
docker compose exec backend npx prisma migrate dev --name describe_the_change
```

The `database/init/` SQL files are run by Postgres automatically the first time the `db` container is created. If the `pgdata` volume already exists, they are not re-run. To force a clean schema, delete the volume:

```bash
docker compose down -v   # removes containers AND the pgdata volume
docker compose up -d     # recreates everything from scratch
```

**Decimal fields and JSON serialisation** — Prisma serialises `Decimal` fields (used for `basePrice`, `total`, discount values, etc.) as strings in JSON. This means `product.basePrice` arrives at the frontend as the string `"45.00"`, not the number `45`. Every place in the frontend that does arithmetic must call `parseFloat(String(value))` first. Calling `.toFixed()` directly on the raw value throws a TypeError and crashes the rendering loop.
