package it.commonera.backend.services;

import it.commonera.backend.dtos.UserDtos;
import it.commonera.backend.entities.EmailVerification;
import it.commonera.backend.entities.PasswordReset;
import it.commonera.backend.entities.User;
import it.commonera.backend.exceptions.ApiException;
import it.commonera.backend.repositories.EmailVerificationRepository;
import it.commonera.backend.repositories.PasswordResetRepository;
import it.commonera.backend.repositories.SessionRepository;
import it.commonera.backend.repositories.UserRepository;
import it.commonera.backend.security.JwtService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;

/**
 * Il profilo dal punto di vista di chi lo possiede: dati anagrafici, password,
 * indirizzo email, verifica.
 *
 * Sta separato da {@link AuthService} (che si occupa di entrare e uscire) e da
 * {@link AdminService} (che si occupa degli utenti *altrui*).
 */
@Service
public class UserService {

    private static final Duration VERIFICATION_TTL = Duration.ofHours(24);
    private static final Duration RESET_TTL = Duration.ofHours(1);
    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserRepository users;
    private final SessionRepository sessions;
    private final EmailVerificationRepository verifications;
    private final PasswordResetRepository resets;
    private final PasswordEncoder encoder;
    private final JwtService jwt;
    private final MailService mail;
    private final String frontendUrl;
    private final String backendUrl;

    public UserService(UserRepository users, SessionRepository sessions,
                       EmailVerificationRepository verifications, PasswordResetRepository resets,
                       PasswordEncoder encoder, JwtService jwt, MailService mail,
                       @Value("${app.frontend-url}") String frontendUrl,
                       @Value("${app.backend-url}") String backendUrl) {
        this.users = users;
        this.sessions = sessions;
        this.verifications = verifications;
        this.resets = resets;
        this.encoder = encoder;
        this.jwt = jwt;
        this.mail = mail;
        this.frontendUrl = frontendUrl;
        this.backendUrl = backendUrl;
    }

    // ─── Profilo ──────────────────────────────────────────────────────────────

    @Transactional
    public User updateProfile(UUID userId, UserDtos.UpdateProfileRequest body) {
        var user = require(userId);

        // Solo i campi presenti nel corpo vengono toccati: la form di /me manda una
        // sezione alla volta, e un `null` di "non l'ho mandato" non deve cancellare
        // quello che c'era.
        if (body.fullName() != null) user.setFullName(body.fullName().trim());
        if (body.phone() != null) user.setPhone(body.phone().isBlank() ? null : body.phone().trim());
        if (body.gender() != null) user.setGender(body.gender().isBlank() ? null : body.gender().trim());
        if (body.newsletterOptIn() != null) user.setNewsletterOptIn(body.newsletterOptIn());
        if (body.birthDate() != null) {
            user.setBirthDate(parseBirthDate(body.birthDate()));
        }

        return users.save(user);
    }

    private LocalDate parseBirthDate(String raw) {
        if (raw.isBlank()) return null;
        try {
            // L'input `type="date"` manda `YYYY-MM-DD`, ma un client puo' mandare un
            // ISO completo: si tiene la sola parte della data.
            return LocalDate.parse(raw.length() > 10 ? raw.substring(0, 10) : raw);
        } catch (DateTimeParseException e) {
            throw ApiException.badRequest("Invalid date of birth");
        }
    }

    // ─── Password ─────────────────────────────────────────────────────────────

