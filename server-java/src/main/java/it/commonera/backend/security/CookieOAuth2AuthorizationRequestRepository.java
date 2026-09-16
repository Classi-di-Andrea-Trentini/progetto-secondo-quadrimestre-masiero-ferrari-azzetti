package it.commonera.backend.security;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseCookie;
import org.springframework.security.oauth2.client.web.AuthorizationRequestRepository;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.ObjectInputFilter;
import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.time.Duration;
import java.util.Base64;

/**
 * Dove sta la richiesta di autorizzazione fra l'andata verso Google e il ritorno.
 *
 * Spring Security la terrebbe nella {@code HttpSession}, ma questo backend gira con
 * {@code SessionCreationPolicy.STATELESS}: di sessioni servlet non ne esistono, e
 * senza la richiesta salvata il controllo del parametro `state` al ritorno fallisce
 * con `authorization_request_not_found`. Quel controllo non e' un dettaglio
 * burocratico: e' cio' che impedisce a un terzo di far arrivare al nostro callback
 * un codice di autorizzazione ottenuto altrove (CSRF sul login).
 *
 * Quindi la richiesta viaggia in un cookie, con gli stessi attributi di sicurezza del
 * cookie di sessione (HttpOnly, SameSite=Lax, Secure pilotato dalla configurazione) e
 * una vita di pochi minuti: e' un appunto valido per il tempo di un giro, non una
 * sessione. SameSite=Lax basta perche' il ritorno da Google e' una navigazione
 * di primo livello in GET, che Lax lascia passare.
 *
 * <h2>Perche' la deserializzazione qui dentro non e' un buco</h2>
 *
 * Il contenuto e' l'oggetto serializzato: rimontarlo campo per campo significherebbe
 * ricostruire a mano `nonce`, `code_verifier` e gli attributi interni, cioe' proprio i
 * valori che se sbagliati fanno fallire la verifica dell'id_token — e senza credenziali
 * Google vere non si potrebbe provare che il rimontaggio e' corretto. In cambio, la
 * lettura passa per un {@link ObjectInputFilter} che ammette solo le classi che questo
 * oggetto puo' contenere: un cookie fabbricato ad arte non puo' far istanziare niente
 * di diverso, e le catene di gadget classiche non partono nemmeno.
 */
public final class CookieOAuth2AuthorizationRequestRepository
        implements AuthorizationRequestRepository<OAuth2AuthorizationRequest> {

    private static final Logger log = LoggerFactory.getLogger(CookieOAuth2AuthorizationRequestRepository.class);

    static final String COOKIE_NAME = "oauth2_auth_request";

    /**
     * Cinque minuti: quanto basta per una schermata di consenso, non abbastanza per
     * lasciare in giro un appunto riutilizzabile.
     */
    private static final Duration TTL = Duration.ofMinutes(5);

    /**
     * I browser rifiutano in silenzio i cookie oltre i 4 KB, e un cookie rifiutato
     * qui diventa un "authorization_request_not_found" incomprensibile a fine giro.
     * Meglio accorgersene nel log.
     */
    private static final int MAX_COOKIE_BYTES = 3_800;

    /**
     * Solo le classi che un {@link OAuth2AuthorizationRequest} contiene davvero.
     * Il {@code !*} finale rifiuta tutto il resto.
     */
    private static final ObjectInputFilter FILTER = ObjectInputFilter.Config.createFilter(
            "org.springframework.security.oauth2.core.**;"
                    + "org.springframework.security.oauth2.client.**;"
                    + "java.util.**;java.lang.**;!*");

    private final boolean secureCookies;

    public CookieOAuth2AuthorizationRequestRepository(boolean secureCookies) {
        this.secureCookies = secureCookies;
    }

    @Override
    public OAuth2AuthorizationRequest loadAuthorizationRequest(HttpServletRequest request) {
        return readCookie(request).map(CookieOAuth2AuthorizationRequestRepository::deserialize).orElse(null);
    }

    @Override
    public void saveAuthorizationRequest(OAuth2AuthorizationRequest authorizationRequest,
                                         HttpServletRequest request, HttpServletResponse response) {
        // Spring chiama questo metodo con `null` per dire "buttala via".
        if (authorizationRequest == null) {
            response.addHeader("Set-Cookie", cookie("", 0).toString());
            return;
        }

        String value = serialize(authorizationRequest);
        if (value.length() > MAX_COOKIE_BYTES) {
            log.warn("Richiesta di autorizzazione OAuth troppo grande per un cookie ({} byte): "
                    + "il browser potrebbe scartarla e il ritorno da Google fallirebbe.", value.length());
        }
        response.addHeader("Set-Cookie", cookie(value, TTL.getSeconds()).toString());
    }

    @Override
    public OAuth2AuthorizationRequest removeAuthorizationRequest(HttpServletRequest request,
                                                                 HttpServletResponse response) {
        var loaded = loadAuthorizationRequest(request);
        // Si cancella sempre, anche quando non c'era niente da leggere: un appunto
        // gia' usato che resta nel browser e' un appunto riutilizzabile.
        response.addHeader("Set-Cookie", cookie("", 0).toString());
        return loaded;
    }

    private ResponseCookie cookie(String value, long maxAgeSeconds) {
        return ResponseCookie.from(COOKIE_NAME, value)
                .httpOnly(true)
                .secure(secureCookies)
                .path("/")
                .sameSite("Lax")
                .maxAge(Duration.ofSeconds(maxAgeSeconds))
                .build();
    }

    private static java.util.Optional<String> readCookie(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return java.util.Optional.empty();
        for (Cookie c : cookies) {
            if (COOKIE_NAME.equals(c.getName()) && c.getValue() != null && !c.getValue().isEmpty()) {
                return java.util.Optional.of(c.getValue());
            }
        }
        return java.util.Optional.empty();
    }

    static String serialize(OAuth2AuthorizationRequest authorizationRequest) {
        try (var bytes = new ByteArrayOutputStream(); var out = new ObjectOutputStream(bytes)) {
            out.writeObject(authorizationRequest);
            out.flush();
            // URL-safe senza padding: il valore di un cookie non ammette `+`, `/` e `=`.
            return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes.toByteArray());
        } catch (Exception e) {
            throw new IllegalStateException("Impossibile serializzare la richiesta di autorizzazione OAuth", e);
        }
    }

    static OAuth2AuthorizationRequest deserialize(String value) {
        try (var in = new ObjectInputStream(new ByteArrayInputStream(Base64.getUrlDecoder().decode(value)))) {
            in.setObjectInputFilter(FILTER);
            return (OAuth2AuthorizationRequest) in.readObject();
        } catch (Exception e) {
            // Cookie scaduto a meta', troncato o manomesso: vale come "non c'e'". Il
            // filtro OAuth rispondera' con il suo errore, che e' la cosa giusta — non
            // si deve far cadere la richiesta con una eccezione di serializzazione.
            log.debug("Cookie della richiesta di autorizzazione OAuth illeggibile: {}", e.toString());
            return null;
        }
    }
}
