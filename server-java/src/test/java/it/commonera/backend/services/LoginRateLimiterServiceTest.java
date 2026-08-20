package it.commonera.backend.services;

import it.commonera.backend.exceptions.ApiException;
import org.junit.jupiter.api.Test;

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
}
