package it.commonera.backend.config;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Stessa regola di {@link StripePropertiesTest}: senza credenziali il pezzo si
 * spegne da solo e l'applicazione parte lo stesso. Qui conta doppio, perche' e'
 * questo `enabled()` a decidere se le rotte OAuth vengono registrate e se il
 * frontend mostra il bottone.
 */
class GoogleOAuthPropertiesTest {

    private static final String REDIRECT = "http://localhost:3000/api/auth/oauth2/callback/google";

    @Test
    void disabledWhenClientIdIsBlank() {
        assertFalse(new GoogleOAuthProperties("", "secret", REDIRECT).enabled(),
                "senza client id l'accesso con Google deve risultare spento");
    }

    @Test
    void disabledWhenClientSecretIsBlank() {
        assertFalse(new GoogleOAuthProperties("id", "", REDIRECT).enabled());
    }

    @Test
    void disabledWhenBothAreNull() {
        assertFalse(new GoogleOAuthProperties(null, null, REDIRECT).enabled());
    }

    @Test
    void disabledWithoutARedirectUri() {
        // Senza URI di ritorno il giro non si chiude: meglio spento che rotto a meta'.
        assertFalse(new GoogleOAuthProperties("id", "secret", "  ").enabled());
    }

    @Test
    void enabledWhenIdSecretAndRedirectArePresent() {
        assertTrue(new GoogleOAuthProperties("id", "secret", REDIRECT).enabled());
    }

    /**
     * L'indirizzo di partenza si ricava da quello di ritorno invece di essere una
     * seconda impostazione: due valori configurabili separatamente si possono
     * configurare incoerenti, e il sintomo sarebbe un `redirect_uri_mismatch` a fine
     * giro, che non dice dove guardare.
     */
    @Test
    void theAuthorizationUrlIsDerivedFromTheCallbackUrl() {
        assertEquals("http://localhost:3000/api/auth/oauth2/authorize/google",
                new GoogleOAuthProperties("id", "secret", REDIRECT).authorizationUrl());
    }

    @Test
    void theAuthorizationUrlKeepsTheOriginOfACustomCallback() {
        // URI di ritorno riscritto a mano: si conserva almeno l'origine, cosi' il
        // bottone non manda il browser su un host sbagliato.
        assertEquals("https://negozio.example.it/api/auth/oauth2/authorize/google",
                new GoogleOAuthProperties("id", "secret", "https://negozio.example.it/altro/percorso")
                        .authorizationUrl());
    }

    @Test
    void thereIsNoAuthorizationUrlWithoutACallback() {
        assertNull(new GoogleOAuthProperties("id", "secret", "").authorizationUrl());
    }
}
