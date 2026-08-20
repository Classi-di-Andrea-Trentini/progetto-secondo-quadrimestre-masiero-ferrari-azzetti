package it.commonera.backend.services;

import it.commonera.backend.AbstractIntegrationTest;
import it.commonera.backend.exceptions.ApiException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Fix 1: la registrazione non deve essere un vicolo cieco. Prima di questa fix,
 * `register()` non valorizzava mai `emailVerifiedAt` e `login()` rifiutava
 * qualsiasi account appena creato con "Account non verificato" — nessun cliente
 * registrato dall'API pubblica poteva mai entrare.
 */
class AuthServiceTest extends AbstractIntegrationTest {

    @Autowired
    private AuthService auth;

    @Test
    void freshlyRegisteredUserCanLogInImmediately() {
        String email = "cliente." + UUID.randomUUID() + "@example.com";

        var registered = auth.register(email, "Password123!", "Cliente Prova");
        assertThat(registered.isEmailVerified())
                .as("registration must satisfy the email-verified gate immediately")
                .isTrue();

        var issued = auth.login(email, "Password123!", "JUnit");

        assertThat(issued.user().getEmail()).isEqualTo(email);
        assertThat(issued.token()).isNotBlank();
    }

    @Test
    void loginFailsWithWrongPassword() {
        String email = "cliente." + UUID.randomUUID() + "@example.com";
        auth.register(email, "Password123!", "Cliente Prova");

        assertThatThrownBy(() -> auth.login(email, "wrong-password", "JUnit"))
                .isInstanceOf(ApiException.class);
    }

    /** Fix 3: cinque tentativi falliti bloccano l'identificativo, un sesto non arriva piu' al confronto BCrypt. */
    @Test
    void fiveFailedAttemptsLockTheAccountOut() {
        String email = "cliente." + UUID.randomUUID() + "@example.com";
        auth.register(email, "Password123!", "Cliente Prova");

        for (int i = 0; i < 5; i++) {
            assertThatThrownBy(() -> auth.login(email, "wrong-password", "JUnit"))
                    .isInstanceOf(ApiException.class)
                    .extracting(ex -> ((ApiException) ex).getStatus())
                    .isEqualTo(HttpStatus.UNAUTHORIZED);
        }

        // Il sesto tentativo e' bloccato dal rate limiter, non piu' da credenziali sbagliate:
        // lo status cambia da 401 a 429.
        assertThatThrownBy(() -> auth.login(email, "wrong-password", "JUnit"))
                .isInstanceOf(ApiException.class)
                .extracting(ex -> ((ApiException) ex).getStatus())
                .isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
    }

    /** Fix 3: un login riuscito azzera il contatore dei tentativi falliti. */
    @Test
    void successfulLoginResetsTheFailedAttemptCounter() {
        String email = "cliente." + UUID.randomUUID() + "@example.com";
        auth.register(email, "Password123!", "Cliente Prova");

        for (int i = 0; i < 4; i++) {
            assertThatThrownBy(() -> auth.login(email, "wrong-password", "JUnit"))
                    .isInstanceOf(ApiException.class);
        }

        // Login corretto: resetta il contatore invece di lasciarlo a 4/5.
        auth.login(email, "Password123!", "JUnit");

        // Altri quattro fallimenti non bastano di nuovo a bloccare l'account: se il
        // contatore non fosse stato azzerato, questo sarebbe gia' il nono fallimento
        // complessivo e il rate limiter risponderebbe 429 invece di 401.
        for (int i = 0; i < 4; i++) {
            assertThatThrownBy(() -> auth.login(email, "wrong-password", "JUnit"))
                    .isInstanceOf(ApiException.class)
                    .extracting(ex -> ((ApiException) ex).getStatus())
                    .isEqualTo(HttpStatus.UNAUTHORIZED);
        }
    }
}
