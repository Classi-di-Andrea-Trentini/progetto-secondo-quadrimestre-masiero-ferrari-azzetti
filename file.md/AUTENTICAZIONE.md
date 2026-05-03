# Sistema di Autenticazione

Questo documento descrive nel dettaglio tutta la struttura di autenticazione implementata nel progetto, i livelli di sicurezza applicati e le scelte progettuali.

---

## Panoramica

L'autenticazione usa una combinazione di JWT (JSON Web Token) e sessioni persistenti nel database. Il token viene trasmesso esclusivamente tramite cookie HttpOnly, senza mai essere esposto a JavaScript. Sul server le sessioni vengono mantenute nel database PostgreSQL attraverso Prisma, il che permette la revoca esplicita (logout) anche prima della scadenza naturale del JWT.

---

## Stack e librerie

**Backend (NestJS):**
- `@nestjs/jwt` e `@nestjs/passport` per la gestione dei JWT e il framework di autenticazione
- `passport-jwt` con strategia personalizzata per estrarre il token dal cookie
- `bcrypt` per l'hashing delle password con cost factor 12
- `@nestjs/throttler` per il rate limiting
- `helmet` per le intestazioni di sicurezza HTTP
- `cookie-parser` per la lettura dei cookie nelle richieste in ingresso
- `class-validator` e `class-transformer` per la validazione e sanificazione dell'input

**Frontend (Angular):**
- `AuthService` con signal reattivi per lo stato dell'utente
- `HttpClient` con `withCredentials: true` per inviare il cookie nelle richieste
- Guard funzionali (`authGuardGuard`, `adminGuardGuard`) basati su `toObservable` per aspettare il caricamento iniziale della sessione

---

## Struttura del database

Il modello `Session` in Prisma tiene traccia di ogni login attivo:

```
Session
  id          UUID        Identificatore univoco della sessione
  userId      UUID        Utente a cui appartiene la sessione
  tokenHash   String      Hash SHA-256 di un token casuale generato al login
  expiresAt   DateTime    Scadenza della sessione (7 giorni dal login)
  userAgent   String?     User-Agent del browser al momento del login
  ipAddress   String?     Indirizzo IP al momento del login
  createdAt   DateTime    Timestamp di creazione
```

Il modello `User` include i campi:
- `passwordHash` — l'hash bcrypt della password, mai restituito nelle risposte API
- `isActive` — se falso, l'utente non può autenticarsi
- `deletedAt` — soft delete: se valorizzato, l'utente è considerato eliminato
- `lastLoginAt` — aggiornato ad ogni login avvenuto con successo

---

## Flusso di autenticazione

### Registrazione (POST /auth/register)

1. Il DTO `RegisterDto` viene validato con `class-validator`: `fullName` (2-255 caratteri), `email` (formato valido, max 255), `password` (minimo 8 caratteri, deve contenere almeno una maiuscola, una minuscola e un numero, max 72 caratteri — limite di bcrypt).
2. `ValidationPipe` con `whitelist: true` elimina automaticamente qualsiasi campo non dichiarato nel DTO.
3. Si verifica l'unicità dell'email nella tabella `users` (indice univoco nel DB).
4. La password viene hashata con bcrypt a 12 round.
5. L'utente viene creato nel database. La risposta contiene i dati pubblici (id, email, fullName, role, createdAt) ma non il passwordHash.
6. Il client viene reindirizzato al login.

### Login (POST /auth/login)

1. Validazione input con `LoginDto`.
2. L'utente viene cercato per email (case-insensitive, email viene salvata in lowercase).
3. Se l'utente non esiste, non è attivo, o è eliminato, viene restituito `401 Unauthorized` con messaggio generico "Credenziali non valide" — senza distinguere i casi per non rivelare se l'email è registrata.
4. La password fornita viene confrontata con l'hash in database usando `bcrypt.compare`.
5. Se le credenziali sono valide, viene creato un record `Session` nel database con:
   - Un token casuale di 32 byte (generato con `crypto.randomBytes`), il cui hash SHA-256 viene salvato come `tokenHash`
   - La scadenza impostata a 7 giorni
   - L'IP e lo User-Agent del client
