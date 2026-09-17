# ─── Stage di build ──────────────────────────────────────────────────────────
# L'immagine di prima faceva `ng serve`: il server di sviluppo di Angular, in
# produzione. Costava un avvio lentissimo, nessuna ottimizzazione e — soprattutto
# — niente service worker, che `ng serve` non costruisce affatto: senza quello il
# browser non offre mai "Installa app" e il sito non apre offline.
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ─── Stage di runtime ────────────────────────────────────────────────────────
# Solo il costruito e le dipendenze di produzione: niente sorgenti, niente CLI.
FROM node:20-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

EXPOSE 4200
ENV PORT=4200

# Il server SSR di Angular: rende le pagine lato server (il catalogo va indicizzato)
# e fa da proxy verso il backend per /api e /uploads (vedi src/server.ts).
CMD ["node", "dist/e-commerce/server/server.mjs"]
