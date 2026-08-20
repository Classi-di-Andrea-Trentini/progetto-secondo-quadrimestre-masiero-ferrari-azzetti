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
     *
     * {@code forceSweepDue()} bypassa il debounce fra due sfoltimenti pieni
     * (Fix E, vedi sotto): senza, questo test dipenderebbe dai millisecondi
     * veri trascorsi fra le due chiamate, ben sotto i 30 secondi di
     * {@code SWEEP_INTERVAL}.
     */
    @Test
    void prunesExpiredEntriesOpportunisticallyOnWrite() {
        var limiter = new LoginRateLimiterService();
        String stale = "never-registered@example.com";

        limiter.recordFailure(stale);
        assertThat(limiter.size()).isEqualTo(1);

        limiter.forceExpiry(stale);
        limiter.forceSweepDue();

        // Una scrittura successiva (anche per un altro indirizzo), con lo
        // sfoltimento forzato a essere dovuto, sfoltisce le voci scadute: non
        // serve un thread schedulato dedicato.
        limiter.recordFailure("another-never-registered@example.com");

        assertThat(limiter.size()).isEqualTo(1);
        // La voce rimasta e' quella nuova, non quella scaduta: dopo la scadenza
        // forzata l'indirizzo stale torna a comportarsi come se non fosse mai
        // stato visto.
        assertThatCode(() -> limiter.checkAllowed(stale)).doesNotThrowAnyException();
    }

    /**
     * Fix E: {@code recordFailure} leggeva {@code Instant.now()} e allocava una
     * {@code Duration} per ogni voce ripassata dallo sfoltimento pieno, a ogni
     * singola chiamata — durante una raffica di N identificativi tutti diversi
     * (esattamente l'attacco per cui esiste lo sfoltimento) il colpo k-esimo
     * ripassava k-1 voci: O(N^2) sull'intera raffica, un DoS sulla CPU al posto
     * di quello sulla memoria che lo sfoltimento doveva chiudere.
     *
     * Non e' pratico misurare la CPU qui dentro; quello che si puo' verificare
     * senza dipendere dai tempi reali e' la proprieta' che lo sfoltimento deve
     * comunque garantire: una volta che le voci scadono per davvero, la
     * scrittura successiva le fa sparire, a prescindere da quante fossero.
     * Durante una raffica ancora dentro la finestra dei 15 minuti nessuna voce
     * puo' scadere per davvero (ne' questa implementazione ne' una piu' ingenua
     * lo farebbe correttamente) — la mappa cresce finche' la raffica dura, e va
     * bene cosi': il fix riguarda la CPU spesa per arrivarci, non un limite
     * istantaneo di memoria a meta' raffica.
     */
    @Test
    void mapSizeStaysBoundedAfterEntriesExpireEvenAfterALargeBurstOfDistinctIdentifiers() {
        var limiter = new LoginRateLimiterService();
        int burstSize = 5_000;

        for (int i = 0; i < burstSize; i++) {
            limiter.recordFailure("attacker-" + i + "@example.com");
        }
        // Nessuna di queste voci e' scaduta per davvero: la mappa cresce con la
        // raffica, com'e' corretto che sia.
        assertThat(limiter.size()).isEqualTo(burstSize);

        for (int i = 0; i < burstSize; i++) {
            limiter.forceExpiry("attacker-" + i + "@example.com");
        }
        limiter.forceSweepDue();

        // Una sola scrittura successiva, con lo sfoltimento dovuto, riporta la
        // mappa a contenere solo la voce nuova: l'intera raffica scaduta sparisce
        // in un colpo solo, la proprieta' di sfoltimento resta garantita.
        limiter.recordFailure("attacker-" + burstSize + "@example.com");

        assertThat(limiter.size()).isEqualTo(1);
    }
}
