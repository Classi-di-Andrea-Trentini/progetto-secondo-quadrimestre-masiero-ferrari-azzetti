package it.commonera.backend.security;

import org.springframework.security.config.annotation.web.builders.HttpSecurity;

/**
 * L'unico punto in cui l'accesso con Google tocca {@code SecurityConfig}.
 *
 * Esiste per tenere fuori da quel file tutta la configurazione OAuth: {@code
 * SecurityConfig} e' condiviso e riordinare le sue regole e' il modo piu' rapido per
 * rompere l'autenticazione di tutto il resto. Qui il contratto e' una riga sola —
 * "applica quello che devi applicare" — e chi non ha le credenziali di Google
 * riceve l'implementazione {@link #disabled()}, che non applica niente: nessuna
 * rotta OAuth viene registrata e l'applicazione parte identica a prima.
 */
@FunctionalInterface
public interface GoogleLoginCustomizer {

    void applyTo(HttpSecurity http) throws Exception;

    /** Senza credenziali non si registra nessuna rotta. */
    static GoogleLoginCustomizer disabled() {
        return http -> { };
    }
}
