package it.commonera.backend.config;

import it.commonera.backend.security.CookieOAuth2AuthorizationRequestRepository;
import it.commonera.backend.security.GoogleLoginCustomizer;
import it.commonera.backend.security.GoogleLoginSuccessHandler;
import it.commonera.backend.security.JwtService;
import it.commonera.backend.services.GoogleAccountService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizedClientRepository;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.core.oidc.IdTokenClaimNames;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/**
 * Accende (o non accende) l'accesso con Google.
 *
 * Stesso modello di {@link PaymentConfig}: mancano le credenziali? Si parte lo
 * stesso, ma **scritto nel log**, e il pezzo semplicemente non c'e' — nessuna rotta
 * OAuth registrata, e {@code /config} dira' al frontend di non mostrare il bottone.
 * E' la differenza fra un progetto che chiunque puo' clonare e far girare e uno che
 * si rifiuta di partire senza un account sulla Google Cloud Console.
 */
@Configuration
public class GoogleOAuthConfig {

    private static final Logger log = LoggerFactory.getLogger(GoogleOAuthConfig.class);

    @Bean
    GoogleLoginCustomizer googleLoginCustomizer(GoogleOAuthProperties props,
                                                GoogleAccountService accounts,
                                                JwtService jwt,
                                                @Value("${app.cookie.secure:false}") boolean secureCookies,
                                                @Value("${app.frontend-url}") String frontendUrl) {
        if (!props.enabled()) {
            log.warn("GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET non configurati: "
                    + "\"Accedi con Google\" resta spento e il bottone non compare nel frontend.");
            return GoogleLoginCustomizer.disabled();
        }

        var registrations = new InMemoryClientRegistrationRepository(googleRegistration(props));
        var authorizationRequests = new CookieOAuth2AuthorizationRequestRepository(secureCookies);
        var success = new GoogleLoginSuccessHandler(accounts, jwt.ttlSeconds(), secureCookies, frontendUrl);
        String loginPage = trimSlash(frontendUrl) + "/login";

        log.info("\"Accedi con Google\" configurato: ritorno su {}", props.redirectUri());

        return http -> http.oauth2Login(oauth -> oauth
                .clientRegistrationRepository(registrations)
                // Niente deposito del client autorizzato: quello di serie userebbe la
                // HttpSession (che qui non esiste, la politica e' STATELESS) e terrebbe
                // da parte access token e refresh token di Google. Non ce ne facciamo
                // niente — non chiamiamo nessuna API per conto dell'utente — e un
                // credenziale conservata senza uno scopo e' solo una da custodire.
                .authorizedClientRepository(NO_AUTHORIZED_CLIENTS)
                .authorizationEndpoint(endpoint -> endpoint
                        .baseUri(GoogleOAuthProperties.AUTHORIZATION_BASE_URI)
                        .authorizationRequestRepository(authorizationRequests))
                .redirectionEndpoint(endpoint -> endpoint
                        .baseUri(GoogleOAuthProperties.CALLBACK_BASE_URI + "/*"))
                .successHandler(success)
                .failureHandler((request, response, exception) -> {
                    // Consenso negato, `state` non piu' valido, Google irraggiungibile:
                    // la pagina di accesso e' l'unico posto sensato dove far atterrare
                    // una persona. Il messaggio tecnico resta nel log, non nell'URL.
                    log.info("Giro OAuth con Google non riuscito: {}", exception.getMessage());
                    response.sendRedirect(loginPage + "?error=" + URLEncoder.encode(
                            "Accesso con Google non riuscito. Riprova, oppure entra con email e password.",
                            StandardCharsets.UTF_8));
                }));
    }

    /**
     * Gli indirizzi di Google, scritti a mano.
     *
     * Si potrebbe usare la scoperta automatica (`issuer-uri`), ma quella fa una
     * chiamata di rete **all'avvio**: senza internet l'applicazione non partirebbe
     * piu', e un backend che non parte perche' non riesce a contattare Google e' un
     * prezzo troppo alto per una manciata di URL che non cambiano mai.
     */
    private static ClientRegistration googleRegistration(GoogleOAuthProperties props) {
        return ClientRegistration.withRegistrationId(GoogleOAuthProperties.REGISTRATION_ID)
                .clientId(props.clientId())
                .clientSecret(props.clientSecret())
                .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .redirectUri(props.redirectUri())
                // `openid` non e' facoltativo: senza, Google non emette l'id_token e al
                // ritorno non ci sarebbe niente di firmato da verificare — solo attributi
                // presi da una chiamata REST.
                .scope("openid", "email", "profile")
                .authorizationUri("https://accounts.google.com/o/oauth2/v2/auth")
                .tokenUri("https://oauth2.googleapis.com/token")
                .userInfoUri("https://openidconnect.googleapis.com/v1/userinfo")
                .userNameAttributeName(IdTokenClaimNames.SUB)
                .jwkSetUri("https://www.googleapis.com/oauth2/v3/certs")
                .issuerUri("https://accounts.google.com")
                .clientName("Google")
                .build();
    }

    private static String trimSlash(String url) {
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }

    /** Non si conserva niente: vedi il commento su `authorizedClientRepository`. */
    private static final OAuth2AuthorizedClientRepository NO_AUTHORIZED_CLIENTS =
            new OAuth2AuthorizedClientRepository() {
                @Override
                public <T extends OAuth2AuthorizedClient> T loadAuthorizedClient(
                        String registrationId, org.springframework.security.core.Authentication principal,
                        HttpServletRequest request) {
                    return null;
                }

                @Override
                public void saveAuthorizedClient(OAuth2AuthorizedClient authorizedClient,
                                                 org.springframework.security.core.Authentication principal,
                                                 HttpServletRequest request, HttpServletResponse response) {
                    // volutamente vuoto
                }

                @Override
                public void removeAuthorizedClient(String registrationId,
                                                   org.springframework.security.core.Authentication principal,
                                                   HttpServletRequest request, HttpServletResponse response) {
                    // volutamente vuoto
                }
            };
}
