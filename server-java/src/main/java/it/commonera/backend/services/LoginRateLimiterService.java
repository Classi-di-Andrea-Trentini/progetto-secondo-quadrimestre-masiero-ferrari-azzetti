package it.commonera.backend.services;

import it.commonera.backend.exceptions.ApiException;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Limitatore dei tentativi di login.
 *
 * In memoria, non su database: non deve sopravvivere a un riavvio, deve solo
 * impedire che qualcuno tenti migliaia di password sullo stesso account senza
 * pause. Chiave per identificativo (l'email mandata al login, non l'IP: e' gia'
 * quello che il controller riceve, e regge anche dietro un proxy che non passa
 * l'IP reale).
 */
@Service
public class LoginRateLimiterService {

    /** Oltre questi fallimenti, l'account e' bloccato per il resto della finestra. */
    private static final int MAX_ATTEMPTS = 5;
    private static final Duration WINDOW = Duration.ofMinutes(15);

    private final ConcurrentHashMap<String, Attempts> attempts = new ConcurrentHashMap<>();

    /**
     * Da chiamare prima del confronto BCrypt: se l'identificativo e' bloccato non
     * ha senso continuare a verificare password, e' solo lavoro regalato a chi sta
     * tentando l'attacco.
     */
    public void checkAllowed(String identifier) {
        var record = attempts.get(key(identifier));
        if (record == null) return;
        if (record.count() >= MAX_ATTEMPTS && !windowExpired(record)) {
            throw ApiException.tooManyRequests("Too many failed login attempts, please try again later");
        }
    }

    public void recordFailure(String identifier) {
        attempts.compute(key(identifier), (k, record) -> {
            if (record == null || windowExpired(record)) {
                return new Attempts(1, Instant.now());
            }
            return new Attempts(record.count() + 1, record.windowStart());
        });
    }

    /** Login riuscito: la lavagna dei tentativi falliti si pulisce. */
    public void recordSuccess(String identifier) {
        attempts.remove(key(identifier));
    }

    private boolean windowExpired(Attempts record) {
        return Duration.between(record.windowStart(), Instant.now()).compareTo(WINDOW) >= 0;
    }

    private String key(String identifier) {
        return identifier == null ? "" : identifier.trim().toLowerCase();
    }

    private record Attempts(int count, Instant windowStart) {}
}
