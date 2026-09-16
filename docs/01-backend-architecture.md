# Backend — architettura

`server-java/`, Spring Boot 4.1 su Java 21. Punto d'ingresso:
`it.commonera.backend.CommonEraApplication`.

## Organizzazione dei package

Per **ruolo**, non per funzionalita':

```
config/         SecurityConfig, WebConfig, PaymentConfig, StripeProperties, AdminBootstrap
controllers/    un controller per area: traducono HTTP in una chiamata al servizio
dtos/           record Java: la forma che esce dall'API
entities/       le tabelle di database/init/001_schema.sql
exceptions/     ApiException + ApiExceptionHandler
repositories/   Spring Data JPA
security/       JwtCookieFilter, JwtService, AuthCookie, CurrentUser
services/       tutta la logica e tutte le transazioni
```

Un controller non contiene condizioni, query o calcoli: legge i parametri, prende
l'utente autenticato con `@AuthenticationPrincipal CurrentUser`, chiama il servizio
e restituisce quello che il servizio gli da'.

```java
@GetMapping
public List<UserAddress> list(@AuthenticationPrincipal CurrentUser user) {
    return addresses.list(user.id());
}
```

## `ddl-auto=validate`: lo schema comanda

```properties
spring.jpa.hibernate.ddl-auto=validate
spring.jpa.open-in-view=false
spring.jpa.properties.hibernate.jdbc.time_zone=UTC
```

Le tabelle nascono da `database/init/001_schema.sql`. `validate` fa **fallire
l'avvio** se un'entita' non combacia. `update` invece modificherebbe in silenzio uno
schema che e' anche di `002_seed_data.sql` e, storicamente, del backend Node.

`validate` controlla le colonne **dichiarate**, non il contrario: una colonna che
esiste in Postgres e che nessuna entita' mappa non fa fallire niente. E' il motivo
per cui `sessions.ip_address` (di tipo `inet`) puo' restare fuori dall'entita'.

Tre trappole gia' pagate:

| Colonna | Problema | Soluzione |
|---|---|---|
| `users.role` | enum Postgres `"UserRole"`, non varchar | `@JdbcTypeCode(SqlTypes.NAMED_ENUM)` |
| `sessions.ip_address` | tipo `inet` | fuori dall'entita': non serve |
| tutti i timestamp | `timestamp without time zone` | `LocalDateTime`, non `Instant` |

## `open-in-view=false`

Tenere aperta una sessione JPA per tutta la richiesta nasconde le query lente
dentro la resa della risposta e fa partire query dove nessuno se le aspetta.

Il prezzo: **le associazioni lazy non si possono toccare fuori dal servizio**. La
conversione in DTO avviene dentro il metodo `@Transactional`; farla nel controller
produce una `LazyInitializationException`. E' anche il motivo per cui molti servizi
hanno metodi `…AsView` che restituiscono gia' il DTO.

## Sicurezza — `config/SecurityConfig`

- **Sessione stateless** per Spring (`SessionCreationPolicy.STATELESS`): la sessione
  vera e' la riga nella tabella `sessions`, non quella del servlet container.
- **CSRF disabilitato**: il cookie e' `SameSite=Lax` e l'API e' consumata da un
  frontend sulla stessa origine.
- **CORS con origine esplicita** (`app.frontend-url`), mai `*`: con
  `allowCredentials` il carattere jolly non e' ammesso, ed e' il cookie a portare
  l'autenticazione.
- **Rotte pubbliche**: `GET /products/**`, `GET /reviews/product/**`,
  `GET /uploads/**`, `/auth/register`, `/auth/login`, `/auth/forgot-password`,
  `/auth/reset-password`, `GET /users/verify-email/**`, `GET /users/confirm-email/**`,
  `/newsletter/subscribe`. `/admin/**` richiede il ruolo `ADMIN`. Tutto il resto:
  autenticato.
- **401 e 403 distinti**: Spring risponderebbe 403 anche a chi non e' autenticato,
  e il frontend usa il 401 per capire che deve mandare al login.
- **BCrypt costo 10**: gli hash in `users` sono quelli scritti dal backend Node, e
  l'algoritmo non e' una scelta libera.

## Errori — `exceptions/`

`ApiException` porta uno `HttpStatus` e un messaggio; `ApiExceptionHandler` la
traduce nella forma che il frontend legge:

```json
{ "message": "Ordine non trovato", "error": "Not Found", "statusCode": 404 }
```

Gli errori di validazione (`MethodArgumentNotValidException`) diventano una
**lista** dentro `message`, come faceva `class-validator`.

## File caricati — `config/WebConfig`

Le foto prodotto caricate dagli amministratori vengono servite da disco su
`/uploads/**`, dalla cartella `app.uploads-dir` (`uploads/` relativa alla working
directory; in Docker e' `/app/uploads`, un volume nominato perche' un rebuild
dell'immagine le perderebbe tutte).

## Primo amministratore — `config/AdminBootstrap`

Se `ADMIN_EMAIL` e `ADMIN_PASSWORD` sono valorizzate, all'avvio l'account viene
creato; se l'indirizzo esiste gia', viene **promosso** ad amministratore senza che
la password venga toccata. Serve su un'installazione nuova: l'admin del seed ha una
password che nessuno conosce.

## Pagamenti — `config/PaymentConfig`

Il bean `PaymentGateway` e' `StripePaymentGateway` quando ci sono **sia**
`STRIPE_SECRET_KEY` **sia** `STRIPE_WEBHOOK_SECRET` (`StripeProperties.enabled()`),
altrimenti `SimulatedPaymentGateway`.

> Allo stato attuale **nessun servizio inietta `PaymentGateway`**: il checkout
> scrive un pagamento gia' riuscito senza parlare con nessuno. Vedi
> [11-what-is-missing.md](./11-what-is-missing.md).

## Test

```bash
cd server-java && ./gradlew test     # 81 test
```

`AbstractIntegrationTest` avvia un **Postgres vero** con Testcontainers
(`postgres:16-alpine`) e ci carica dentro lo stesso `001_schema.sql` di produzione:
un test che validasse contro uno schema generato da Hibernate non proverebbe
niente. `002_seed_data.sql` **non** viene applicato — ogni test si crea i dati che
gli servono, cosi' non dipende da un dataset che puo' cambiare.

Il container e' un **singleton** avviato in un blocco statico e mai fermato, non
gestito da `@Container`: quelle annotazioni lo spegnerebbero alla fine della prima
classe di test, e la seconda lo troverebbe morto. Ogni test gira in una transazione
che viene sempre annullata.

Serve un demone Docker raggiungibile: senza, la suite non parte.
