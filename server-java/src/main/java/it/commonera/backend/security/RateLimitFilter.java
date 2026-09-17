package it.commonera.backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.PathContainer;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.pattern.PathPattern;
import org.springframework.web.util.pattern.PathPatternParser;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Limite di richieste per rotta, per IP e — dove ha senso — per utente.
 *
 * Prima esisteva un solo tetto in tutto il backend, sui fallimenti di
 * `POST /auth/login` e per indirizzo email
 * ({@link it.commonera.backend.services.LoginRateLimiterService}, che resta al suo
 * posto perche' fa una cosa che un filtro non puo' fare: conta i **fallimenti**,
 * non le richieste, e per questo non da' fastidio a chi la password la sa). Tutto
 * il resto era senza difese: registrazioni a raffica, `forgot-password` usata per
 * inondare la casella di qualcun altro, checkout ripetuti che riservano merce che
 * poi nessuno paga.
 *
 * <h2>L'IP del chiamante</h2>
 * Si legge da {@code request.getRemoteAddr()} e da nient'altro. In produzione
 * l'indirizzo vero lo rimette li' il {@code ForwardedHeaderFilter} di Spring,
 * acceso da {@code SERVER_FORWARD_HEADERS_STRATEGY=framework} in
 * `docker-compose.prod.yml`, che legge `X-Forwarded-For` **e poi la nasconde** al
 * resto della catena. Da qui discendono due regole che sembrano dettagli e non lo
 * sono:
 *
 * <ol>
 *   <li>Leggere `X-Forwarded-For` a mano qui dentro non funzionerebbe: in
 *       produzione quel filtro l'ha gia' tolta e si leggerebbe {@code null}
 *       proprio dove l'intestazione c'e' davvero. Fuori produzione, invece,
 *       funzionerebbe fin troppo bene: senza nessun proxy davanti sarebbe il
 *       client a dichiarare il proprio indirizzo, e chiunque aggirerebbe ogni
 *       limite cambiando una stringa.</li>
 *   <li>Questo filtro deve girare **dopo** il {@code ForwardedHeaderFilter}, che
 *       e' registrato a {@code Ordered.HIGHEST_PRECEDENCE}. Registrandolo come
 *       normale bean {@code Filter}, senza {@code @Order}, Spring Boot lo mette a
 *       {@code LOWEST_PRECEDENCE}: e' l'ultimo della catena, quindi va bene. Non
 *       si aggiunga un {@code @Order} basso senza rileggere
 *       {@link RateLimitBehindProxyTest}.</li>
 * </ol>
 *
 * <h2>Dove si trova nella catena</h2>
 * Dopo Spring Security (che sta a -100), e quindi dopo l'autenticazione: e' cio'
 * che permette di avere una chiave per utente su checkout e recensioni. Il prezzo
 * e' che le richieste respinte con 401 dal filtro di sicurezza non arrivano fin
 * qui e non consumano budget. E' un compromesso consapevole: contro chi martella
 * rotte protette senza credenziali la difesa giusta sta su nginx, che risponde
 * senza svegliare ne' l'applicazione ne' il database.
 *
 * <h2>SecurityConfig non viene toccato</h2>
 * Un bean {@code Filter} viene registrato da solo nel contenitore servlet. Non
 * serve aggiungere righe alla catena di sicurezza, e infatti non ne sono state
 * aggiunte.
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private final RateLimitService limiter;
    private final List<CompiledPolicy> policies;
    private final RateLimitPolicy global;
    private final List<PathPattern> exempt;

    public RateLimitFilter(RateLimitService limiter) {
        this.limiter = limiter;
        var parser = PathPatternParser.defaultInstance;
        this.policies = RateLimitPolicy.defaults().stream()
                .map(policy -> new CompiledPolicy(policy,
                        policy.paths().stream().map(parser::parse).toList()))
                .toList();
        this.global = RateLimitPolicy.global();
        // Il webhook del fornitore e' fuori da qualunque tetto. Non e' traffico
        // di un utente: e' una sola controparte che puo' legittimamente ripetere
        // lo stesso evento molte volte di fila quando sospetta di non essere stata
        // capita. Rispondergli 429 significa perdere la conferma di un incasso —
        // un ordine pagato che resta `pending` e che il raccoglitore annulla
        // mezz'ora dopo, con la merce gia' addebitata al cliente. La sua difesa e'
        // la firma, verificata dentro il servizio, non un contatore.
        this.exempt = List.of(parser.parse("/payments/webhook"));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {

        // La preflight CORS non e' una richiesta dell'utente: il browser la manda
        // da solo e non porta il cookie. Contarla vorrebbe dire dimezzare il tetto
        // vero di ogni rotta che il frontend chiama da un'altra origine.
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            chain.doFilter(request, response);
            return;
        }

        var path = pathWithoutContext(request);
        if (matchesAny(exempt, path)) {
            chain.doFilter(request, response);
            return;
        }

        for (Bucket bucket : bucketsFor(request, path)) {
            var decision = limiter.consume(bucket.key(), bucket.policy());
            if (!decision.allowed()) {
                reject(response, decision.retryAfterSeconds());
                return;
            }
        }

        chain.doFilter(request, response);
    }

    /**
     * I contatori da pagare per questa richiesta: sempre il tetto globale per IP,
     * piu' quello della politica di rotta se ce n'e' una, per IP e per utente.
     *
     * L'ordine conta: il globale per primo, cosi' chi ha gia' sfondato quello si
     * ferma senza consumare anche il budget della rotta — altrimenti un solo
     * attaccante brucerebbe i contatori di rotte che non ha nemmeno raggiunto.
     */
    private List<Bucket> bucketsFor(HttpServletRequest request, PathContainer path) {
        var buckets = new ArrayList<Bucket>(3);
        String ip = clientIp(request);
        buckets.add(new Bucket(global.name() + "|ip|" + ip, global));

        var matched = match(request.getMethod(), path);
        if (matched != null) {
            buckets.add(new Bucket(matched.name() + "|ip|" + ip, matched));
            if (matched.perIdentity()) {
                var identity = currentUserId();
                if (identity != null) {
                    buckets.add(new Bucket(matched.name() + "|user|" + identity, matched));
                }
            }
        }
        return buckets;
    }

    private RateLimitPolicy match(String method, PathContainer path) {
        for (var compiled : policies) {
            Set<String> methods = compiled.policy().methods();
            // Locale.ROOT e non quello di sistema: i metodi HTTP sono ASCII, e in
            // turco `toUpperCase()` trasformerebbe la "i" in "İ" facendo fallire
            // il confronto — un limite che sparisce a seconda di dove gira.
            if (!methods.isEmpty() && !methods.contains(method.toUpperCase(Locale.ROOT))) continue;
            if (matchesAny(compiled.patterns(), path)) return compiled.policy();
        }
        return null;
    }

    private static boolean matchesAny(List<PathPattern> patterns, PathContainer path) {
        for (var pattern : patterns) {
            if (pattern.matches(path)) return true;
        }
        return false;
    }

    /**
     * Il percorso senza `/api`: il context-path e' nell'URI ma non nei percorsi
     * scritti nelle politiche, che sono gli stessi che si leggono nei controller.
     */
    private static PathContainer pathWithoutContext(HttpServletRequest request) {
        String uri = request.getRequestURI();
        String context = request.getContextPath();
        if (context != null && !context.isEmpty() && uri.startsWith(context)) {
            uri = uri.substring(context.length());
        }
        return PathContainer.parsePath(uri.isEmpty() ? "/" : uri);
    }

    /** Vedi la nota sull'IP del chiamante in testa alla classe: solo questo, mai le intestazioni. */
    private static String clientIp(HttpServletRequest request) {
        String address = request.getRemoteAddr();
        return address == null ? "sconosciuto" : address;
    }

    private static String currentUserId() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof CurrentUser user) {
            return user.id().toString();
        }
        return null;
    }

    /** Stessa forma d'errore di tutto il resto dell'API: il frontend legge `message`. */
    private static void reject(HttpServletResponse response, long retryAfterSeconds) throws IOException {
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setContentType("application/json");
        // Standard e non decorativo: dice al chiamante onesto quando riprovare,
        // invece di lasciarlo martellare fino a fine finestra.
        response.setHeader("Retry-After", String.valueOf(retryAfterSeconds));
        response.getWriter().write("{\"message\":\"Too many requests, try again in "
                + retryAfterSeconds + " seconds\",\"error\":\"Too Many Requests\",\"statusCode\":429}");
    }

    /** Percorsi gia' compilati una volta sola: ricompilarli a ogni richiesta sarebbe lavoro inutile. */
    private record CompiledPolicy(RateLimitPolicy policy, List<PathPattern> patterns) {}

    /** Un contatore da consumare: la chiave e la politica che ne fissa il tetto. */
    private record Bucket(String key, RateLimitPolicy policy) {}
}
