# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack e-commerce application ("Common Era") built with:
- **Backend:** NestJS 11 + Prisma 7 + PostgreSQL 16
- **Frontend:** Angular 21 (standalone components, SSR) + Tailwind CSS 4
- **Infrastructure:** Docker Compose (3 services: frontend, backend, db)

## Running the Project

Everything runs in Docker. From the repo root:

```bash
docker compose up -d          # Start all services
docker compose restart backend  # Reload backend after code changes
docker compose restart frontend # Reload frontend after code changes
docker compose logs backend --tail=30  # Check backend logs
docker compose logs frontend --tail=30 # Check frontend build errors
```

- Frontend: http://localhost:4200
- Backend API: http://localhost:3000
- DB (external): `localhost:5433` (PostgreSQL, user/password/mydb)

## Database

```bash
# Run a SQL file against the DB
docker compose exec -T db psql -U user -d mydb < database/seed.sql

# Interactive psql
docker compose exec db psql -U user -d mydb

# Regenerate Prisma client after schema changes
docker compose exec backend npx prisma generate
docker compose exec backend npx prisma migrate dev --name <migration_name>
```

Schema is at `server/prisma/schema.prisma`. All primary keys are UUIDs via `gen_random_uuid()`. Prisma serializes `Decimal` fields as **strings** in JSON — always use `parseFloat(String(v))` before arithmetic in the frontend.

## Backend (NestJS)

```bash
# Run outside Docker (from /server)
npm run start:dev   # watch mode
npm run lint        # ESLint + auto-fix
npm run test        # Jest unit tests
npm run test:e2e    # End-to-end tests
```

### Architecture

`app.module.ts` imports:
- `ConfigModule` (global, reads `.env`)
- `ThrottlerModule` — 100 req/min/IP via `APP_GUARD`
- `PrismaModule` (`@Global()`) — inject `PrismaService` anywhere
- `MailModule` (`@Global()`) — inject `MailService` anywhere
- Feature modules: `AuthModule`, `UsersModule`, `ProductsModule`, `WishlistModule`

Each feature module follows: `module.ts` → `controller.ts` → `service.ts` → `dto/`.

**Auth flow:** JWT stored in HttpOnly cookie → `JwtAuthGuard` validates session via `session` table + `jwt.strategy.ts`. The `req.user` object includes `sessionId` (from `jwt.strategy.ts`). Sessions expire in 7 days.

**Important:** The backend's `login()` response must include all user fields (`emailVerifiedAt`, `gender`, etc.) or the frontend signal will have stale `null` values until page refresh.

## Frontend (Angular 21)

```bash
# Run outside Docker (from /e-commerce)
npm start           # ng serve
npm run build       # production build
npm test            # Karma unit tests
```

### Architecture

**All components are standalone** — no NgModules. Import `CommonModule`, `RouterModule`, `FormsModule`, `ReactiveFormsModule` per-component as needed.

**State management** uses Angular signals (`signal()`, `computed()`, `effect()`). Auth state lives in `AuthService` (`services/auth.ts`) with `currentUser` signal.

**SSR caveat:** Both auth guards check `isPlatformBrowser(inject(PLATFORM_ID))` and return `of(true)` on the server to avoid redirect loops during SSR hydration.

**API base URL** is hardcoded as `const API_URL = 'http://localhost:3000'` in each service file (no environment.ts used).

**Key services:**
- `AuthService` — login/register/logout, `currentUser` signal, email verification, password change
- `ProductsService` — product listing with filters, product by slug, filter metadata
- `WishlistService` — toggle save, load IDs (for heart icons), load full items (for /me)

**Route structure:**

| Path | Component | Guard |
|------|-----------|-------|
| `/products` | Products | — |
| `/product/:slug` | ProductDetail | — |
| `/me` | MeComponent | authGuardGuard |
| `/verify-email/:token` | VerifyEmail | — |

## Environment Variables

Backend reads from `server/.env` (mapped via `env_file` in docker-compose):

```
DATABASE_URL=postgresql://user:password@db:5432/mydb
JWT_SECRET=...
FRONTEND_URL=http://localhost:4200
BACKEND_URL=http://localhost:3000
RESEND_API_KEY=...
RESEND_SENDER_EMAIL=...
RESEND_SENDER_NAME=...
```

## Key Data Model Notes

- `Product.basePrice` and all `Decimal` fields come from Prisma as **strings** — parse with `parseFloat()` in frontend
- `Discount.type` enum values are lowercase: `'percentage'` | `'fixed_amount'` (not uppercase)
- Wishlist uses a unique constraint on `(user_id, product_id, variant_id)` — toggle logic must query by all three
- Product images: `is_cover = true` for main, `sort_order = 1` for hover image
- Categories support parent/child hierarchy via `parent_id` self-reference

## Git Workflow

Current active branch: `products`. Main branch: `main`. PRs merge into `main`.
