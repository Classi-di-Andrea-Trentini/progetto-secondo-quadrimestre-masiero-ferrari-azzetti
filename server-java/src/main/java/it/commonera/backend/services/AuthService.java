package it.commonera.backend.services;

import it.commonera.backend.entities.Session;
import it.commonera.backend.entities.User;
import it.commonera.backend.exceptions.ApiException;
import it.commonera.backend.repositories.SessionRepository;
import it.commonera.backend.repositories.UserRepository;
import it.commonera.backend.security.JwtService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
public class AuthService {

    private final UserRepository users;
    private final SessionRepository sessions;
    private final PasswordEncoder encoder;
    private final JwtService jwt;

    public AuthService(UserRepository users, SessionRepository sessions, PasswordEncoder encoder, JwtService jwt) {
        this.users = users;
        this.sessions = sessions;
        this.encoder = encoder;
        this.jwt = jwt;
    }

    @Transactional
    public User register(String email, String password, String fullName) {
        if (users.existsByEmailIgnoreCase(email)) {
            throw ApiException.badRequest("Email gia' registrata");
        }

        var user = new User();
        user.setEmail(email.trim().toLowerCase());
        user.setPasswordHash(encoder.encode(password));
        user.setFullName(fullName.trim());
        return users.save(user);
    }

    /**
     * Login.
     *
     * L'hash viene verificato **anche quando l'utente non esiste**, contro un hash
     * fittizio: senza, il tempo di risposta direbbe a chi prova se un indirizzo e'
     * registrato o no. E' la stessa precauzione presa nel backend Node.
     */
    @Transactional
    public Issued login(String email, String password, String userAgent) {
        var found = users.findByEmailIgnoreCase(email)
                .filter(u -> u.getDeletedAt() == null && Boolean.TRUE.equals(u.getIsActive()));

        String hash = found.map(User::getPasswordHash).orElse(DUMMY_HASH);
        boolean ok = encoder.matches(password, hash);

        if (found.isEmpty() || !ok) {
            throw ApiException.unauthorized("Credenziali non valide");
        }

        var user = found.get();
        if (!user.isEmailVerified()) {
            throw ApiException.unauthorized("Account non verificato");
        }

        var session = new Session();
        session.setUserId(user.getId());
        session.setExpiresAt(LocalDateTime.now().plusSeconds(jwt.ttlSeconds()));
        session.setUserAgent(userAgent);
        // L'impronta si puo' calcolare solo dopo aver emesso il token, che a sua
        // volta ha bisogno dell'id della sessione: si salva due volte, ed e' il
        // motivo per cui questo metodo e' transazionale.
        session.setTokenHash("pending");
        var saved = sessions.save(session);

        String token = jwt.issue(user.getId(), saved.getId());
        saved.setTokenHash(jwt.fingerprint(token));
        sessions.save(saved);

        user.setLastLoginAt(LocalDateTime.now());
        return new Issued(user, token);
    }

    @Transactional
    public void logout(String token) {
        if (token != null) sessions.deleteByTokenHash(jwt.fingerprint(token));
    }

    /**
     * Hash BCrypt di una password inesistente, usato solo per far durare il
     * confronto anche quando l'utente non c'e'.
     */
    private static final String DUMMY_HASH =
            "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

    public record Issued(User user, String token) {}
}
