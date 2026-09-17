package it.commonera.backend.services;

import it.commonera.backend.AbstractIntegrationTest;
import it.commonera.backend.dtos.UserDtos;
import it.commonera.backend.entities.PasswordReset;
import it.commonera.backend.entities.Session;
import it.commonera.backend.entities.User;
import it.commonera.backend.exceptions.ApiException;
import it.commonera.backend.repositories.PasswordResetRepository;
import it.commonera.backend.repositories.SessionRepository;
import it.commonera.backend.repositories.UserRepository;
import it.commonera.backend.security.JwtService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * L'area profilo: nel backend Java non esisteva affatto (nessun `/users/**` oltre a
 * quelli admin), quindi la tab "Impostazioni" di `/me` falliva su ogni pulsante.
 *
 * Qui si coprono i due punti dove un errore costa davvero: le sessioni che devono
 * cadere quando la password cambia, e il token di reimpostazione che deve valere
 * una volta sola.
 */
class UserServiceTest extends AbstractIntegrationTest {

    @Autowired
    private UserService profiles;
    @Autowired
    private UserRepository users;
    @Autowired
    private SessionRepository sessions;
    @Autowired
    private PasswordResetRepository resets;
    @Autowired
    private PasswordEncoder encoder;
    @Autowired
    private JwtService jwt;
    @PersistenceContext
    private EntityManager em;

    private User user;

    @BeforeEach
    void setUp() {
        user = new User();
        user.setEmail("profilo." + UUID.randomUUID() + "@example.com");
        user.setPasswordHash(encoder.encode("Password123"));
        user.setFullName("Cliente Prova");
        user.setEmailVerifiedAt(LocalDateTime.now());
        user = users.save(user);
        em.flush();
    }

    @Test
    void changingThePasswordDropsTheOtherSessionsAndKeepsTheCurrentOne() {
        var current = session();
        var otherDevice = session();

        profiles.changePassword(user.getId(), current.getId(),
                new UserDtos.ChangePasswordRequest("Password123", "NuovaPassword1"));
        em.flush();
        em.clear();

        // Se qualcuno era entrato con la vecchia password, lasciargli il cookie
        // valido vanificherebbe il cambio.
        assertThat(sessions.findById(otherDevice.getId())).isEmpty();
        assertThat(sessions.findById(current.getId())).isPresent();
        assertThat(encoder.matches("NuovaPassword1", users.findById(user.getId()).orElseThrow().getPasswordHash()))
                .isTrue();
    }

    @Test
    void theCurrentPasswordHasToBeRight() {
        assertThatThrownBy(() -> profiles.changePassword(user.getId(), null,
                new UserDtos.ChangePasswordRequest("Sbagliata1", "NuovaPassword1")))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Current password");
    }

    @Test
    void aResetTokenWorksOnceAndTakesEverySessionDownWithIt() {
        var loggedIn = session();
        String token = "token-di-prova-" + UUID.randomUUID();

        var reset = new PasswordReset();
        reset.setUserId(user.getId());
        // Nel database c'e' l'hash, non il token: e' cosi' che lo scrive il servizio.
        reset.setTokenHash(jwt.fingerprint(token));
        reset.setExpiresAt(LocalDateTime.now().plusHours(1));
        resets.save(reset);
        em.flush();

        profiles.resetPassword(token, "Reimpostata123");
        em.flush();
        em.clear();

        assertThat(encoder.matches("Reimpostata123", users.findById(user.getId()).orElseThrow().getPasswordHash()))
                .isTrue();
        // Chi reimposta da un link non e' collegato, e chi lo era potrebbe essere
        // l'intruso: cadono tutte.
        assertThat(sessions.findById(loggedIn.getId())).isEmpty();

        assertThatThrownBy(() -> profiles.resetPassword(token, "Ancora1234"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Invalid or expired token");
    }

    @Test
    void anExpiredResetTokenIsRefused() {
        String token = "token-scaduto-" + UUID.randomUUID();
        var reset = new PasswordReset();
        reset.setUserId(user.getId());
        reset.setTokenHash(jwt.fingerprint(token));
        reset.setExpiresAt(LocalDateTime.now().minusMinutes(1));
        resets.save(reset);
        em.flush();

        assertThatThrownBy(() -> profiles.resetPassword(token, "Reimpostata123"))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void theProfileFormOnlyTouchesTheFieldsItSends() {
        profiles.updateProfile(user.getId(), new UserDtos.UpdateProfileRequest(
                "Nome Nuovo", "3331234567", "1999-05-04", "altro", true));
        em.flush();
        em.clear();

        var saved = users.findById(user.getId()).orElseThrow();
        assertThat(saved.getFullName()).isEqualTo("Nome Nuovo");
        assertThat(saved.getBirthDate()).isEqualTo("1999-05-04");

        // Solo il telefono: il nome non deve tornare vuoto perche' non era nel corpo.
        profiles.updateProfile(user.getId(), new UserDtos.UpdateProfileRequest(
                null, "3339999999", null, null, null));
        em.flush();
        em.clear();

        var afterPartialUpdate = users.findById(user.getId()).orElseThrow();
        assertThat(afterPartialUpdate.getFullName()).isEqualTo("Nome Nuovo");
        assertThat(afterPartialUpdate.getPhone()).isEqualTo("3339999999");
        assertThat(afterPartialUpdate.getNewsletterOptIn()).isTrue();
    }

    @Test
    void changingEmailToOneAlreadyTakenIsRefused() {
        var other = new User();
        other.setEmail("occupata." + UUID.randomUUID() + "@example.com");
        other.setPasswordHash(encoder.encode("Password123"));
        other.setFullName("Altro Cliente");
        users.save(other);
        em.flush();

        assertThatThrownBy(() -> profiles.requestEmailChange(user.getId(),
                new UserDtos.ChangeEmailRequest(other.getEmail(), "Password123")))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("already in use");
    }

    private Session session() {
        var session = new Session();
        session.setUserId(user.getId());
        session.setTokenHash("hash-" + UUID.randomUUID());
        session.setExpiresAt(LocalDateTime.now().plusDays(7));
        var saved = sessions.save(session);
        em.flush();
        return saved;
    }
}
