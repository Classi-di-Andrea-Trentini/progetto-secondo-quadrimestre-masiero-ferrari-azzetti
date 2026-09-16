package it.commonera.backend.security;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * I contatori, con l'orologio in mano.
 *
 * La finestra che non scade e' il modo peggiore in cui un limitatore puo'
 * rompersi: non da' errori, non fa fallire niente, e semplicemente chiude fuori
 * i clienti veri uno dopo l'altro finche' qualcuno non riavvia il backend.
 * Aspettare un'ora vera per accorgersene non e' un test, quindi l'istante entra
 * dal parametro.
 */
class RateLimitServiceTest {

    private static final RateLimitPolicy POLICY =
            new RateLimitPolicy("prova", Set.of("POST"), List.of("/prova"), 3, Duration.ofMinutes(10), false);

    @Test
    void theWindowLetsTheClientBackInWhenItExpires() {
        var limiter = new RateLimitService();
        var start = Instant.parse("2026-09-16T10:00:00Z");

        for (int i = 0; i < 3; i++) {
            assertThat(limiter.consume("k", POLICY, start).allowed()).as("colpo %d", i + 1).isTrue();
        }
        assertThat(limiter.consume("k", POLICY, start).allowed()).isFalse();

        // Un secondo prima della scadenza e' ancora bloccato...
        assertThat(limiter.consume("k", POLICY, start.plus(Duration.ofMinutes(10)).minusSeconds(1)).allowed())
                .isFalse();
        // ...e appena dopo riparte da zero.
        assertThat(limiter.consume("k", POLICY, start.plus(Duration.ofMinutes(10))).allowed()).isTrue();
    }

    /** Il tempo che manca serve al `Retry-After`: se fosse zero non direbbe niente. */
    @Test
    void theRejectionSaysHowLongIsLeft() {
        var limiter = new RateLimitService();
        var start = Instant.parse("2026-09-16T10:00:00Z");

        for (int i = 0; i < 3; i++) {
            limiter.consume("k", POLICY, start);
        }
        var decision = limiter.consume("k", POLICY, start.plus(Duration.ofMinutes(4)));

        assertThat(decision.allowed()).isFalse();
        assertThat(decision.retryAfterSeconds()).isEqualTo(Duration.ofMinutes(6).toSeconds());
    }

    /**
     * Chiavi di politiche diverse convivono nella stessa mappa con finestre di
     * durata diversa. Se lo sfoltimento le trattasse tutte con la stessa durata,
     * i contatori della politica piu' lunga sparirebbero in anticipo — cioe' il
     * tetto piu' stretto sarebbe anche il piu' facile da aggirare.
     */
    @Test
    void aShortWindowSweepDoesNotEraseALongOne() {
        var limiter = new RateLimitService();
        var breve = new RateLimitPolicy("breve", Set.of(), List.of(), 1, Duration.ofSeconds(10), false);
        var lunga = new RateLimitPolicy("lunga", Set.of(), List.of(), 1, Duration.ofHours(1), false);
        var start = Instant.parse("2026-09-16T10:00:00Z");

        limiter.consume("lunga|ip|1.2.3.4", lunga, start);
        limiter.consume("breve|ip|1.2.3.4", breve, start);

        // Passa abbastanza da far scadere la finestra breve e da far scattare lo
        // sfoltimento, ma non da far scadere quella lunga.
        var later = start.plus(Duration.ofMinutes(1));
        limiter.consume("breve|ip|1.2.3.4", breve, later);

        assertThat(limiter.consume("lunga|ip|1.2.3.4", lunga, later).allowed())
                .as("il contatore della finestra lunga deve essere sopravvissuto")
                .isFalse();
    }

    /** Le voci scadute non restano in mappa: crescerebbe senza limite. */
    @Test
    void expiredEntriesAreSweptAway() {
        var limiter = new RateLimitService();
        var start = Instant.parse("2026-09-16T10:00:00Z");

        for (int i = 0; i < 50; i++) {
            limiter.consume("k" + i, POLICY, start);
        }
        assertThat(limiter.size()).isEqualTo(50);

        // Una scrittura oltre la finestra: sfoltisce le cinquanta scadute e
        // lascia solo la propria.
        limiter.consume("nuova", POLICY, start.plus(Duration.ofMinutes(11)));

        assertThat(limiter.size()).isEqualTo(1);
    }
}
