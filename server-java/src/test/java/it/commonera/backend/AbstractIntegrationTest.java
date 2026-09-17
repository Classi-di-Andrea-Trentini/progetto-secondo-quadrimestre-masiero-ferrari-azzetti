package it.commonera.backend;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.MountableFile;

import java.nio.file.Path;

/**
 * Base per i test che parlano con un vero Postgres.
 *
 * Lo schema nasce dallo **stesso** {@code database/init/001_schema.sql} usato da
 * Docker Compose (vedi {@code CommonEraApplication}): un test che validasse contro
 * uno schema generato da Hibernate non proverebbe niente, perche' non e' quello
 * con cui il backend gira davvero. `002_seed_data.sql` non viene applicato: i
 * dati servono ai singoli test, li crea ogni test per conto proprio, cosi' non
 * dipendono da un dataset che potrebbe cambiare.
 *
 * Container "singleton": avviato a mano in un blocco statico e mai fermato,
 * invece di lasciarlo a `@Testcontainers`/`@Container`. Quelle annotazioni
 * gestiscono il ciclo di vita **per classe di test**: siccome questo campo
 * statico vive nella superclasse ed e' quindi lo stesso oggetto condiviso da
 * tutte le sottoclassi, alla fine della prima classe di test verrebbe fermato,
 * e la seconda lo troverebbe gia' spento (e' esattamente quello che succedeva:
 * `OrderServiceTest` falliva con "Connection refused" perche' `AuthServiceTest`
 * aveva gia' fermato il container). Con l'avvio manuale il container parte una
 * volta sola per l'intera suite e resta in vita finche' non termina la JVM
 * (ripulito da Ryuk, il reaper di Testcontainers) — e' il pattern "singleton
 * container" raccomandato proprio per condividere un database fra piu' classi.
 *
 * Ogni test gira dentro una transazione che viene sempre annullata a fine
 * metodo: l'isolamento fra test non dipende da un database vuoto a ogni avvio.
 */
@SpringBootTest
@Transactional
public abstract class AbstractIntegrationTest {

    static final PostgreSQLContainer POSTGRES;

    static {
        POSTGRES = new PostgreSQLContainer("postgres:16-alpine")
                .withDatabaseName("mydb")
                .withUsername("user")
                .withPassword("password")
                .withCopyFileToContainer(
                        MountableFile.forHostPath(schemaScript()),
                        "/docker-entrypoint-initdb.d/001_schema.sql");
        POSTGRES.start();
    }

    @DynamicPropertySource
    static void datasourceProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        // Nessun default in application.properties (di proposito, vedi JwtService):
        // il test deve fornirne uno valido per far partire il contesto.
        registry.add("app.jwt.secret", () -> "test-only-jwt-secret-at-least-32-characters-long-1234567890");
    }

    /**
     * Risale dalla directory di lavoro del test finche' non trova
     * `database/init/001_schema.sql`: a seconda di come viene lanciato Gradle la
     * working dir puo' essere la radice del modulo {@code server-java} o quella
     * del repo intero.
     */
    private static Path schemaScript() {
        Path dir = Path.of("").toAbsolutePath();
        for (int i = 0; i < 6; i++) {
            Path candidate = dir.resolve("database/init/001_schema.sql");
            if (candidate.toFile().isFile()) return candidate;
            Path parent = dir.getParent();
            if (parent == null) break;
            dir = parent;
        }
        throw new IllegalStateException(
                "database/init/001_schema.sql not found starting from " + Path.of("").toAbsolutePath());
    }
}
