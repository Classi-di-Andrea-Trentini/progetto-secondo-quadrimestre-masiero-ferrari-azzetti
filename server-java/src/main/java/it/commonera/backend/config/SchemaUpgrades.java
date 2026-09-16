package it.commonera.backend.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.Statement;
import java.util.List;

/**
 * Aggiornamenti di schema **additivi e ripetibili**, applicati all'avvio.
 *
 * Perche' esiste. Lo schema di questo progetto nasce da `database/init/*.sql`,
 * che Docker esegue **solo su un volume vuoto**: una riga aggiunta in coda a quel
 * file non arriva mai a un database gia' creato. Finche' le modifiche erano
 * zero la cosa non si notava; dal momento in cui il codice scrive
 * `partially_refunded`, un'installazione esistente andrebbe in errore al primo
 * rimborso parziale — cioe' sui soldi, e solo in produzione.
 *
 * Cosa **non** e'. Non e' uno strumento di migrazione: non tiene storia, non sa
 * tornare indietro e non deve contenere nulla che possa perdere dati. Qui
 * dentro entrano solo istruzioni idempotenti che aggiungono. Se un giorno
 * servira' una modifica distruttiva o ordinata, la risposta e' Flyway, non
 * allungare questa lista.
 */
@Component
public class SchemaUpgrades implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(SchemaUpgrades.class);

    /**
     * `ADD VALUE IF NOT EXISTS` e' idempotente e non puo' stare dentro una
     * transazione insieme all'uso del valore: viene eseguito qui, da solo, in
     * autocommit, prima che qualunque richiesta possa arrivare.
     */
    private static final List<String> STATEMENTS = List.of(
            "ALTER TYPE \"PaymentStatus\" ADD VALUE IF NOT EXISTS 'partially_refunded'");

    private final DataSource dataSource;

    public SchemaUpgrades(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @Override
    public void run(ApplicationArguments args) throws Exception {
        try (Connection connection = dataSource.getConnection()) {
            connection.setAutoCommit(true);
            for (String sql : STATEMENTS) {
                try (Statement statement = connection.createStatement()) {
                    statement.execute(sql);
                } catch (Exception e) {
                    // Non si impedisce l'avvio del negozio per un aggiornamento
                    // che potrebbe essere gia' stato applicato a mano: si urla
                    // nel log e si va avanti.
                    log.error("Aggiornamento di schema non riuscito: {}", sql, e);
                }
            }
        }
    }
}
