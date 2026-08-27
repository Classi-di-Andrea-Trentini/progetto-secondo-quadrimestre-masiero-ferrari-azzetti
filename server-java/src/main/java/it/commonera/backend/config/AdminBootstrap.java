package it.commonera.backend.config;

import it.commonera.backend.entities.User;
import it.commonera.backend.repositories.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * Primo amministratore da variabili d'ambiente.
 *
 * Su un'installazione nuova l'unico amministratore era quello del seed di scuola,
 * con una password che nessuno conosce: senza questo, per entrare nel pannello
 * bisognava scrivere a mano un hash BCrypt dentro Postgres.
 *
 * Regole volutamente prudenti:
 * - non fa niente se le due variabili non ci sono (il caso normale in sviluppo);
 * - se l'indirizzo esiste gia', **non tocca la password** — cambiarla all'avvio
 *   sarebbe un modo silenzioso di scavalcare un account altrui: al massimo
 *   promuove l'utente ad amministratore, e lo scrive nei log;
 * - la password deve essere lunga almeno 8 caratteri, come per chiunque altro.
 */
@Component
public class AdminBootstrap implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminBootstrap.class);

    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final String email;
    private final String password;
    private final String fullName;

    public AdminBootstrap(UserRepository users, PasswordEncoder encoder,
                          @Value("${app.bootstrap.admin-email:}") String email,
                          @Value("${app.bootstrap.admin-password:}") String password,
                          @Value("${app.bootstrap.admin-name:Amministratore}") String fullName) {
        this.users = users;
        this.encoder = encoder;
        this.email = email == null ? "" : email.trim().toLowerCase();
        this.password = password == null ? "" : password;
        this.fullName = fullName;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (email.isBlank() || password.isBlank()) return;

        if (password.length() < 8) {
            log.error("ADMIN_PASSWORD piu' corta di 8 caratteri: amministratore non creato");
            return;
        }

        var existing = users.findByEmailIgnoreCase(email);
        if (existing.isPresent()) {
            var user = existing.get();
            if (user.getRole() != User.Role.admin) {
                user.setRole(User.Role.admin);
                users.save(user);
                log.info("Utente {} promosso ad amministratore", email);
            }
            return;
        }

        var admin = new User();
        admin.setEmail(email);
        admin.setPasswordHash(encoder.encode(password));
        admin.setFullName(fullName);
        admin.setRole(User.Role.admin);
        // Stesso trattamento della registrazione: senza un vero flusso di verifica
        // email un amministratore non verificato non potrebbe nemmeno entrare.
        admin.setEmailVerifiedAt(LocalDateTime.now());
        users.save(admin);
        log.info("Creato l'amministratore iniziale {}", email);
    }
}
