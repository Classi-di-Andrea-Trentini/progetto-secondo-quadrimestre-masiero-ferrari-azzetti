-- Aggiornamenti di schema **additivi e ripetibili**, applicati a ogni avvio.
--
-- Perche' esistono. Lo schema di questo progetto nasce da `database/init/*.sql`,
-- che Docker esegue **solo su un volume vuoto**: una riga aggiunta in coda a quel
-- file non arriva mai a un database gia' creato. Finche' le modifiche erano zero
-- la cosa non si notava; dal momento in cui il codice ha iniziato a scrivere
-- `partially_refunded` e a leggere `users.google_sub`, un'installazione esistente
-- si sarebbe rotta — nel primo caso al primo rimborso parziale, cioe' sui soldi e
-- solo in produzione.
--
-- Perche' **qui** e non in un ApplicationRunner: Spring Boot esegue questo file
-- **prima** di creare l'EntityManagerFactory, quindi prima che Hibernate faccia
-- `ddl-auto=validate`. Un runner parte dopo, e una colonna aggiunta li' arriva
-- troppo tardi: l'applicazione non parte proprio ("missing column [google_sub]").
--
-- Cosa **non** e': uno strumento di migrazione. Non tiene storia, non sa tornare
-- indietro. Qui dentro entrano solo istruzioni idempotenti che aggiungono. Se
-- servira' una modifica distruttiva o ordinata, la risposta e' Flyway, non
-- allungare questo file.

-- Un reso puo' restituire una parte di quanto incassato: senza questo valore lo
-- stato del pagamento dovrebbe mentire.
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'partially_refunded';

-- Chi entra con Google non sceglie mai una password.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- L'identita' Google si riconosce dal `sub`, stabile per sempre, non dall'email,
-- che puo' cambiare. Unico: due account nostri non possono essere lo stesso
-- account Google. In Postgres un indice unico ammette quanti NULL vuole.
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub VARCHAR(255);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub ON users (google_sub);
