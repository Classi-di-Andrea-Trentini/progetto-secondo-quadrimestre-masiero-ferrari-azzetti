package it.commonera.backend.services;

import it.commonera.backend.AbstractIntegrationTest;
import it.commonera.backend.dtos.UserDtos;
import it.commonera.backend.entities.PasswordReset;
import it.commonera.backend.exceptions.ApiException;
import it.commonera.backend.repositories.PasswordResetRepository;
import it.commonera.backend.repositories.UserRepository;
import it.commonera.backend.security.JwtService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

import java.time.LocalDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Cosa succede a un account che una password non ce l'ha mai avuta.
 *
 * `users.password_hash` e' diventata nullable per far stare gli account nati da
 * "Accedi con Google". Tutto il codice scritto prima dava per scontato che quel
 * valore ci fosse: {@code encoder.matches(x, null)} risponde `false` senza
 * lamentarsi, quindi il sintomo non e' un errore ma un messaggio bugiardo
 * ("Password attuale non corretta" a chi non ha nessuna password attuale) o,
 * peggio, un account che non si riesce piu' a cancellare.
 */
class PasswordlessAccountTest extends AbstractIntegrationTest {

    @Autowired
    private GoogleAccountService google;

    @Autowired
    private AuthService auth;

    @Autowired
    private UserService profiles;

    @Autowired
    private PrivacyService privacy;

    @Autowired
    private UserRepository users;

    @Autowired
    private PasswordResetRepository resets;

    @Autowired
    private JwtService jwt;

    private String email;

    /** Un account nato da Google: nessuna password, indirizzo gia' verificato. */
    private UUID googleOnlyAccount() {
        email = "solo.google." + UUID.randomUUID() + "@example.com";
        google.signIn(new GoogleIdentity("sub-" + UUID.randomUUID(), email, true, "Mario Rossi"), "JUnit");
        var user = users.findByEmailIgnoreCase(email).orElseThrow();
        assertThat(user.hasPassword()).isFalse();
        return user.getId();
    }

    // ─── Login con password ───────────────────────────────────────────────────

    @Test
    void loggingInWithAPasswordSaysToUseGoogleInstead() {
        googleOnlyAccount();

        // "Credenziali non valide" lascerebbe la persona a riprovare all'infinito una
        // password che non esiste. L'indirizzo, del resto, e' gia' enumerabile da
        // /auth/register ("Email gia' registrata"): qui non si regala niente di nuovo.
        assertThatThrownBy(() -> auth.login(email, "Password123!", "JUnit"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Google")
                .extracting(ex -> ((ApiException) ex).getStatus())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void anEmptyHashNeverMatchesAnEmptyPassword() {
        googleOnlyAccount();

        // La trappola: se il confronto arrivasse a `matches("", null)` e qualcuno
        // scrivesse un encoder indulgente, una password vuota aprirebbe l'account.
        assertThatThrownBy(() -> auth.login(email, "", "JUnit"))
                .isInstanceOf(ApiException.class);
    }

    // ─── Cambio password dall'area personale ──────────────────────────────────

    @Test
    void changePasswordTellsHowToSetOneInstead() {
        var id = googleOnlyAccount();

        assertThatThrownBy(() -> profiles.changePassword(id, null,
                new UserDtos.ChangePasswordRequest("qualsiasi", "Password123!")))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Forgot password")
                .extracting(ex -> ((ApiException) ex).getStatus())
                .isEqualTo(HttpStatus.BAD_REQUEST);
    }

    // ─── Cambio email dall'area personale ─────────────────────────────────────

    @Test
    void changeEmailIsRefusedWithoutAPassword() {
        var id = googleOnlyAccount();

        assertThatThrownBy(() -> profiles.requestEmailChange(id,
                new UserDtos.ChangeEmailRequest("nuova." + UUID.randomUUID() + "@example.com", "qualsiasi")))
                .isInstanceOf(ApiException.class)
                .extracting(ex -> ((ApiException) ex).getStatus())
                .isEqualTo(HttpStatus.BAD_REQUEST);
    }

    // ─── La via d'uscita: impostare una password ──────────────────────────────

    @Test
    void forgotPasswordIsTheWayToAddAPasswordToAGoogleAccount() {
        var id = googleOnlyAccount();

        // Nessuna password da confermare: il link arriva sulla casella, che Google ha
        // gia' dimostrato essere di questa persona. E' la via d'uscita citata nei
        // messaggi d'errore qui sopra, quindi deve funzionare davvero.
        profiles.requestPasswordReset(email);

        var user = users.findById(id).orElseThrow();
        assertThat(user.hasPassword()).isFalse();
    }

    @Test
    void afterResettingThePasswordBothWaysInWorkTogether() {
        var id = googleOnlyAccount();

        // Si simula il link ricevuto per email: il token in chiaro esiste solo li',
        // nel database c'e' solo la sua impronta.
        String token = "token-di-prova-" + UUID.randomUUID();
        var row = new PasswordReset();
        row.setUserId(id);
        row.setTokenHash(jwt.fingerprint(token));
        row.setExpiresAt(LocalDateTime.now().plusHours(1));
        resets.save(row);

        profiles.resetPassword(token, "NuovaPassword1");

        assertThat(users.findById(id).orElseThrow().hasPassword()).isTrue();
        // Da qui in avanti l'account ha due porte, e devono restare aperte entrambe.
        assertThat(auth.login(email, "NuovaPassword1", "JUnit").token()).isNotBlank();
        var sub = users.findById(id).orElseThrow().getGoogleSub();
        assertThat(google.signIn(new GoogleIdentity(sub, email, true, "Mario Rossi"), "JUnit").user().getId())
                .isEqualTo(id);
    }

    // ─── Cancellazione dell'account (GDPR art. 17) ────────────────────────────

    @Test
    void aGoogleAccountCanBeErasedByTypingItsEmailAddress() {
        var id = googleOnlyAccount();

        // Senza questo, l'unica conferma prevista era la password: un account Google
        // non ne ha, `matches(x, null)` risponde sempre `false`, e il diritto alla
        // cancellazione diventava inesigibile dal browser.
        privacy.eraseAccount(id, email);

        var erased = users.findById(id).orElseThrow();
        assertThat(erased.getDeletedAt()).isNotNull();
        assertThat(erased.getGoogleSub())
                .as("il collegamento va sciolto, altrimenti quell'account Google resta appeso a una riga cancellata e non potra' mai piu' registrarsi")
                .isNull();
    }

    @Test
    void erasingAGoogleAccountWithTheWrongConfirmationIsRefused() {
        var id = googleOnlyAccount();

        assertThatThrownBy(() -> privacy.eraseAccount(id, "qualsiasi-cosa"))
                .isInstanceOf(ApiException.class)
                .extracting(ex -> ((ApiException) ex).getStatus())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void anAccountWithAPasswordStillNeedsThePasswordToBeErased() {
        // La corsia nuova non deve aprire una scorciatoia su quella vecchia: chi ha
        // una password continua a doverla digitare, e l'indirizzo email non basta.
        String withPassword = "cliente." + UUID.randomUUID() + "@example.com";
        var user = auth.register(withPassword, "Password123!", "Cliente Prova");

        assertThatThrownBy(() -> privacy.eraseAccount(user.getId(), withPassword))
                .isInstanceOf(ApiException.class)
                .extracting(ex -> ((ApiException) ex).getStatus())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
    }
}
