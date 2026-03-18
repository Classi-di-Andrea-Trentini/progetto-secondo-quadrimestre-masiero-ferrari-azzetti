Struttura del progetto

Il progetto e diviso in 3 blocchi principali:

- e-commerce/
  Frontend Angular. Qui ci sono pagine, componenti, guard e service lato client.

- server/
  Backend NestJS. Espone le API e gestisce la logica applicativa.

- database/init/
  Contiene lo script SQL iniziale 001_schema.sql con enum, tabelle, chiavi esterne e indici.

Database in breve

Il database e PostgreSQL ed e pensato per un e-commerce completo.
Dentro lo schema trovi le aree principali:

- utenti e autenticazione
- catalogo prodotti (categorie, varianti, immagini, wishlist)
- carrello e ordini
- pagamenti
- promo code e gift card
- recensioni
- suggerimenti outfit AI
- log amministrativi

Sono presenti diversi vincoli utili (FK, UNIQUE e CHECK) per evitare dati incoerenti.
Per esempio: quantita sempre > 0, stati ordine/pagamento con enum, relazioni corrette tra ordini, utenti e prodotti.

Come gira in locale

Si usa Docker Compose dal root del progetto:
- frontend sulla porta 4200
- backend sulla porta 3000
- postgres esposto sulla porta 5433 (interna 5432)

In pratica:
1. il frontend chiama il backend
2. il backend parla con il database
3. lo schema DB viene inizializzato tramite lo script in database/init

Nota sul primo avvio

Se il volume di Postgres e nuovo, lo script SQL parte da solo.
Se il volume esiste gia, va lanciato manualmente una volta per riallineare lo schema.

Migrazioni e gestione schema

Per questo progetto la migrazione e semplice e controllata a file SQL.
L idea e questa:

1. non si modifica a mano il database in produzione
2. si crea un nuovo file SQL versionato nella cartella database/init (esempio: 002_add_colonna_x.sql)
3. prima si prova in locale
4. poi si applica negli ambienti superiori

Flusso consigliato:

1. backup del database
2. applicazione migration
3. verifica rapida (tabelle, colonne, vincoli)
4. deploy backend che usa il nuovo schema

Comandi tipici (locale):

- applicare schema/migration:
  docker compose exec -T db psql -U user -d mydb -f /docker-entrypoint-initdb.d/001_schema.sql

- vedere le tabelle create:
  docker compose exec -T db psql -U user -d mydb -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;"

- fare backup:
  docker compose exec -T db pg_dump -U user -d mydb > backup_mydb.sql

- ripristino:
  cat backup_mydb.sql | docker compose exec -T db psql -U user -d mydb

Altre buone pratiche

- una migration deve fare una cosa chiara e piccola
- evitare modifiche distruttive senza piano di rollback
- per cambi rischiosi: prima aggiungi nuova colonna, poi popoli i dati, infine rimuovi la vecchia in una migration successiva
- tenere allineati backend e schema (prima migration, poi release codice che dipende da quella migration)

Nota

Nella cartella file.md trovi questi appunti rapidi per orientarsi nel progetto senza dover leggere tutto il codice.
