# Documentazione tecnica

Descrive il progetto **com'e' adesso**: backend Spring Boot in `server-java/`,
frontend Angular in `e-commerce/`, schema Postgres scritto a mano in
`database/init/`.

> Fino a settembre 2026 queste pagine descrivevano il backend NestJS + Prisma, che
> e' dismesso: `server/` resta nel repository come riferimento storico, fuori dal
> `docker-compose.yml`. Se una frase qui dentro non combacia col codice, vince il
> codice — e la frase va corretta.

| File | Contenuto |
|---|---|
| [00-overview.md](./00-overview.md) | Stack, struttura del repository, avvio, variabili d'ambiente |
| [01-backend-architecture.md](./01-backend-architecture.md) | Struttura Spring Boot, configurazione, errori, `ddl-auto=validate` |
| [02-backend-auth.md](./02-backend-auth.md) | Cookie di sessione, JWT, `JwtCookieFilter`, registrazione e reset password |
| [03-backend-users-mail.md](./03-backend-users-mail.md) | Profilo, cambio email e password, GDPR (`PrivacyService`), posta |
| [04-backend-products.md](./04-backend-products.md) | Catalogo: filtri, ordinamenti, paginazione, scheda, correlati |
| [05-backend-commerce-modules.md](./05-backend-commerce-modules.md) | Carrello, checkout, ordini, resi, promo, gift card, punti, recensioni, admin |
| [06-frontend-architecture.md](./06-frontend-architecture.md) | Standalone, signal, SSR per rotta, guardie, design system |
| [07-frontend-services.md](./07-frontend-services.md) | I servizi Angular, uno per uno |
| [08-frontend-pages.md](./08-frontend-pages.md) | Le pagine e cosa fanno |
| [09-frontend-components.md](./09-frontend-components.md) | I componenti condivisi |
| [10-database-schema.md](./10-database-schema.md) | Tabelle, enum, regole di cancellazione |
| [11-what-is-missing.md](./11-what-is-missing.md) | **Cosa manca davvero**, verificato sul codice |
| [api.md](./api.md) | Tutti gli endpoint |