    @Transactional
    public String changePassword(UUID userId, UUID currentSessionId, UserDtos.ChangePasswordRequest body) {
        var user = require(userId);

        // Chi e' entrato con Google non ha nessuna "password attuale" da confermare:
        // senza questo controllo `matches(x, null)` risponderebbe sempre `false` e la
        // pagina direbbe "Password attuale non corretta" a chi una password non l'ha
        // mai avuta. La via per impostarne una e' il link di reimpostazione, che
        // arriva sulla casella — la stessa che Google ha gia' dimostrato essere sua.
        if (!user.hasPassword()) {
            throw ApiException.badRequest(
                    "Your account signs in with Google and doesn't have a password yet. "
                            + "Use \"Forgot password\" to set one.");
        }

        if (!encoder.matches(body.currentPassword(), user.getPasswordHash())) {
            throw ApiException.unauthorized("Current password is incorrect");
        }

        user.setPasswordHash(encoder.encode(body.newPassword()));
        users.save(user);

        // Le altre sessioni cadono: se la password si cambia perche' qualcuno era
        // entrato, lasciargli il cookie valido vanifica il cambio. Quella corrente
        // resta, altrimenti chi ha appena cambiato password viene buttato fuori.
        if (currentSessionId != null) {
            sessions.deleteByUserIdAndIdNot(userId, currentSessionId);
        } else {
            sessions.deleteByUserId(userId);
        }

        mail.sendPasswordChangedAlert(user.getEmail(), user.getFullName());
        return "Password updated successfully";
    }

    /**
     * Richiesta di reimpostazione.
     *
     * Risponde allo stesso modo sia che l'indirizzo esista sia che non esista: una
     * risposta diversa trasforma questa rotta in un elenco di clienti registrati.
     */
    @Transactional
    public void requestPasswordReset(String email) {
        var found = users.findByEmailIgnoreCase(email)
                .filter(u -> u.getDeletedAt() == null && Boolean.TRUE.equals(u.getIsActive()));
        if (found.isEmpty()) return;

        var user = found.get();
        resets.deleteByUserId(user.getId());

        String token = randomToken();
        var reset = new PasswordReset();
        reset.setUserId(user.getId());
        // Nel database va l'hash: il token in chiaro esiste solo dentro l'email.
        reset.setTokenHash(jwt.fingerprint(token));
        reset.setExpiresAt(LocalDateTime.now().plus(RESET_TTL));
        resets.save(reset);

        mail.sendPasswordResetEmail(user.getEmail(), user.getFullName(), token);
    }

    @Transactional
    public String resetPassword(String token, String newPassword) {
        var reset = resets.findByTokenHashAndUsedAtIsNull(jwt.fingerprint(token))
                .filter(r -> r.getExpiresAt().isAfter(LocalDateTime.now()))
                .orElseThrow(() -> ApiException.badRequest("Invalid or expired token"));

        var user = require(reset.getUserId());
        user.setPasswordHash(encoder.encode(newPassword));
        users.save(user);

        reset.setUsedAt(LocalDateTime.now());
        resets.save(reset);

        // Qui cadono **tutte** le sessioni, corrente compresa: chi reimposta da un
        // link non e' loggato, e chi lo era potrebbe essere l'intruso.
        sessions.deleteByUserId(user.getId());

        mail.sendPasswordChangedAlert(user.getEmail(), user.getFullName());
        return "Password reset successfully";
    }

    // ─── Email ────────────────────────────────────────────────────────────────

    @Transactional
    public String sendVerificationEmail(UUID userId) {
        var user = require(userId);
        if (user.getEmailVerifiedAt() != null) {
            throw ApiException.badRequest("Email already verified");
        }

        String token = issueVerificationToken(user, "email-verify", Map.of());
        mail.sendEmailVerification(user.getEmail(), user.getFullName(),
                frontendUrl + "/verify-email/" + token);
        return "Verification email sent. You have 24 hours to confirm.";
    }

    @Transactional
    public String confirmVerification(String token) {
        var claims = jwt.parsePurposeToken(token, "email-verify");
        if (claims == null) throw ApiException.unauthorized("Invalid or expired link");

        var row = consume(token);
        var user = require(claims.userId());
        user.setEmailVerifiedAt(LocalDateTime.now());
        users.save(user);
        verifications.save(row);

        return "Email verified successfully";
    }

