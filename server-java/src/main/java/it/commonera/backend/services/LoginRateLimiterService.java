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

    /**
     * Lo sfoltimento pieno della mappa non gira a ogni singolo fallimento: durante
     * una raffica di N identificativi tutti diversi (l'attacco che questo sfoltimento
     * doveva difendere), il colpo k-esimo ripasserebbe k-1 voci gia' viste, ognuna
     * con la propria {@code Instant.now()} e la propria {@code Duration} allocata —
     * O(N^2) letture d'orologio e allocazioni sull'intera raffica, un DoS sulla CPU
     * al posto di quello sulla memoria. Qui si limita la frequenza dello sfoltimento
     * pieno nel tempo, non in base a quante voci ci sono: durante una raffica
     * concentrata in pochi secondi, tutte le voci sono ancora dentro la finestra
     * (nessuna e' scaduta per davvero), quindi uno sfoltimento basato sulla
     * dimensione della mappa continuerebbe comunque a girare a ogni chiamata una
     * volta superata la soglia, senza rimuovere nulla — lo stesso O(N^2) di prima.
     * Un minimo di tempo fra due sfoltimenti pieni, invece, ne limita il numero
     * totale a prescindere da quante voci si aggiungono nel frattempo.
     */
    private static final Duration SWEEP_INTERVAL = Duration.ofSeconds(30);

    private final ConcurrentHashMap<String, Attempts> attempts = new ConcurrentHashMap<>();
    private volatile Instant lastSweepAt = Instant.EPOCH;

    /**
     * Da chiamare prima del confronto BCrypt: se l'identificativo e' bloccato non
     * ha senso continuare a verificare password, e' solo lavoro regalato a chi sta
     * tentando l'attacco.
     */
    public void checkAllowed(String identifier) {
        var record = attempts.get(key(identifier));
        if (record == null) return;
        if (record.count() >= MAX_ATTEMPTS && !windowExpired(record, Instant.now())) {
            throw ApiException.tooManyRequests("Too many failed login attempts, please try again later");
        }
    }

    public void recordFailure(String identifier) {
        // Un solo Instant.now() per chiamata: sia per la scrittura della voce che
        // per l'eventuale sfoltimento sotto, cosi' non se ne legge uno per ogni
        // voce ripassata durante lo sfoltimento.
        Instant now = Instant.now();
        attempts.compute(key(identifier), (k, record) -> {
            if (record == null || windowExpired(record, now)) {
                return new Attempts(1, now);
            }
            return new Attempts(record.count() + 1, record.windowStart());
        });
        // Sfoltimento opportunistico: un fallimento contro un indirizzo che non
        // esiste occupa comunque una voce nella mappa, e nessuno la rimuove mai
        // (recordSuccess() pulisce solo la propria chiave). Senza questo, un
        // attaccante che prova N indirizzi a caso alloca N voci per sempre —
        // crescita illimitata della memoria. Non serve un thread schedulato
        // dedicato: basta controllare le voci scadute ogni tanto durante le
        // scritture normali, non a ogni singola scrittura (vedi SWEEP_INTERVAL).
        maybeSweep(now);
    }

    /** Login riuscito: la lavagna dei tentativi falliti si pulisce. */
    public void recordSuccess(String identifier) {
        attempts.remove(key(identifier));
    }

    private void maybeSweep(Instant now) {
        Instant last = lastSweepAt;
        if (Duration.between(last, now).compareTo(SWEEP_INTERVAL) >= 0) {
            lastSweepAt = now;
            attempts.entrySet().removeIf(e -> windowExpired(e.getValue(), now));
        }
    }

    private boolean windowExpired(Attempts record, Instant now) {
        return Duration.between(record.windowStart(), now).compareTo(WINDOW) >= 0;
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

    /**
     * Solo per i test: azzera l'orologio dell'ultimo sfoltimento, cosi' la
     * prossima {@link #recordFailure} sfoltisce per davvero senza dover
     * aspettare {@link #SWEEP_INTERVAL} per davvero.
     */
    void forceSweepDue() {
        lastSweepAt = Instant.EPOCH;
    }

    private record Attempts(int count, Instant windowStart) {}
}
