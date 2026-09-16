package it.commonera.backend.config;

import it.commonera.backend.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Lo stato normale di questo repo: nessuna credenziale Google.
 *
 * E' la condizione in cui si trova chiunque lo cloni, quindi e' quella che deve
 * funzionare senza sorprese. L'applicazione parte (se non partisse, tutta la suite
 * cadrebbe qui), le rotte OAuth non esistono e `/config` lo dice al frontend, che
 * cosi' non disegna un bottone che porterebbe a una pagina d'errore.
 *
 * Nessun `@TestPropertySource`: valgono i default di `application.properties`, cioe'
 * le variabili d'ambiente non impostate.
 */
@AutoConfigureMockMvc
class GoogleLoginDisabledRoutesTest extends AbstractIntegrationTest {

    @Autowired
    private MockMvc mvc;

    @Test
    void theConfigEndpointSaysGoogleIsOff() throws Exception {
        mvc.perform(get("/config"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.googleAuthEnabled").value(false))
                .andExpect(jsonPath("$.googleAuthUrl").doesNotExist());
    }

    @Test
    void theConfigEndpointIsReadableWithoutBeingLoggedIn() throws Exception {
        // Serve alla pagina di accesso, cioe' proprio a chi non ha ancora una sessione:
        // dietro `authenticated()` non servirebbe a niente.
        mvc.perform(get("/config")).andExpect(status().isOk());
    }

    @Test
    void thereIsNoGoogleRouteAtAll() throws Exception {
        // 404 e non 401: la rotta non e' protetta, semplicemente non e' stata
        // registrata. E' la differenza fra "spento" e "vietato".
        mvc.perform(get("/auth/oauth2/authorize/google"))
                .andExpect(status().isNotFound());
    }
}