6. Il campo `lastLoginAt` dell'utente viene aggiornato.
7. Viene firmato un JWT con payload `{ sub: userId, sid: sessionId, role }` e scadenza 1 giorno.
8. Il JWT viene impostato come cookie con le seguenti opzioni:
   - `httpOnly: true` — non accessibile da JavaScript
   - `sameSite: 'strict'` — non inviato in richieste cross-site
   - `secure: true` in produzione — solo su HTTPS
   - `maxAge` di 7 giorni (coerente con la sessione nel DB)
   - `path: '/'`
9. La risposta JSON contiene solo i dati pubblici dell'utente.

### Verifica del token (richieste autenticate)

Per ogni richiesta verso un endpoint protetto con `JwtAuthGuard`:

1. `JwtStrategy` estrae il valore del cookie `access_token` dalla richiesta.
2. Verifica la firma del JWT con il segreto `JWT_SECRET`.
3. Controlla la scadenza del token (gestita automaticamente da passport-jwt).
4. Dal payload estrae `sub` (userId) e `sid` (sessionId).
5. Chiama `AuthService.validateSession(userId, sessionId)` che:
   - Cerca la sessione nel DB per `id`
   - Verifica che `session.userId === userId` (difesa contro session fixation)
   - Verifica che `session.expiresAt > now()`
   - Verifica che l'utente sia ancora attivo e non eliminato
6. Se tutte le verifiche passano, l'oggetto utente (senza passwordHash) viene iniettato in `req.user`.
7. In caso di fallimento a qualsiasi step, viene restituito `401 Unauthorized`.

### Logout (POST /auth/logout)

1. Richiede autenticazione (JwtAuthGuard).
2. Estrae il sessionId dal payload del JWT nel cookie.
3. Elimina la riga `Session` corrispondente dal database — questo invalida immediatamente la sessione server-side anche se il JWT sarebbe ancora valido per la sua durata residua.
4. Cancella il cookie `access_token` dal browser.

### Endpoint /auth/me (GET)

Richiede autenticazione. Restituisce direttamente l'oggetto utente presente in `req.user`, già caricato dalla strategia JWT. Questo endpoint viene chiamato dal frontend all'avvio dell'applicazione per ripristinare lo stato di autenticazione.

---

## Sicurezza in dettaglio

### Protezione delle password

bcrypt con cost factor 12 viene usato per tutti gli hash di password. Il cost factor 12 richiede circa 300-400 ms per hash su hardware moderno, rendendo gli attacchi brute-force computazionalmente proibitivi. Il limite di 72 caratteri sulla password è imposto dal limite interno di bcrypt (ignora i caratteri oltre il 72° byte).

### Cookie HttpOnly

Il token non è mai accessibile tramite `document.cookie` o `localStorage`. Questo elimina la superficie di attacco XSS: anche se un attaccante riuscisse a iniettare JavaScript nella pagina, non potrebbe leggere il token.

### SameSite Strict

Il cookie non viene inviato in richieste originate da altri siti (link esterni, form cross-site). Questo protegge da attacchi CSRF senza necessità di token CSRF aggiuntivi.

### Sessioni invalidabili server-side

Il JWT da solo non è sufficiente per autenticarsi: la sessione corrispondente deve esistere nel database e non essere scaduta. Questo permette di:
- Revocare una sessione specifica (logout)
- Bloccare un utente immediatamente (impostando `isActive = false`)
- Gestire più sessioni contemporaneamente da dispositivi diversi

### Rate limiting

`@nestjs/throttler` è configurato a tre livelli:
- Globale: 100 richieste al minuto per IP su tutte le route
- Endpoint `/auth/login`: 10 tentativi ogni 15 minuti per IP
- Endpoint `/auth/register`: 5 tentativi ogni 15 minuti per IP

Il ThrottlerGuard è registrato come guard globale tramite `APP_GUARD`.

### Intestazioni HTTP (Helmet)

