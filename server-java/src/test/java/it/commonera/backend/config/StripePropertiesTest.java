package it.commonera.backend.config;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class StripePropertiesTest {

    @Test
    void disabledWhenSecretKeyIsBlank() {
        var props = new StripeProperties("", "pk_test_x", "whsec_x");
        assertFalse(props.enabled(), "senza chiave segreta Stripe deve risultare spento");
    }

    @Test
    void disabledWhenSecretKeyIsNull() {
        var props = new StripeProperties(null, "pk_test_x", "whsec_x");
        assertFalse(props.enabled());
    }

    @Test
    void enabledWhenSecretKeyAndWebhookSecretArePresent() {
        var props = new StripeProperties("sk_test_x", "pk_test_x", "whsec_x");
        assertTrue(props.enabled());
    }

    @Test
    void enabledRequiresTheWebhookSecretToo() {
        // Senza segreto del webhook la firma non e' verificabile: incassare senza
        // poter confermare lascerebbe ordini pagati e mai portati a "paid".
        var props = new StripeProperties("sk_test_x", "pk_test_x", "");
        assertFalse(props.enabled());
    }
}