    @Transactional
    public String requestEmailChange(UUID userId, UserDtos.ChangeEmailRequest body) {
        var user = require(userId);

        // Stesso motivo del cambio password: senza una password non c'e' niente da
        // confrontare, e cambiare l'indirizzo e' proprio l'operazione che una
        // conferma la vuole (sposta dove arrivano i link di recupero).
        if (!user.hasPassword()) {
            throw ApiException.badRequest(
                    "Your account signs in with Google and doesn't have a password yet. "
                            + "Set one from \"Forgot password\" before changing your email address.");
        }

        if (!encoder.matches(body.currentPassword(), user.getPasswordHash())) {
            throw ApiException.unauthorized("Current password is incorrect");
        }

        String newEmail = body.newEmail().trim().toLowerCase();
        if (newEmail.equalsIgnoreCase(user.getEmail())) {
            throw ApiException.badRequest("This is already your address");
        }
        if (users.findByEmailIgnoreCase(newEmail).filter(other -> !other.getId().equals(userId)).isPresent()) {
            throw ApiException.badRequest("Email already in use");
        }

        String token = issueVerificationToken(user, "email-change", Map.of("newEmail", newEmail));
        // Il link porta al **backend**: la conferma cambia un dato, non apre una pagina.
        mail.sendEmailChangeConfirmation(newEmail, user.getFullName(),
                backendUrl + "/api/users/confirm-email/" + token);

        return "We've sent a confirmation link to your new email. You have 24 hours to confirm it.";
    }

    @Transactional
    public String confirmEmailChange(String token) {
        var claims = jwt.parsePurposeToken(token, "email-change");
        if (claims == null || claims.newEmail() == null) {
            throw ApiException.unauthorized("Invalid or expired link");
        }

        var row = consume(token);
        var user = require(claims.userId());

        // Ricontrollato adesso e non solo alla richiesta: fra il click e l'email
        // possono essere passate ore, e l'indirizzo puo' essere stato preso.
        if (users.findByEmailIgnoreCase(claims.newEmail())
                .filter(other -> !other.getId().equals(user.getId())).isPresent()) {
            throw ApiException.badRequest("Email already in use by another account");
        }

        String previousEmail = user.getEmail();
        user.setEmail(claims.newEmail());
        user.setEmailVerifiedAt(LocalDateTime.now());
        users.save(user);
        verifications.save(row);

        mail.sendEmailChangedAlert(previousEmail, user.getFullName(), claims.newEmail());
        return "Email confirmed and updated successfully";
    }

    // ─── Utilita' ─────────────────────────────────────────────────────────────

    private String issueVerificationToken(User user, String purpose, Map<String, String> extra) {
        // Una richiesta nuova annulla la precedente: due link validi insieme sono due
        // modi di cambiare lo stesso dato.
        verifications.deleteByUserId(user.getId());

        String token = jwt.issuePurposeToken(user.getId(), purpose, extra, VERIFICATION_TTL);
        var row = new EmailVerification();
        row.setUserId(user.getId());
        row.setToken(token);
        row.setExpiresAt(LocalDateTime.now().plus(VERIFICATION_TTL));
        verifications.save(row);
        return token;
    }

    /**
     * La riga del token, marcata come usata.
     *
     * La firma dice che il token e' autentico, non che il link non e' gia' stato
     * cliccato: e' questa riga a renderlo valido una volta sola.
     */
    private EmailVerification consume(String token) {
        var row = verifications.findByToken(token)
                .orElseThrow(() -> ApiException.unauthorized("Link already used or not found"));
        if (row.getUsedAt() != null) throw ApiException.unauthorized("Link already used");
        if (row.getExpiresAt().isBefore(LocalDateTime.now())) throw ApiException.unauthorized("Link expired");
        row.setUsedAt(LocalDateTime.now());
        return row;
    }

    private User require(UUID userId) {
        return users.findById(userId)
                .filter(u -> u.getDeletedAt() == null)
                .orElseThrow(() -> ApiException.unauthorized("Unauthorized"));
    }

    private static String randomToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }
}
