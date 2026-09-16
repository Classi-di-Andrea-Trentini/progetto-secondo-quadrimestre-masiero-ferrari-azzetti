package it.commonera.backend.security;

import it.commonera.backend.exceptions.ApiException;
import it.commonera.backend.services.GoogleAccountService;
import it.commonera.backend.services.GoogleIdentity;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/**
 * Il ritorno da Google, tradotto nella sessione di casa.
 *
 * Spring Security a questo punto ha gia' fatto la sua parte: ha scambiato il codice
 * con l'{@code id_token}, ne ha verificato la firma contro le chiavi pubbliche di
 * Google, l'emittente, il destinatario, la scadenza e il `nonce`. Quello che arriva
 * qui e' quindi un'identita' attendibile — ma e' l'identita' di un account
 * <i>Google</i>, e decidere a quale account <i>nostro</i> corrisponda e' un'altra
 * cosa: lo fa {@link GoogleAccountService}, con le sue regole di fusione.
 *
 * Da qui in poi non resta traccia di OAuth: si scrive lo stesso cookie HttpOnly del
 * login con password e si rimanda al frontend. L'{@code id_token} non arriva mai al
 * JavaScript della pagina, ed e' il motivo per cui questo giro sta lato server.
 */
public class GoogleLoginSuccessHandler implements AuthenticationSuccessHandler {

    private static final Logger log = LoggerFactory.getLogger(GoogleLoginSuccessHandler.class);

    private final GoogleAccountService google;
    private final long ttlSeconds;
    private final boolean secureCookies;
    private final String frontendUrl;

    public GoogleLoginSuccessHandler(GoogleAccountService google, long ttlSeconds,
                                     boolean secureCookies, String frontendUrl) {
        this.google = google;
        this.ttlSeconds = ttlSeconds;
        this.secureCookies = secureCookies;
        this.frontendUrl = frontendUrl.endsWith("/") ? frontendUrl.substring(0, frontendUrl.length() - 1) : frontendUrl;
    }

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
                                        Authentication authentication) throws IOException {
        if (!(authentication.getPrincipal() instanceof OidcUser principal)) {
            // Senza `scope=openid` non arriverebbe un OidcUser ma un OAuth2User, e con
            // esso nessun id_token verificato. Sarebbe un errore di configurazione, non
            // dell'utente: si ferma qui invece di accontentarsi di attributi non firmati.
            log.error("Ritorno da Google senza id_token: controllare che lo scope 'openid' sia richiesto.");
            redirect(response, "/login", "Accesso con Google non riuscito");
            return;
        }

        var identity = new GoogleIdentity(
                principal.getSubject(),
                principal.getEmail(),
                // `email_verified` puo' mancare del tutto: assente vale come falso, mai
                // come vero. E' il campo su cui si decide dentro quale account entrare.
                Boolean.TRUE.equals(principal.getEmailVerified()),
                principal.getFullName());

        try {
            var issued = google.signIn(identity, request.getHeader("User-Agent"));
            response.addHeader(HttpHeaders.SET_COOKIE,
                    AuthCookie.session(issued.token(), ttlSeconds, secureCookies).toString());
            redirect(response, "/me", null);
        } catch (ApiException e) {
            // Rifiuto previsto (indirizzo non verificato, account gia' collegato
            // altrove, account sospeso): il messaggio e' scritto per essere letto da
            // una persona, quindi finisce sulla pagina di accesso.
            log.info("Accesso con Google rifiutato: {}", e.getMessage());
            redirect(response, "/login", e.getMessage());
        }
    }

    private void redirect(HttpServletResponse response, String path, String errorMessage) throws IOException {
        String target = frontendUrl + path;
        if (errorMessage != null) {
            target += "?error=" + URLEncoder.encode(errorMessage, StandardCharsets.UTF_8);
        }
        response.sendRedirect(target);
    }
}
