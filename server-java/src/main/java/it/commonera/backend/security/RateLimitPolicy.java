package it.commonera.backend.security;

import java.time.Duration;
import java.util.List;
import java.util.Set;

/**
 * Una politica di limitazione: quante richieste, in quanto tempo, su quali rotte.
 *
 * @param name        compare nella chiave del contatore e nei log: due politiche
 *                    con lo stesso nome condividerebbero il budget
 * @param methods     metodi HTTP a cui si applica; vuoto significa tutti
 * @param paths       percorsi **senza** il context-path `/api`, nella forma dei
 *                    {@code PathPattern} di Spring (`/reviews/{id}/helpful`)
 * @param limit       richieste ammesse nella finestra
 * @param window      durata della finestra
 * @param perIdentity se vero, oltre al contatore per IP ne tiene uno per utente
 *                    collegato. Serve dove l'IP da solo non basta: una scuola o
 *                    un ufficio escono tutti dallo stesso indirizzo, e un tetto
 *                    per IP abbastanza alto da non dare fastidio a loro sarebbe
 *                    troppo alto per fermare un singolo account impazzito.
 */
public record RateLimitPolicy(String name, Set<String> methods, List<String> paths,
                              int limit, Duration window, boolean perIdentity) {

    /**
     * Le politiche in vigore, in ordine: **vince la prima che corrisponde**, e
     * oltre a quella si paga sempre anche {@link #global()}.
     *
     * I numeri sono scelti per essere invisibili a un cliente vero e stretti per
     * chi automatizza. Chi compra fa un checkout ogni parecchi minuti, non dieci
     * al minuto; chi scrive recensioni ne scrive una per prodotto comprato, non
     * venti all'ora.
     */
    public static List<RateLimitPolicy> defaults() {
        return List.of(
                // Il tentativo di accesso e' gia' limitato per indirizzo email da
                // LoginRateLimiterService (cinque fallimenti). Quel limite non vede
                // pero' l'attacco piu' comune, che e' il contrario: **una** password
                // molto diffusa provata su **migliaia di account diversi**, dove
                // nessun singolo indirizzo arriva mai a cinque fallimenti. A fermarlo
                // puo' essere solo un contatore per IP, come questo.
                of("login", "POST", "/auth/login", 20, Duration.ofMinutes(15)),
                // Ogni registrazione manda un'email di verifica: senza tetto, il
                // negozio diventa il mezzo con cui qualcun altro inonda caselle
                // di posta che non gli appartengono.
                of("register", "POST", "/auth/register", 5, Duration.ofHours(1)),
                // Stessa ragione, aggravata: qui l'indirizzo lo sceglie chi chiama,
                // quindi il bersaglio dell'inondazione e' una vittima precisa.
                of("forgot-password", "POST", "/auth/forgot-password", 5, Duration.ofHours(1)),
                // Il token del reset e' lungo e casuale, ma senza tetto niente
                // impedisce di provarlo a tentativi.
                of("reset-password", "POST", "/auth/reset-password", 10, Duration.ofHours(1)),
                // Ogni checkout riserva merce e apre un intent col fornitore: una
                // raffica svuota il magazzino agli occhi di tutti gli altri clienti
                // per la mezz'ora che serve al raccoglitore per disfarla.
                new RateLimitPolicy("checkout", Set.of("POST"), List.of("/checkout"),
                        10, Duration.ofMinutes(10), true),
                new RateLimitPolicy("reviews", Set.of("POST"),
                        List.of("/reviews", "/reviews/{id}/helpful"),
                        20, Duration.ofHours(1), true));
    }

    /**
     * Il tetto per IP che vale su **qualunque** rotta, anche quelle senza una
     * politica propria: senza, basterebbe cambiare endpoint per non essere
     * contati da nessuno. Largo di proposito — una pagina prodotto con le sue
     * immagini sono gia' parecchie richieste — perche' serve a fermare chi
     * raschia il catalogo, non chi lo sfoglia.
     *
     * <p><b>Attenzione a chi tocca questo numero.</b> C'e' un chiamante che non e'
     * un browser: il server SSR di Angular, che in Docker chiama il backend per
     * nome di servizio e quindi **senza** passare da nginx e senza
     * `X-Forwarded-For`. Tutte le sue richieste arrivano dallo stesso indirizzo —
     * quello del container `frontend` — e finiscono percio' in un unico contatore,
     * condiviso da ogni pagina resa lato server per chiunque. Con 300 al minuto si
     * sta larghi per il traffico di questo progetto, ma il giorno che le pagine
     * rese dal server diventassero tante, il primo a incontrare il tetto sarebbe
     * il sito stesso, non un attaccante. La soluzione, quando servira', non e'
     * alzare il numero all'infinito: e' escludere l'indirizzo del frontend, come
     * si fa gia' col webhook del fornitore in {@code RateLimitFilter}.
     */
    public static RateLimitPolicy global() {
        return of("global", null, null, 300, Duration.ofMinutes(1));
    }

    private static RateLimitPolicy of(String name, String method, String path, int limit, Duration window) {
        return new RateLimitPolicy(name,
                method == null ? Set.of() : Set.of(method),
                path == null ? List.of() : List.of(path),
                limit, window, false);
    }
}
