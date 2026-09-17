package it.commonera.backend.services;

import it.commonera.backend.AbstractIntegrationTest;
import it.commonera.backend.entities.User;
import it.commonera.backend.exceptions.ApiException;
import it.commonera.backend.repositories.SessionRepository;
import it.commonera.backend.repositories.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

import java.time.LocalDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Le regole di fusione fra un'identita' Google e un account gia' esistente.
 *
 * E' il punto in cui si perde un account, quindi qui i test contano piu' del
 * codice. Il caso che li giustifica tutti e' {@link #unverifiedExistingEmailIsRefused()}:
 * collegare alla cieca "stessa email = stessa persona" regalerebbe l'account a
 * chiunque abbia registrato l'indirizzo di un altro senza mai dimostrare di
 * possederlo. Un indirizzo non verificato non prova niente.
 */
class GoogleAccountLinkTest extends AbstractIntegrationTest {

    @Autowired
    private GoogleAccountService google;

    @Autowired
    private AuthService auth;

    @Autowired
    private UserRepository users;

    @Autowired
    private SessionRepository sessions;

    private static String freshEmail() {
        return "google." + UUID.randomUUID() + "@example.com";
    }

    private static String freshSub() {
        return "sub-" + UUID.randomUUID();
    }

    /** Un utente registrato ma che non ha mai confermato il proprio indirizzo. */
    private User unverifiedUser(String email, String password) {
        var user = new User();
        user.setEmail(email);
        user.setPasswordHash("$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy");
        user.setFullName("Utente Non Verificato");
        user.setEmailVerifiedAt(null);
        return users.save(user);
    }

    // ─── Account nuovo ────────────────────────────────────────────────────────

    @Test
    void unknownEmailCreatesAPasswordlessVerifiedAccount() {
        String email = freshEmail();
        String sub = freshSub();

        var issued = google.signIn(new GoogleIdentity(sub, email, true, "Mario Rossi"), "JUnit");

        assertThat(issued.token()).isNotBlank();
        var created = users.findByEmailIgnoreCase(email).orElseThrow();
        assertThat(created.getGoogleSub()).isEqualTo(sub);
        assertThat(created.hasPassword())
                .as("chi entra con Google non sceglie nessuna password")
                .isFalse();
        assertThat(created.isEmailVerified())
                .as("l'indirizzo e' gia' dimostrato da Google, non serve una seconda conferma")
                .isTrue();
        assertThat(created.getFullName()).isEqualTo("Mario Rossi");
        assertThat(sessions.findAll().stream().anyMatch(s -> s.getUserId().equals(created.getId())))
                .as("il giro deve finire con una sessione vera, come il login normale")
                .isTrue();
    }

    @Test
    void aMissingNameFallsBackToTheEmailLocalPart() {
        // `full_name` e' NOT NULL: se Google non manda il nome bisogna metterci
        // qualcosa, altrimenti l'inserimento fallisce e l'accesso non riesce mai.
        String email = "senzanome." + UUID.randomUUID() + "@example.com";

        google.signIn(new GoogleIdentity(freshSub(), email, true, null), "JUnit");

        var created = users.findByEmailIgnoreCase(email).orElseThrow();
        assertThat(created.getFullName()).isEqualTo(email.substring(0, email.indexOf('@')));
    }

    // ─── Fusione con un account esistente ─────────────────────────────────────

    @Test
    void verifiedExistingEmailIsLinkedToTheSameAccount() {
        String email = freshEmail();
        var existing = auth.register(email, "Password123!", "Cliente Prova");
        assertThat(existing.isEmailVerified()).isTrue();

        var issued = google.signIn(new GoogleIdentity("sub-collegato", email, true, "Cliente Google"), "JUnit");

        assertThat(issued.user().getId())
                .as("stessa persona: nessun secondo account con lo stesso indirizzo")
                .isEqualTo(existing.getId());
        var linked = users.findById(existing.getId()).orElseThrow();
        assertThat(linked.getGoogleSub()).isEqualTo("sub-collegato");
        assertThat(linked.hasPassword())
                .as("collegare Google non deve togliere la password gia' scelta")
                .isTrue();
        assertThat(users.findByEmailIgnoreCase(email)).isPresent();
    }

    @Test
    void theExistingNameIsNotOverwrittenByGoogle() {
        String email = freshEmail();
        var existing = auth.register(email, "Password123!", "Nome Scelto Dall'Utente");

        google.signIn(new GoogleIdentity(freshSub(), email, true, "Nome Di Google"), "JUnit");

        assertThat(users.findById(existing.getId()).orElseThrow().getFullName())
                .as("il profilo e' dell'utente: Google si collega, non riscrive")
                .isEqualTo("Nome Scelto Dall'Utente");
    }

    /**
     * Il caso per cui esiste questa classe.
     *
     * Chiunque puo' registrare `vittima@example.com` senza mai aprire quella casella.
     * Se bastasse l'indirizzo per collegare, al primo "Accedi con Google" della vittima
     * il suo account Google finirebbe dentro l'account dell'altro.
     */
    @Test
    void unverifiedExistingEmailIsRefused() {
        String email = freshEmail();
        var squatter = unverifiedUser(email, "qualsiasi");

        assertThatThrownBy(() -> google.signIn(new GoogleIdentity(freshSub(), email, true, "Vittima"), "JUnit"))
                .isInstanceOf(ApiException.class)
                .extracting(ex -> ((ApiException) ex).getStatus())
                .isEqualTo(HttpStatus.CONFLICT);

        var untouched = users.findById(squatter.getId()).orElseThrow();
        assertThat(untouched.getGoogleSub())
                .as("il rifiuto deve lasciare l'account esattamente com'era")
                .isNull();
    }

