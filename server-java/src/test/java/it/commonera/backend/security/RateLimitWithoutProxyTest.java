package it.commonera.backend.security;

import it.commonera.backend.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Lo stesso limitatore **senza** proxy davanti, cioe' nella configurazione
 * predefinita (`docker-compose.yml`, e lo sviluppo in locale).
 *
 * E' la meta' che completa {@link RateLimitBehindProxyTest}, e insieme le due
 * fissano una regola sola: `X-Forwarded-For` vale **se e solo se** qualcuno di
 * fidato l'ha scritta. Qui nessuno l'ha scritta, quindi dichiararsi un altro
 * indirizzo non deve servire a niente — altrimenti il limite per IP sarebbe
 * aggirabile da chiunque cambiando una stringa a ogni richiesta, e tutto il
 * lavoro fatto non fermerebbe nemmeno un attaccante svogliato.
 *
 * Detto in un altro modo: la riga {@code SERVER_FORWARD_HEADERS_STRATEGY=framework}
 * accesa **solo** in `docker-compose.prod.yml` non e' una svista da correggere
 * accendendola ovunque. E' la differenza fra un'intestazione scritta da nginx e
 * una scritta dal client.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class RateLimitWithoutProxyTest extends AbstractIntegrationTest {

    private static final HttpClient CLIENT = HttpClient.newHttpClient();

    @LocalServerPort
    private int port;

    @Test
    void aSpoofedForwardedHeaderDoesNotBuyANewBudget() {
        int attempts = 0;
        int last = 0;
        // Ogni colpo dichiara un indirizzo diverso: se l'intestazione fosse
        // creduta, ognuno aprirebbe un contatore nuovo e il 429 non arriverebbe
        // mai. Il ciclo finirebbe a 60 e l'asserzione qui sotto fallirebbe.
        while (attempts < 60) {
            last = login("198.51.100." + (attempts % 250));
            attempts++;
            if (last == 429) break;
        }

        assertThat(last)
                .as("senza un proxy di fiducia, X-Forwarded-For non deve creare budget nuovo")
                .isEqualTo(429);
    }

    private int login(String claimedIp) {
        String body = "{\"email\":\"prova." + UUID.randomUUID()
                + "@example.com\",\"password\":\"password-sbagliata\"}";

        var request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/auth/login"))
                .header("Content-Type", "application/json")
                .header("X-Forwarded-For", claimedIp)
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

        try {
            return CLIENT.send(request, HttpResponse.BodyHandlers.ofString()).statusCode();
        } catch (Exception e) {
            throw new IllegalStateException("richiesta di prova fallita", e);
        }
    }
}
