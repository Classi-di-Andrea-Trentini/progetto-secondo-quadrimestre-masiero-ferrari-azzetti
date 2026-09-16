package it.commonera.backend.security;

import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Contatori a finestra fissa, in memoria.
 *
 * In memoria e non su database per la stessa ragione di
 * {@link it.commonera.backend.services.LoginRateLimiterService}: non deve
 * sopravvivere a un riavvio, deve solo impedire le raffiche. Scriverlo su
 * Postgres significherebbe una INSERT a ogni richiesta del negozio, cioe'
 * costruire il sovraccarico da cui si vorrebbe difendersi.
 *
 * Il limite e' che con piu' istanze del backend ogni istanza conta per conto suo,
 * quindi il tetto vero e' `limite x numero di istanze`. Oggi l'istanza e' una
 * (vedi `docker-compose.prod.yml`) e questo basta; il giorno che diventassero
 * due, il posto dove mettere un contatore condiviso e' questa classe, senza
 * toccare ne' il filtro ne' le politiche.
 *
 * Finestra **fissa** e non scorrevole: una finestra scorrevole vera vorrebbe la
 * lista degli istanti di ogni richiesta, cioe' memoria proporzionale al traffico
 * — di nuovo, il bersaglio che si vuole togliere. Il prezzo e' che a cavallo di
 * due finestre si puo' passare fino al doppio del limite; per fermare le raffiche
 * e' un prezzo accettabile.
 */
@Service
public class RateLimitService {

    /**
     * Stessa difesa di {@code LoginRateLimiterService}: le voci scadute vanno
     * tolte, altrimenti una raffica da N indirizzi diversi lascia N voci in mappa
     * per sempre. E va fatto a tempo, non a ogni scrittura: durante una raffica
     * concentrata nessuna voce e' ancora scaduta, quindi uno sfoltimento legato
     * alla dimensione della mappa ripasserebbe tutte le voci a ogni richiesta
     * senza togliere niente — O(N^2) di lavoro regalato.
     */
    private static final Duration SWEEP_INTERVAL = Duration.ofSeconds(30);

    private final ConcurrentHashMap<String, Counter> counters = new ConcurrentHashMap<>();
    private volatile Instant lastSweepAt = Instant.EPOCH;

    /**
     * Conta una richiesta e dice se puo' passare.
     *
     * Consuma **sempre**, anche quando nega: chi continua a martellare dopo il
     * 429 non deve veder scadere la finestra prima di aver smesso.
     */
    public Decision consume(String key, RateLimitPolicy policy) {
        return consume(key, policy, Instant.now());
    }

    /** L'istante arriva da fuori solo per i test: aspettare un'ora non e' un test. */
    Decision consume(String key, RateLimitPolicy policy, Instant now) {
        var counter = counters.compute(key, (k, existing) -> {
            if (existing == null || existing.isExpired(now)) {
                return new Counter(1, now, policy.window());
            }
            return new Counter(existing.count() + 1, existing.windowStart(), existing.window());
        });

        maybeSweep(now);

        if (counter.count() <= policy.limit()) {
            return new Decision(true, 0);
        }
        long retryAfter = Math.max(1,
                Duration.between(now, counter.windowStart().plus(counter.window())).toSeconds());
        return new Decision(false, retryAfter);
    }

    private void maybeSweep(Instant now) {
        Instant last = lastSweepAt;
        if (Duration.between(last, now).compareTo(SWEEP_INTERVAL) >= 0) {
            lastSweepAt = now;
            counters.entrySet().removeIf(e -> e.getValue().isExpired(now));
        }
    }

    /** Solo per i test: quante voci sono attualmente tracciate. */
    int size() {
        return counters.size();
    }

    /** Solo per i test: rimette a zero tutto fra un caso e l'altro. */
    void reset() {
        counters.clear();
        lastSweepAt = Instant.EPOCH;
    }

    /** @param retryAfterSeconds quanto manca alla fine della finestra, 0 se e' passata. */
    public record Decision(boolean allowed, long retryAfterSeconds) {}

    /**
     * La finestra e' portata dalla voce, non dedotta al momento dello
     * sfoltimento: chiavi di politiche diverse convivono nella stessa mappa e
     * hanno durate diverse, e sfoltirle tutte con la stessa durata cancellerebbe
     * in anticipo i contatori delle politiche piu' lunghe — cioe' regalerebbe
     * budget proprio dove il tetto e' piu' stretto.
     */
    private record Counter(int count, Instant windowStart, Duration window) {
        boolean isExpired(Instant now) {
            return Duration.between(windowStart, now).compareTo(window) >= 0;
        }
    }
}
