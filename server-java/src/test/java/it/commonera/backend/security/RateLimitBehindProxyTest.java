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
 * Il limitatore **dietro il reverse proxy di produzione**.
 *
 * Qui sta la trappola che questo test esiste per chiudere. In produzione nginx e'
 * l'unico che parla con il backend, quindi `getRemoteAddr()` restituirebbe sempre
 * il suo indirizzo: un limite per IP scritto ingenuamente conterebbe **tutti i
 * clienti del negozio come un solo IP**, e il primo che esaurisce il budget
 * chiuderebbe fuori tutti gli altri. E' il contrario di cio' che serve.
 *
 * La cura non e' leggere `X-Forwarded-For` a mano: e' `SERVER_FORWARD_HEADERS_STRATEGY=framework`
 * (vedi `docker-compose.prod.yml`), che monta il `ForwardedHeaderFilter` di Spring.
 * Quel filtro fa due cose, e la seconda punisce chi la ignora:
 *   1. riscrive `getRemoteAddr()` col primo indirizzo di `X-Forwarded-For`;
 *   2. **nasconde** le intestazioni `X-Forwarded-*` al resto della catena
 *      ({@code ForwardedHeaderExtractingRequest} estende {@code ForwardedHeaderRemovingRequest}).
 * Cioe': chi si scrive il parsing a mano legge `null` proprio in produzione, dove
 * l'intestazione c'e' davvero, e ricade sull'indirizzo di nginx senza nessun
 * errore che lo segnali.
 *
 * Quindi il limitatore usa `getRemoteAddr()` e basta, e deve girare **dopo** il
 * `ForwardedHeaderFilter`, registrato a {@code Ordered.HIGHEST_PRECEDENCE}. Questo
 * test gira su un Tomcat vero perche' l'ordine dei filtri servlet e' precisamente
 * cio' che si vuole verificare.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "server.forward-headers-strategy=framework")
class RateLimitBehindProxyTest extends AbstractIntegrationTest {

    /**
     * Client del JDK invece di un `TestRestTemplate`: in Spring Boot 4.1 quella
     * classe non e' piu' nel modulo di test, e per mandare tre intestazioni a una
     * porta locale non vale la pena aggiungere una dipendenza.
     */
    private static final HttpClient CLIENT = HttpClient.newHttpClient();

    @LocalServerPort
    private int port;

    /**
     * Due clienti diversi dietro lo stesso proxy hanno due budget diversi.
     *
     * Senza il trattamento dell'intestazione il secondo cliente troverebbe gia'
     * esaurito il budget del primo: e' la regressione che questo test blocca.
     */
    @Test
    void clientsBehindTheProxyKeepSeparateBudgets() {
        String noisy = "203.0.113.10";
        String innocent = "203.0.113.11";

        int attempts = 0;
        int last = 0;
        // Il tetto non e' ricopiato qui: si spara finche' non arriva il 429, cosi'
        // cambiare il numero nella politica non rompe il test.
        while (attempts < 60) {
            last = login(noisy);
            attempts++;
            if (last == 429) break;
        }

        assertThat(last).as("il cliente rumoroso deve essere fermato").isEqualTo(429);
        assertThat(login(noisy)).as("e deve restare fermo").isEqualTo(429);

        assertThat(login(innocent))
                .as("l'altro cliente non deve pagare per il primo")
                .isEqualTo(401);
    }

    /**
     * Un tentativo con credenziali sbagliate e un indirizzo dichiarato.
     *
     * L'indirizzo email e' diverso a ogni colpo di proposito: con lo stesso, a
     * fermare la raffica sarebbe {@link it.commonera.backend.services.LoginRateLimiterService}
     * (cinque fallimenti per identificativo), e il test misurerebbe quello invece
     * del limite per IP. Indirizzi tutti diversi da uno stesso IP sono poi
     * esattamente l'attacco che il limite per IP deve fermare: provare una
     * password comune su migliaia di account, uno per ciascuno.
     */
    private int login(String clientIp) {
        String body = "{\"email\":\"prova." + UUID.randomUUID()
                + "@example.com\",\"password\":\"password-sbagliata\"}";

        // `/api` e' il context-path dell'applicazione: il limitatore deve
        // riconoscere le rotte **senza** quel prefisso, o non ne matcherebbe nessuna.
        var request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/auth/login"))
                .header("Content-Type", "application/json")
                .header("X-Forwarded-For", clientIp)
                .header("X-Forwarded-Proto", "https")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

        try {
            return CLIENT.send(request, HttpResponse.BodyHandlers.ofString()).statusCode();
        } catch (Exception e) {
            throw new IllegalStateException("richiesta di prova fallita", e);
        }
    }
}
