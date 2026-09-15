package it.commonera.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Configurazione del fornitore di pagamento.
 *
 * Tutte e tre le chiavi sono **facoltative**: senza, il checkout resta quello
 * simulato e l'applicazione parte lo stesso. E' una scelta, non una dimenticanza —
 * questo repo nasce come progetto scolastico e deve continuare a funzionare in mano
 * a chi non ha un account Stripe.
 *
 * Il segreto del webhook entra in {@link #enabled()} insieme alla chiave segreta:
 * incassare senza poter verificare la firma della conferma lascerebbe ordini pagati
 * davvero e mai portati a `paid`, cioe' merce incassata e mai spedita.
 */
@ConfigurationProperties(prefix = "app.stripe")
public record StripeProperties(String secretKey, String publishableKey, String webhookSecret) {

    public boolean enabled() {
        return notBlank(secretKey) && notBlank(webhookSecret);
    }

    private static boolean notBlank(String value) {
        return value != null && !value.isBlank();
    }
}
