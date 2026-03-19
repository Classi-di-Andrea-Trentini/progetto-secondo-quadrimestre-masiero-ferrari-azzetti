# Setup NestJS + PostgreSQL + Prisma

Guida completa alla configurazione del backend NestJS con database PostgreSQL tramite Docker e Prisma ORM (v7).

---

## Struttura del progetto

```
progetto/
├── database/
│   └── init/          ← script SQL eseguiti automaticamente da Docker
├── e-commerce/        ← frontend
├── server/            ← backend NestJS
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── ...
│   ├── .env
│   ├── prisma.config.ts
│   └── ...
├── docker-compose.yml
└── .gitignore
```

---

## 1. Docker Compose

Il `docker-compose.yml` definisce tre servizi: frontend, backend e database.

```yaml
services:
  frontend:
    build: ./e-commerce
    ports:
      - "4200:4200"
    volumes:
      - ./e-commerce:/app
      - /app/node_modules
    depends_on:
      - backend

  backend:
    build: ./server
    ports:
      - "3000:3000"
    environment:
      PORT: 3000
      DB_HOST: db
      DB_PORT: 5432
      DB_USER: user
      DB_PASSWORD: password
      DB_NAME: mydb
    volumes:
      - ./server:/app
      - /app/node_modules
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: mydb
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./database/init:/docker-entrypoint-initdb.d:ro
    ports:
      - "5433:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user -d mydb"]
      interval: 5s
      timeout: 3s
      retries: 10

volumes:
  pgdata:
```

### Come funziona l'inizializzazione del database

Grazie alla riga:
```yaml
- ./database/init:/docker-entrypoint-initdb.d:ro
```
Alla prima esecuzione di `docker compose up`, PostgreSQL esegue automaticamente tutti gli script SQL nella cartella `database/init/` in ordine alfabetico. Questo avviene **solo la prima volta**, quando il volume `pgdata` è vuoto.

Per avviare i container:
```bash
docker compose up -d
```

---

## 2. Prisma ORM

### Perché Prisma

- Type-safety completa grazie ai tipi generati automaticamente
- Schema centralizzato in un unico file
- Migrazioni semplici da gestire
- Ottima integrazione con NestJS

### Installazione

Dentro la cartella `/server`:

```bash
npm install prisma @prisma/client
npm install @prisma/adapter-pg
npm install dotenv
npx prisma init
```

`npx prisma init` crea automaticamente:
- `prisma/schema.prisma`
- `prisma.config.ts`
- `.env`

---

## 3. File di configurazione

### `.env` (in `/server`)

```env
DATABASE_URL=""
```

> Usa `db` al posto di `localhost` se ti connetti dall'interno del container Docker.

> **Importante:** assicurati che `.env` sia nel `.gitignore` per non committare le credenziali.

### `prisma.config.ts`

Con Prisma v7 la connessione al database non va più nello `schema.prisma` ma in questo file:

```typescript
import 'dotenv/config'
import path from 'node:path'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  earlyAccess: true,
  schema: path.join('prisma', 'schema.prisma'),
  migrate: {
    adapter: async () => {
      const { PrismaPg } = await import('@prisma/adapter-pg')
      return new PrismaPg({
        connectionString: process.env.DATABASE_URL,
      })
    },
  },
})
```

### `prisma/schema.prisma`

Con Prisma v7 il datasource **non** include più la `url`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
}
```

---

## 4. Schema del database

Il database è un e-commerce completo con le seguenti tabelle principali:

| Area | Tabelle |
|------|---------|
| Utenti | `users`, `user_addresses`, `sessions` |
| Autenticazione | `email_verifications`, `password_resets` |
| Catalogo | `categories`, `products`, `product_variants`, `product_images`, `tags` |
| Ordini | `orders`, `order_items`, `order_status_history` |
| Pagamenti | `payments` |
| Carrello | `carts`, `cart_items` |
| Promozioni | `promo_codes`, `promo_code_uses`, `gift_cards`, `gift_card_transactions`, `discounts` |
| Resi | `returns`, `return_items` |
| Recensioni | `reviews`, `review_replies`, `review_helpful_votes` |
| AI | `ai_outfit_suggestions`, `ai_outfit_suggestion_items` |
| Sistema | `notifications`, `audit_logs`, `wishlists` |

Gli ENUM definiti nel database sono: `user_role`, `order_status`, `discount_type`, `payment_status`, `payment_method`, `notification_type`, `ai_feedback`, `return_status`, `review_status`.

---

## 5. Generare il client Prisma

Dopo aver configurato lo schema, genera i tipi TypeScript:

```bash
npx prisma generate
```

Output atteso:
```
✔ Generated Prisma Client (v7.5.0) to ./node_modules/@prisma/client in 1.04s
```

> Poiché il database è già stato creato dagli script SQL via Docker, **non usare** `prisma migrate`. Usa `prisma generate` per generare solo il client TypeScript.

---

## 6. Integrazione con NestJS

### Generare il modulo Prisma

```bash
nest generate module prisma
nest generate service prisma
```

### `prisma/prisma.service.ts`

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    })
    super({ adapter })
  }

  async onModuleInit() {
    await this.$connect()
  }

  async onModuleDestroy() {
    await this.$disconnect()
  }
}
```

### `prisma/prisma.module.ts`

```typescript
import { Global, Module } from '@nestjs/common'
import { PrismaService } from './prisma.service'

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

Il decorator `@Global()` rende il `PrismaService` disponibile in tutta l'applicazione senza doverlo reimportare in ogni modulo.

### `app.module.ts`

```typescript
import { Module } from '@nestjs/common'
import { PrismaModule } from './prisma/prisma.module'

@Module({
  imports: [PrismaModule],
})
export class AppModule {}
```

---

## Prossimi step

- Creare i moduli NestJS per ogni risorsa (es. `products`, `users`, `orders`)
- Ogni modulo avrà: `controller`, `service`, `dto`
- Iniettare `PrismaService` nei service per interrogare il database

```typescript
// esempio in products.service.ts
@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.product.findMany({
      where: { isActive: true },
      include: { category: true, variants: true },
    })
  }
}
```