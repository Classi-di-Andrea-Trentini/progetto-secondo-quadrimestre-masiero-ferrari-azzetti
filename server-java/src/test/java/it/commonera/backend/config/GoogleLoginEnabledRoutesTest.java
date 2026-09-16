package it.commonera.backend.config;

import it.commonera.backend.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Il giro OAuth completo non e' provabile qui: servirebbero credenziali Google vere
 * e un browser che apra la schermata di consenso. Quello che si puo' provare — e che
 * sbagliato manderebbe tutto all'aria — e' la **partenza**: con credenziali finte,
 * l'applicazione deve comunque montare le rotte, mandare il browser all'indirizzo
 * giusto di Google, con i parametri giusti, e lasciarsi dietro il cookie con cui
 * riconoscera' il ritorno.
 *
 * E' lo stesso trattamento riservato a Stripe: si prova tutto quello che sta da
 * questa parte del filo.
 */
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "app.google.client-id=id-di-prova.apps.googleusercontent.com",
        "app.google.client-secret=segreto-di-prova",
        "app.google.redirect-uri=http://localhost:3000/api/auth/oauth2/callback/google",
})
class GoogleLoginEnabledRoutesTest extends AbstractIntegrationTest {

    @Autowired
    private MockMvc mvc;

    @Test
    void theConfigEndpointAnnouncesGoogleAndSaysWhereToStart() throws Exception {
        mvc.perform(get("/config"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.googleAuthEnabled").value(true))
                .andExpect(jsonPath("$.googleAuthUrl")
                        .value("http://localhost:3000/api/auth/oauth2/authorize/google"));
    }

    @Test
    void theConfigEndpointNeverLeaksTheCredentials() throws Exception {
        String body = mvc.perform(get("/config")).andReturn().getResponse().getContentAsString();

        assertThat(body).doesNotContain("segreto-di-prova");
        assertThat(body).doesNotContain("client-secret").doesNotContain("clientSecret");
    }

    @Test
    void startingTheFlowRedirectsToGoogleWithTheRightParameters() throws Exception {
        var response = mvc.perform(get("/auth/oauth2/authorize/google"))
                .andExpect(status().is3xxRedirection())
                .andReturn().getResponse();

        String location = response.getRedirectedUrl();
        assertThat(location).startsWith("https://accounts.google.com/o/oauth2/v2/auth");
        assertThat(location).contains("client_id=id-di-prova.apps.googleusercontent.com");
        assertThat(location).contains("response_type=code");
        // `openid` non e' facoltativo: senza, Google non emette l'id_token e al ritorno
        // non ci sarebbe niente di firmato da verificare.
        assertThat(location).contains("openid");
        // Il `state` e' cio' che impedisce a un terzo di far arrivare al nostro callback
        // un codice ottenuto altrove.
        assertThat(location).contains("state=");
        assertThat(location)
                .as("l'URI di ritorno deve essere quello configurato, cioe' quello registrato sulla Cloud Console")
                .contains("redirect_uri=http://localhost:3000/api/auth/oauth2/callback/google");
        // PKCE: Spring Security lo applica da se'. Conta saperlo, perche' il
        // `code_verifier` resta negli attributi della richiesta di autorizzazione e
        // deve sopravvivere al giro nel cookie, altrimenti lo scambio del codice
        // fallisce. Vedi CookieOAuth2AuthorizationRequestRepositoryTest.
        assertThat(location).contains("code_challenge_method=S256");
    }

    @Test
    void theAuthorizationRequestIsParkedInACookieAndNotInASession() throws Exception {
        var response = mvc.perform(get("/auth/oauth2/authorize/google")).andReturn().getResponse();

        // Il backend gira con SessionCreationPolicy.STATELESS: se la richiesta finisse
        // nella HttpSession, al ritorno da Google non ci sarebbe piu' e il controllo del
        // `state` fallirebbe con "authorization_request_not_found".
        assertThat(response.getCookie("oauth2_auth_request"))
                .as("la richiesta di autorizzazione deve viaggiare nel cookie")
                .isNotNull();
        assertThat(response.getCookie("oauth2_auth_request").isHttpOnly()).isTrue();
    }

    @Test
    void anUnknownProviderIsNotAWayIn() throws Exception {
        // Solo la registrazione "google" esiste. Un identificativo inventato non deve
        // avviare nessun giro: Spring Security risponde con un errore (500, e' il suo
        // comportamento di serie su un registrationId sconosciuto — brutto ma non
        // pericoloso), l'importante e' che non mandi il browser da nessuna parte e non
        // lasci in giro l'appunto della richiesta.
        var response = mvc.perform(get("/auth/oauth2/authorize/facebook")).andReturn().getResponse();

        assertThat(response.getRedirectedUrl()).isNull();
        assertThat(response.getCookie("oauth2_auth_request")).isNull();
    }
}
