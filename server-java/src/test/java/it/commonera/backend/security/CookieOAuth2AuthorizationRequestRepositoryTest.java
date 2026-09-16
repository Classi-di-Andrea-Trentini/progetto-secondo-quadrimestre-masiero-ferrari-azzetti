package it.commonera.backend.security;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;

import jakarta.servlet.http.Cookie;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Il giro OAuth vero non si puo' provare senza credenziali Google, ma questo pezzo
 * si': e' il punto in cui il controllo del parametro `state` vive o muore. Se la
 * richiesta di autorizzazione non torna indietro identica, al ritorno da Google
 * Spring Security risponde `authorization_request_not_found` e nessuno entra piu'.
 */
class CookieOAuth2AuthorizationRequestRepositoryTest {

    private final CookieOAuth2AuthorizationRequestRepository repository =
            new CookieOAuth2AuthorizationRequestRepository(false);

    private static OAuth2AuthorizationRequest sampleRequest() {
        return OAuth2AuthorizationRequest.authorizationCode()
                .authorizationUri("https://accounts.google.com/o/oauth2/v2/auth")
                .clientId("client-di-prova")
                .redirectUri("http://localhost:3000/api/auth/oauth2/callback/google")
                .scopes(java.util.Set.of("openid", "email", "profile"))
                .state("stato-non-indovinabile")
                .additionalParameters(Map.of("nonce", "impronta-del-nonce"))
                .attributes(Map.of("registration_id", "google", "nonce", "nonce-in-chiaro"))
                .build();
    }

    /** Ricopia nella richiesta i cookie che la risposta ha appena impostato. */
    private static void carryCookiesOver(MockHttpServletResponse from, MockHttpServletRequest to) {
        var header = from.getHeader("Set-Cookie");
        assertThat(header).isNotNull();
        String value = header.substring(header.indexOf('=') + 1, header.indexOf(';'));
        to.setCookies(new Cookie(header.substring(0, header.indexOf('=')), value));
    }

    @Test
    void theRequestSurvivesTheRoundTripThroughACookie() {
        var saveResponse = new MockHttpServletResponse();
        var original = sampleRequest();

        repository.saveAuthorizationRequest(original, new MockHttpServletRequest(), saveResponse);

        var loadRequest = new MockHttpServletRequest();
        carryCookiesOver(saveResponse, loadRequest);
        var loaded = repository.loadAuthorizationRequest(loadRequest);

        assertThat(loaded).isNotNull();
        assertThat(loaded.getState())
                .as("il `state` e' cio' che impedisce a un terzo di far arrivare qui un codice ottenuto altrove")
                .isEqualTo(original.getState());
        assertThat(loaded.getRedirectUri()).isEqualTo(original.getRedirectUri());
        assertThat(loaded.getClientId()).isEqualTo(original.getClientId());
        assertThat(loaded.getScopes()).isEqualTo(original.getScopes());
        assertThat(loaded.getAttributes())
                .as("negli attributi c'e' il nonce con cui si verifica l'id_token: perderlo fa fallire tutto il giro")
                .isEqualTo(original.getAttributes());
        assertThat(loaded.getAdditionalParameters()).isEqualTo(original.getAdditionalParameters());
    }

    @Test
    void theCookieIsHttpOnlyAndStaysOnTheSite() {
        var response = new MockHttpServletResponse();

        repository.saveAuthorizationRequest(sampleRequest(), new MockHttpServletRequest(), response);

        String header = response.getHeader("Set-Cookie");
        assertThat(header).contains("HttpOnly");
        // SameSite=Lax e non Strict: il ritorno da Google e' una navigazione di primo
        // livello proveniente da un altro sito, che Strict bloccherebbe.
        assertThat(header).contains("SameSite=Lax");
        assertThat(header).contains("Path=/");
    }

    @Test
    void removingTheRequestAlsoClearsTheCookie() {
        var saveResponse = new MockHttpServletResponse();
        repository.saveAuthorizationRequest(sampleRequest(), new MockHttpServletRequest(), saveResponse);

        var removeRequest = new MockHttpServletRequest();
        carryCookiesOver(saveResponse, removeRequest);
        var removeResponse = new MockHttpServletResponse();

        var removed = repository.removeAuthorizationRequest(removeRequest, removeResponse);

        assertThat(removed).isNotNull();
        // Un appunto gia' usato che resta nel browser e' un appunto riutilizzabile.
        assertThat(removeResponse.getHeader("Set-Cookie")).contains("Max-Age=0");
    }

    @Test
    void anAbsentCookieIsNotAnError() {
        // Chi arriva sul callback senza essere passato dall'andata (link vecchio,
        // cookie scaduto) deve ricevere l'errore OAuth, non un'eccezione.
        assertThat(repository.loadAuthorizationRequest(new MockHttpServletRequest())).isNull();
    }

    @Test
    void aTamperedCookieIsTreatedAsMissing() {
        var request = new MockHttpServletRequest();
        request.setCookies(new Cookie("oauth2_auth_request", "questo-non-e-un-oggetto-serializzato"));

        assertThat(repository.loadAuthorizationRequest(request)).isNull();
    }

    @Test
    void aSerialisedPayloadOfAnotherClassIsRefused() throws Exception {
        // Il filtro sulla deserializzazione: nel cookie puo' entrare solo cio' che una
        // richiesta di autorizzazione contiene davvero. Qui ci si mette una classe
        // fuori lista e deve essere scartata, non istanziata.
        var bytes = new java.io.ByteArrayOutputStream();
        try (var out = new java.io.ObjectOutputStream(bytes)) {
            out.writeObject(new java.io.File("/etc/passwd"));
        }
        String payload = java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(bytes.toByteArray());

        var request = new MockHttpServletRequest();
        request.setCookies(new Cookie("oauth2_auth_request", payload));

        assertThat(repository.loadAuthorizationRequest(request)).isNull();
    }

    @Test
    void savingANullRequestClearsTheCookie() {
        var response = new MockHttpServletResponse();

        // Spring chiama cosi' per dire "buttala via".
        repository.saveAuthorizationRequest(null, new MockHttpServletRequest(), response);

        assertThat(response.getHeader("Set-Cookie")).contains("Max-Age=0");
    }
}