`helmet` imposta automaticamente le seguenti intestazioni di sicurezza:
- `Content-Security-Policy`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Strict-Transport-Security` (in produzione)
- `X-XSS-Protection`
- `Referrer-Policy`

### Validazione input (ValidationPipe)

`ValidationPipe` con `whitelist: true` e `forbidNonWhitelisted: true` assicura che:
- I campi non dichiarati nel DTO vengano rimossi dalla richiesta
- Eventuali campi extra vengano rifiutati con un errore 400
- I tipi vengano trasformati (es. stringhe numeriche in numeri)

Questo previene injection e property pollution attacks.

### CORS

Il middleware CORS è configurato per accettare richieste con credenziali (cookie) solo dall'origine del frontend (`FRONTEND_URL`, default `http://localhost:4200`). In produzione questa variabile d'ambiente deve essere impostata sull'URL reale del frontend.

### Messaggi di errore generici

Il login restituisce sempre "Credenziali non valide" indipendentemente dal motivo del fallimento (utente non trovato, password errata, account disabilitato). Questo impedisce l'enumerazione degli utenti registrati.

---

## Guard Angular

### authGuardGuard

Protegge le route che richiedono autenticazione (attualmente `/me`). Al momento dell'attivazione della route:

1. Si mette in ascolto sul signal `isLoading` dell'`AuthService` tramite `toObservable`.
2. Aspetta che il caricamento iniziale si sia completato (la chiamata a `/auth/me` all'avvio).
3. Se l'utente è autenticato, permette la navigazione.
4. Altrimenti reindirizza a `/login`.

Questo pattern evita il flickering (la pagina non viene mai mostrata parzialmente per poi fare redirect) perché la navigazione è bloccata finché lo stato di autenticazione non è noto.

### adminGuardGuard

Come `authGuardGuard` ma verifica anche che il ruolo dell'utente sia `admin`. Se autenticato ma non admin, reindirizza a `/home`. Se non autenticato, reindirizza a `/login`.

---

## Variabili d'ambiente richieste (backend)

| Variabile      | Descrizione                                           | Default (solo sviluppo)     |
|----------------|-------------------------------------------------------|-----------------------------|
| `JWT_SECRET`   | Segreto per firmare i JWT. In produzione deve essere una stringa casuale lunga almeno 64 caratteri | `changeme_in_production` |
| `DATABASE_URL` | URL di connessione PostgreSQL                         | Dipende da Prisma config     |
| `FRONTEND_URL` | Origine del frontend per CORS                         | `http://localhost:4200`      |
| `NODE_ENV`     | Se `production`, il cookie usa il flag `secure`       | —                            |
| `PORT`         | Porta su cui il server ascolta                        | `3000`                       |

In produzione `JWT_SECRET` deve essere cambiato con un valore sicuro e non deve mai essere committato in repository.

---

## File coinvolti

**Backend:**
- `server/src/auth/auth.module.ts` — configurazione del modulo, JwtModule, PassportModule
- `server/src/auth/auth.service.ts` — logica di business (register, login, logout, validateSession, getProfile)
- `server/src/auth/auth.controller.ts` — endpoint HTTP con throttling
- `server/src/auth/jwt.strategy.ts` — strategia Passport per estrarre e validare il JWT dal cookie
- `server/src/auth/jwt-auth.guard.ts` — guard NestJS basato sulla strategia JWT
- `server/src/auth/dto/register.dto.ts` — DTO con validatori per la registrazione
- `server/src/auth/dto/login.dto.ts` — DTO con validatori per il login
- `server/src/prisma/prisma.service.ts` — servizio Prisma con lifecycle corretto
- `server/src/prisma/prisma.module.ts` — modulo globale che esporta PrismaService
- `server/src/app.module.ts` — ThrottlerModule globale
- `server/src/main.ts` — Helmet, cookie-parser, ValidationPipe, CORS

**Frontend:**
- `e-commerce/src/app/services/auth.ts` — AuthService con signal reattivi
- `e-commerce/src/app/guards/auth-guard-guard.ts` — guard per route autenticate
- `e-commerce/src/app/guards/admin-guard-guard.ts` — guard per route admin
- `e-commerce/src/app/pages/login/` — form di login con gestione errori
- `e-commerce/src/app/pages/register/` — form di registrazione con validazione client-side
- `e-commerce/src/app/pages/me/` — pagina profilo con dati reali dall'API
- `e-commerce/src/app/app.routes.ts` — route con guard applicati
- `e-commerce/src/app/app.config.ts` — provideHttpClient con withFetch
