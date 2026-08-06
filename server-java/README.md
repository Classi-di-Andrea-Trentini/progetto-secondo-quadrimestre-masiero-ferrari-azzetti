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
| Catalogo: lista con filtri, ricerca, ordinamenti, scheda, correlati | fatto |
| Carrello: lettura, modifica, svuotamento, fusione al login | fatto |
| **Checkout**: giacenza condizionale, punti, gift card, svuotamento carrello | fatto |
| **Ordini**: elenco, dettaglio, cronologia stati, annullamento con ripristino giacenza | fatto |
| **Fattura PDF** con numerazione progressiva per anno | fatto |
| **Recensioni** (pubbliche, creazione, foto, moderazione) | fatto |
| **Wishlist, indirizzi** | fatto |
| **Gift card** (emissione, saldo, utilizzo) | fatto |
| **Punti fedeltà** (saldo, storico, accredito, sconto) | fatto |
| **Avvisi "torna disponibile"** | fatto |
| **Area amministrativa**: statistiche, magazzino, rettifiche, moderazione, stati ordine | fatto |
| **Invio email** via SMTP (stesso trasporto del backend Node) | fatto |
| Codici promo, resi, newsletter | **da portare** |
| Carrello abbandonato, sitemap | **da portare** |

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
  carrello riletto dal backend Node** (3 pezzi, 89,97 su entrambi);
- ordine: totale 74,88, **giacenza scalata da 45 a 43**, cronologia a 2 passi;
- annullamento: stato `cancelled`, 3 passi, **giacenza ripristinata a 45**;
- fattura PDF vera, numero `2026-0002` — **continua la numerazione** delle fatture
  generate dal backend Node, perché la tabella è la stessa;
- **una gift card emessa dal Node**, letta e scalata **dal Java**: ordine da 29,89 con
  5 € di punti e 15 € di buono → totale 24,89 e carta addebitata per 9,89, con i
  movimenti scritti sulla stessa tabella;
- amministrazione: incasso, scontrino medio sui soli ordini incassati, magazzino sotto
  soglia, rettifica `delta` contro `set`, rifiuto della giacenza negativa.
