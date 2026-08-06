# Common Era — backend Java

Riscrittura in **Spring Boot 4 / Java 21** del backend NestJS, nella copia
`...-azzetti-java`. Vive accanto a `server/` (Node), non al suo posto: i due parlano
lo **stesso database** e la **stessa API**, quindi si possono accendere alternati e
confrontare senza toccare il frontend.

## Stato

Il nucleo è portato e provato dal vivo contro il database vero.

| Area | Stato |
|---|---|
| Autenticazione (registrazione, login, logout, `/auth/me`) | fatto |
| Sessioni con JWT in cookie HttpOnly | fatto |
| Catalogo: lista con filtri, ricerca, ordinamenti, scheda prodotto, correlati | fatto |
| Carrello: lettura, aggiunta, modifica, rimozione, svuotamento, fusione al login | fatto |
| Prezzi e sconti condivisi fra carrello e ordine | fatto |
| Ordini, checkout, pagamenti | **da portare** |
| Recensioni, wishlist, indirizzi, resi, newsletter | **da portare** |
| Codici promo, gift card, punti fedeltà | **da portare** |
| Area amministrativa, magazzino, avvisi disponibilità | **da portare** |
| Invio email | **da portare** (la configurazione SMTP è già nelle properties) |

## Avvio

Serve il Postgres del compose già in piedi (`docker compose up -d db` nella radice).

```bash
cd server-java
DATABASE_URL_JDBC="jdbc:postgresql://localhost:5433/mydb" \
DB_USER=user DB_PASSWORD=password \
JWT_SECRET="$(openssl rand -base64 48)" \
PORT=8080 ./gradlew bootRun
```

L'API risponde su `http://localhost:8080/api`, lo stesso prefisso del backend Node
(che sta sulla 3000): per puntarci il frontend basta cambiare la porta nel proxy.

## Le decisioni che vale la pena conoscere

**Lo schema non lo genera Hibernate.** Le tabelle nascono da `database/init/*.sql`
ed è lo stesso database del backend Node, quindi `ddl-auto=validate`: l'avvio
fallisce se un'entità non combacia con la tabella. È una rete di sicurezza durante
una riscrittura — `update` invece modificherebbe in silenzio uno schema condiviso.

**Tre trappole trovate proprio grazie a `validate`:**

1. `users.role` è un **enum Postgres** (`"UserRole"`), non una varchar. Va dichiarato
   con `@JdbcTypeCode(NAMED_ENUM)`, altrimenti ogni scrittura fallisce con un errore
   di tipo che non nomina la colonna.
2. `sessions.ip_address` è di tipo **`inet`**. Mapparlo come stringa fa fallire ogni
   inserimento; qui non serve, quindi resta fuori dall'entità.
3. I timestamp sono **`timestamp without time zone`**. `Instant` chiederebbe
   `timestamptz` e la validazione blocca l'avvio: si usa `LocalDateTime`.

**`open-in-view=false`.** Tenere aperta una sessione JPA per tutta la richiesta
nasconde le query lente dentro la resa della vista. Il prezzo è che le associazioni
lazy non si possono toccare nel controller: la conversione in DTO avviene **dentro**
il servizio, in transazione. Il primo giro l'ho scoperto con un
`LazyInitializationException` in faccia sulla lista prodotti.

**BCrypt con lo stesso costo del backend Node.** I due leggono gli stessi hash dalla
stessa tabella `users`: l'algoritmo non è una scelta libera.

**Il segreto JWT non ha un default.** Se manca o è più corto di 32 caratteri
l'applicazione non parte: un backend che accetta token falsificabili è peggio di uno
spento, perché sembra funzionare.

**Errori nella stessa forma del Node** (`{ message, error, statusCode }`), 401 per
chi non è autenticato e 403 per chi non ha i permessi — Spring di suo risponderebbe
403 in entrambi i casi, e il frontend usa il 401 per mandare al login.

## Verificato dal vivo

Contro il database del compose, con il backend Node acceso in parallelo:

- catalogo: **24 prodotti**, identici al Node;
- ricerca: `nera` → 4, `t-shirt nera` → 1, `tshirt` → 3, `zzzzz` → 0, **gli stessi
  numeri del backend Node**;
- login con un utente esistente (stesso hash BCrypt), `/auth/me`, password errata → 401;
- carrello: aggiunta, somma delle quantità, rifiuto oltre la giacenza, e **lo stesso
  carrello riletto dal backend Node** (3 pezzi, 89,97 su entrambi).
