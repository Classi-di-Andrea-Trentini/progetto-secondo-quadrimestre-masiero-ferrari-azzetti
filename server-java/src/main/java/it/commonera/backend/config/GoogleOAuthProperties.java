package it.commonera.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Credenziali di "Accedi con Google".
 *
 * Sono **facoltative**, esattamente come quelle di Stripe (vedi
 * {@link StripeProperties}): senza, l'applicazione parte lo stesso, le rotte OAuth
 * non vengono registrate e il frontend non mostra il bottone. Questo repo nasce
 * come progetto scolastico e deve continuare a funzionare in mano a chi un
 * progetto sulla Google Cloud Console non ce l'ha.
 *
 * L'URI di ritorno entra in {@link #enabled()} insieme alle due chiavi perche'
 * senza il giro non si chiude: Google rimanda il browser li' e basta, e un valore
 * vuoto darebbe un errore `redirect_uri_mismatch` a fine giro invece che un
 * avviso nel log all'avvio. Meglio spento che rotto a meta'.
 */
@ConfigurationProperties(prefix = "app.google")
public record GoogleOAuthProperties(String clientId, String clientSecret, String redirectUri) {

    /** Un solo fornitore, quindi un solo identificativo di registrazione. */
    public static final String REGISTRATION_ID = "google";

    /** Da dove parte il giro. Il bottone del frontend punta qui. */
    public static final String AUTHORIZATION_BASE_URI = "/auth/oauth2/authorize";

    /** Dove Google rimanda il browser. Deve combaciare con la Google Cloud Console. */
    public static final String CALLBACK_BASE_URI = "/auth/oauth2/callback";

    public boolean enabled() {
        return notBlank(clientId) && notBlank(clientSecret) && notBlank(redirectUri);
    }

    /**
     * L'indirizzo **assoluto** da cui far partire l'accesso, quello che finisce nel
     * bottone "Accedi con Google".
     *
     * Si ricava dall'URI di ritorno invece di essere una seconda impostazione: i due
     * indirizzi differiscono per un solo segmento di percorso, e tenerli separati
     * significherebbe poterli configurare incoerenti — con l'unico sintomo, a fine
     * giro, un `redirect_uri_mismatch` di Google che non dice dove guardare.
     *
     * Deve essere assoluto e puntare al **backend**: il giro OAuth non passa dal proxy
     * del frontend, perche' quel proxy riscrive l'intestazione `Host` e Spring Security
     * confronta l'URL della richiesta di ritorno con l'URI registrato, carattere per
     * carattere.
     */
    public String authorizationUrl() {
        if (!notBlank(redirectUri)) return null;

        String callbackSuffix = CALLBACK_BASE_URI + "/" + REGISTRATION_ID;
        String authorizeSuffix = AUTHORIZATION_BASE_URI + "/" + REGISTRATION_ID;

        if (redirectUri.endsWith(callbackSuffix)) {
            return redirectUri.substring(0, redirectUri.length() - callbackSuffix.length()) + authorizeSuffix;
        }
        // URI di ritorno riscritto a mano: si conserva almeno l'origine e si rimette
        // la forma standard, con il context-path dell'applicazione (`/api`).
        try {
            var uri = java.net.URI.create(redirectUri);
            return uri.getScheme() + "://" + uri.getAuthority() + "/api" + authorizeSuffix;
        } catch (RuntimeException e) {
            return null;
        }
    }

    private static boolean notBlank(String value) {
        return value != null && !value.isBlank();
    }
}
