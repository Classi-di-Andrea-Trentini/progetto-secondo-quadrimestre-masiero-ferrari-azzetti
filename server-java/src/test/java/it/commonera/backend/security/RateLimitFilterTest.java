package it.commonera.backend.security;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Il filtro senza Spring e senza database: qui si verifica quali rotte sono
 * davvero coperte e quali no.
 *
 * Serve perche' l'errore piu' probabile su una tabella di politiche non e' un
 * limite sbagliato, e' un percorso che non corrisponde a niente — una rotta
 * scritta col context-path davanti, o `/reviews/*` dove serviva
 * `/reviews/{id}/helpful`. Un limite che non scatta mai non fa fallire nessun
 * test e non protegge niente: sembra esserci e non c'e'.
 */
class RateLimitFilterTest {

    private RateLimitService limiter;
    private RateLimitFilter filter;

    @BeforeEach
    void setUp() {
        limiter = new RateLimitService();
        filter = new RateLimitFilter(limiter);
    }

    @Test
    void registrationIsCappedPerIp() {
        // Cinque passano, la sesta no: il numero e' quello di RateLimitPolicy.
        for (int i = 0; i < 5; i++) {
            assertThat(call("POST", "/auth/register", "9.9.9.1")).as("tentativo %d", i + 1).isEqualTo(200);
        }
        assertThat(call("POST", "/auth/register", "9.9.9.1")).isEqualTo(429);
    }

    @Test
    void eachPolicyCoversTheRouteItIsWrittenFor() {
        // Se uno di questi percorsi non corrispondesse, il ciclo non arriverebbe
        // mai al 429 nel numero di colpi previsto dalla sua politica.
        assertThat(exhaust("POST", "/auth/login", "9.9.9.2")).isEqualTo(20);
        assertThat(exhaust("POST", "/auth/forgot-password", "9.9.9.3")).isEqualTo(5);
        assertThat(exhaust("POST", "/auth/reset-password", "9.9.9.4")).isEqualTo(10);
        assertThat(exhaust("POST", "/checkout", "9.9.9.5")).isEqualTo(10);
        assertThat(exhaust("POST", "/reviews", "9.9.9.6")).isEqualTo(20);
        // La rotta con una variabile nel mezzo e' quella che si sbaglia piu'
        // facilmente scrivendo il percorso.
        assertThat(exhaust("POST", "/reviews/3f1a-2b/helpful", "9.9.9.7")).isEqualTo(20);
    }

    /**
     * Il metodo fa parte della politica: la lettura di una recensione non deve
     * consumare il budget di chi le scrive.
     */
    @Test
    void readingIsNotCappedLikeWriting() {
        for (int i = 0; i < 25; i++) {
            assertThat(call("GET", "/reviews/product/abc", "9.9.9.8")).isEqualTo(200);
        }
    }

    /** Due indirizzi diversi non si rubano il budget a vicenda. */
    @Test
    void addressesAreIndependent() {
        for (int i = 0; i < 5; i++) {
            call("POST", "/auth/register", "9.9.9.10");
        }
        assertThat(call("POST", "/auth/register", "9.9.9.10")).isEqualTo(429);
        assertThat(call("POST", "/auth/register", "9.9.9.11")).isEqualTo(200);
    }

    /**
     * Il webhook resta fuori: un 429 al fornitore e' la conferma di un incasso
     * persa, cioe' un ordine pagato che il raccoglitore annulla mezz'ora dopo.
     */
    @Test
    void theProviderWebhookIsNeverThrottled() {
        for (int i = 0; i < 400; i++) {
            assertThat(call("POST", "/payments/webhook", "9.9.9.12")).as("evento %d", i).isEqualTo(200);
        }
    }

    /** La preflight CORS la manda il browser da solo: non e' traffico dell'utente. */
    @Test
    void preflightIsNotCounted() {
        for (int i = 0; i < 400; i++) {
            assertThat(call("OPTIONS", "/checkout", "9.9.9.13")).isEqualTo(200);
        }
    }

    /**
     * Una rotta senza politica propria paga comunque il tetto globale: senza,
     * basterebbe cambiare endpoint per non essere contati da nessuno.
     */
    @Test
    void routesWithoutTheirOwnPolicyStillPayTheGlobalCap() {
        int allowed = 0;
        while (allowed < 500 && call("GET", "/products", "9.9.9.14") == 200) {
            allowed++;
        }
        assertThat(allowed).isEqualTo(300);
    }

    /** Il 429 ha la forma d'errore del resto dell'API, piu' `Retry-After`. */
    @Test
    void theRejectionLooksLikeEveryOtherApiError() throws Exception {
        for (int i = 0; i < 5; i++) {
            call("POST", "/auth/register", "9.9.9.15");
        }
        var response = invoke("POST", "/auth/register", "9.9.9.15");

        assertThat(response.getStatus()).isEqualTo(429);
        assertThat(response.getContentType()).isEqualTo("application/json");
        assertThat(response.getContentAsString())
                .contains("\"statusCode\":429")
                .contains("\"error\":\"Too Many Requests\"")
                .contains("\"message\":");
        assertThat(Integer.parseInt(response.getHeader("Retry-After"))).isPositive();
    }

    /** Quanti colpi passano prima del 429 su quella rotta. */
    private int exhaust(String method, String path, String ip) {
        int allowed = 0;
        while (allowed < 100 && call(method, path, ip) == 200) {
            allowed++;
        }
        return allowed;
    }

    private int call(String method, String path, String ip) {
        return invoke(method, path, ip).getStatus();
    }

    /**
     * Il context-path `/api` c'e' anche qui, perche' e' la forma vera delle
     * richieste in arrivo: e' esattamente l'inciampo che questo test deve vedere.
     */
    private MockHttpServletResponse invoke(String method, String path, String ip) {
        var request = new MockHttpServletRequest(method, "/api" + path);
        request.setContextPath("/api");
        request.setRemoteAddr(ip);
        var response = new MockHttpServletResponse();
        FilterChain chain = new MockFilterChain();

        try {
            filter.doFilter(request, response, chain);
        } catch (Exception e) {
            throw new IllegalStateException("filtro fallito", e);
        }
        return response;
    }
}
