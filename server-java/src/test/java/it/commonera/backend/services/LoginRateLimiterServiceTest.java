package it.commonera.backend.services;

import it.commonera.backend.exceptions.ApiException;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Fix 3, isolato dal resto: il limitatore non ha dipendenze, quindi un test
 * unitario diretto (senza Spring, senza database) basta a coprire la sua logica.
 * La stessa regola viene verificata anche end-to-end in
 * {@link AuthServiceTest#fiveFailedAttemptsLockTheAccountOut()}.
 */
class LoginRateLimiterServiceTest {

    @Test
    void locksOutAfterFiveFailures() {
        var limiter = new LoginRateLimiterService();
        String identifier = "someone@example.com";

        for (int i = 0; i < 5; i++) {
            assertThatCode(() -> limiter.checkAllowed(identifier)).doesNotThrowAnyException();
            limiter.recordFailure(identifier);
        }

        assertThatThrownBy(() -> limiter.checkAllowed(identifier))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Too many");
    }

    @Test
    void successfulLoginResetsTheCounter() {
        var limiter = new LoginRateLimiterService();
        String identifier = "someone-else@example.com";

        for (int i = 0; i < 4; i++) {
            limiter.recordFailure(identifier);
        }
        limiter.recordSuccess(identifier);

        assertThatCode(() -> limiter.checkAllowed(identifier)).doesNotThrowAnyException();

        // Dopo il reset servono di nuovo cinque fallimenti prima del blocco: quattro
        // non bastano.
        for (int i = 0; i < 4; i++) {
            limiter.recordFailure(identifier);
        }
        assertThatCode(() -> limiter.checkAllowed(identifier)).doesNotThrowAnyException();
    }

    @Test
    void identifiersAreIndependent() {
        var limiter = new LoginRateLimiterService();
        String locked = "locked@example.com";
        String other = "other@example.com";

        for (int i = 0; i < 5; i++) {
            limiter.recordFailure(locked);
        }

        assertThatThrownBy(() -> limiter.checkAllowed(locked)).isInstanceOf(ApiException.class);
        assertThatCode(() -> limiter.checkAllowed(other)).doesNotThrowAnyException();
    }

    /**
     * Fix A: un fallimento contro un indirizzo mai esistito occupava comunque
     * per sempre una voce in {@code attempts} (solo {@code recordSuccess}
     * rimuoveva la propria chiave, e chi non esiste non fa mai login con
     * successo) — un attaccante che prova N indirizzi a caso alloca N voci
     * senza limite. Qui si forza la scadenza della finestra di una voce (senza
     * aspettare i 15 minuti veri) e si verifica che una scrittura successiva
     * la faccia sparire dalla mappa.
     */
    @Test
    void prunesExpiredEntriesOpportunisticallyOnWrite() {
        var limiter = new LoginRateLimiterService();
        String stale = "never-registered@example.com";

        limiter.recordFailure(stale);
        assertThat(limiter.size()).isEqualTo(1);

        limiter.forceExpiry(stale);

        // Qualunque scrittura successiva (anche per un altro indirizzo) sfoltisce
        // le voci scadute: non serve un thread schedulato dedicato.
        limiter.recordFailure("another-never-registered@example.com");

        assertThat(limiter.size()).isEqualTo(1);
        // La voce rimasta e' quella nuova, non quella scaduta: dopo la scadenza
        // forzata l'indirizzo stale torna a comportarsi come se non fosse mai
        // stato visto.
        assertThatCode(() -> limiter.checkAllowed(stale)).doesNotThrowAnyException();
    }
}
