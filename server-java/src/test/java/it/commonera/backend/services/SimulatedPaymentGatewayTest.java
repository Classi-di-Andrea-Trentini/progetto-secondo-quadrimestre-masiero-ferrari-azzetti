package it.commonera.backend.services;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Il doppio del fornitore di pagamento. La suite non deve parlare con Stripe:
 * senza questo, provare il percorso dei soldi richiederebbe delle chiavi vere.
 */
class SimulatedPaymentGatewayTest {

    private final SimulatedPaymentGateway gateway = new SimulatedPaymentGateway();

    @Test
    void createsAnIntentThatLooksLikeStripesButIsNotReal() {
        var intent = gateway.createIntent(new BigDecimal("12.34"), "EUR", UUID.randomUUID());
        assertTrue(intent.id().startsWith("sim_pi_"));
        assertNotNull(intent.clientSecret());
        assertFalse(gateway.isReal());
    }

    @Test
    void parsesItsOwnWebhookWithoutASignature() {
        var event = gateway.parseWebhook("{\"type\":\"payment_intent.succeeded\",\"intent\":\"sim_pi_1\"}", null);
        assertEquals("payment_intent.succeeded", event.type());
        assertEquals("sim_pi_1", event.intentId());
    }
}
