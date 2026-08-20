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
        // Sfoltimento opportunistico: un fallimento contro un indirizzo che non
        // esiste occupa comunque una voce nella mappa, e nessuno la rimuove mai
        // (recordSuccess() pulisce solo la propria chiave). Senza questo, un
        // attaccante che prova N indirizzi a caso alloca N voci per sempre —
        // crescita illimitata della memoria. Basta controllare le voci la cui
        // finestra e' gia' scaduta a ogni scrittura: non serve un thread
        // schedulato dedicato per tenere la mappa limitata nella pratica.
        pruneExpired();
    }

    /** Login riuscito: la lavagna dei tentativi falliti si pulisce. */
    public void recordSuccess(String identifier) {
        attempts.remove(key(identifier));
    }

    private void pruneExpired() {
        attempts.entrySet().removeIf(e -> windowExpired(e.getValue()));
    }

    private boolean windowExpired(Attempts record) {
        return Duration.between(record.windowStart(), Instant.now()).compareTo(WINDOW) >= 0;
    }

    private String key(String identifier) {
        return identifier == null ? "" : identifier.trim().toLowerCase();
    }

    /** Solo per i test: quante voci sono attualmente tracciate in mappa. */
    int size() {
        return attempts.size();
    }

    /**
     * Solo per i test: forza la scadenza della finestra di un identificativo
     * gia' presente, per verificare lo sfoltimento senza dover aspettare
     * {@link #WINDOW} per davvero.
     */
    void forceExpiry(String identifier) {
        attempts.computeIfPresent(key(identifier),
                (k, record) -> new Attempts(record.count(), Instant.now().minus(WINDOW).minusSeconds(1)));
    }

    private record Attempts(int count, Instant windowStart) {}
}