    @Test
    void theRefusalExplainsHowToGetOut() {
        String email = freshEmail();
        unverifiedUser(email, "qualsiasi");

        assertThatThrownBy(() -> google.signIn(new GoogleIdentity(freshSub(), email, true, "Vittima"), "JUnit"))
                .hasMessageContaining("password");
    }

    @Test
    void googleIdentityWithAnUnverifiedEmailIsRefused() {
        // `email_verified: false` vuol dire che nemmeno Google sa se l'indirizzo e'
        // di chi sta entrando: accettarlo equivarrebbe a fidarsi di un campo scritto
        // a mano.
        String email = freshEmail();

        assertThatThrownBy(() -> google.signIn(new GoogleIdentity(freshSub(), email, false, "Tale"), "JUnit"))
                .isInstanceOf(ApiException.class)
                .extracting(ex -> ((ApiException) ex).getStatus())
                .isEqualTo(HttpStatus.UNAUTHORIZED);

        assertThat(users.findByEmailIgnoreCase(email))
                .as("un'identita' non verificata non deve creare nessun account")
                .isEmpty();
    }

    // ─── Ritorni ──────────────────────────────────────────────────────────────

    @Test
    void aReturningUserIsMatchedBySubEvenIfTheGoogleEmailChanged() {
        String firstEmail = freshEmail();
        String sub = freshSub();
        google.signIn(new GoogleIdentity(sub, firstEmail, true, "Mario Rossi"), "JUnit");
        var created = users.findByEmailIgnoreCase(firstEmail).orElseThrow();

        // Stesso account Google, indirizzo nuovo: e' il motivo per cui si conserva il
        // `sub` e non l'email.
        String newEmail = freshEmail();
        var issued = google.signIn(new GoogleIdentity(sub, newEmail, true, "Mario Rossi"), "JUnit");

        assertThat(issued.user().getId()).isEqualTo(created.getId());
        assertThat(users.findByEmailIgnoreCase(newEmail))
                .as("nessun account duplicato: il `sub` vince sull'indirizzo")
                .isEmpty();
        assertThat(users.findById(created.getId()).orElseThrow().getEmail())
                .as("l'indirizzo del nostro account non lo cambia Google: lo cambia il suo proprietario")
                .isEqualTo(firstEmail);
    }

    @Test
    void anAccountAlreadyLinkedToAnotherGoogleIdentityIsRefused() {
        String email = freshEmail();
        google.signIn(new GoogleIdentity("sub-primo", email, true, "Mario Rossi"), "JUnit");

        // Stesso indirizzo, ma un `sub` diverso: o l'indirizzo e' stato riassegnato,
        // o qualcuno sta provando a sovrascrivere il collegamento. In entrambi i casi
        // non si tocca niente da soli.
        assertThatThrownBy(() -> google.signIn(new GoogleIdentity("sub-secondo", email, true, "Altro"), "JUnit"))
                .isInstanceOf(ApiException.class)
                .extracting(ex -> ((ApiException) ex).getStatus())
                .isEqualTo(HttpStatus.CONFLICT);

        assertThat(users.findByEmailIgnoreCase(email).orElseThrow().getGoogleSub()).isEqualTo("sub-primo");
    }

    // ─── Account chiusi o sospesi ─────────────────────────────────────────────

    @Test
    void aSoftDeletedAccountIsNotResurrectedByGoogle() {
        String email = freshEmail();
        var user = auth.register(email, "Password123!", "Cliente Prova");
        user.setDeletedAt(LocalDateTime.now());
        users.save(user);

        assertThatThrownBy(() -> google.signIn(new GoogleIdentity(freshSub(), email, true, "Cliente"), "JUnit"))
                .isInstanceOf(ApiException.class)
                .extracting(ex -> ((ApiException) ex).getStatus())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void aDeactivatedAccountCannotComeBackThroughGoogle() {
        // Un account sospeso da un amministratore non deve poter rientrare da una
        // porta laterale.
        String email = freshEmail();
        var user = auth.register(email, "Password123!", "Cliente Prova");
        user.setIsActive(false);
        users.save(user);

        assertThatThrownBy(() -> google.signIn(new GoogleIdentity(freshSub(), email, true, "Cliente"), "JUnit"))
                .isInstanceOf(ApiException.class)
                .extracting(ex -> ((ApiException) ex).getStatus())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void aLinkedAccountDeactivatedLaterCannotLogInWithGoogleEither() {
        String email = freshEmail();
        String sub = freshSub();
        google.signIn(new GoogleIdentity(sub, email, true, "Mario Rossi"), "JUnit");

        var user = users.findByEmailIgnoreCase(email).orElseThrow();
        user.setIsActive(false);
        users.save(user);

        assertThatThrownBy(() -> google.signIn(new GoogleIdentity(sub, email, true, "Mario Rossi"), "JUnit"))
                .isInstanceOf(ApiException.class)
                .extracting(ex -> ((ApiException) ex).getStatus())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    // ─── Normalizzazione ──────────────────────────────────────────────────────

    @Test
    void theEmailIsMatchedCaseInsensitively() {
        String email = freshEmail();
        var existing = auth.register(email, "Password123!", "Cliente Prova");

        var issued = google.signIn(
                new GoogleIdentity(freshSub(), email.toUpperCase(), true, "Cliente"), "JUnit");

        assertThat(issued.user().getId())
                .as("Mario@x.it e mario@x.it sono la stessa casella: il confronto non puo' essere sensibile al maiuscolo")
                .isEqualTo(existing.getId());
    }
}
