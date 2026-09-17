package it.commonera.backend.services;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import it.commonera.backend.exceptions.ApiException;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Il fornitore finto: nessuna rete, nessun incasso. E' quello che gira quando
 * le chiavi Stripe non ci sono — cioe' nei test e su ogni installazione
 * scolastica — e quello che rende provabile il percorso dei soldi.
 *
 * Gli id nascono con il prefisso <code>sim_</code> apposta: un pagamento finto
 * che si spaccia per vero in banca dati sarebbe peggio di nessun pagamento.
 */
public class SimulatedPaymentGateway implements PaymentGateway {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Override
    public Intent createIntent(BigDecimal amount, String currency, UUID orderId) {
        String id = "sim_pi_" + UUID.randomUUID();
        return new Intent(id, id + "_secret");
    }

    @Override
    public void cancelIntent(String intentId) {
        // Niente da annullare: non c'e' nessuna riserva di denaro dall'altra parte.
    }

    @Override
    public String refund(String intentId, BigDecimal amount) {
        return "sim_re_" + UUID.randomUUID();
    }

    /**
     * Legge il proprio formato, che e' volutamente piatto
     * (<code>{"type": ..., "intent": ...}</code>): nessuna firma da verificare,
     * perche' non c'e' nessun mittente esterno di cui dubitare.
     */
    @Override
    public Event parseWebhook(String payload, String signatureHeader) {
        try {
            JsonNode root = MAPPER.readTree(payload);
            String type = root.path("type").asString(null);
            String intentId = root.path("intent").asString(null);
            if (type == null || intentId == null) {
                throw ApiException.badRequest("Simulated webhook missing 'type' or 'intent'");
            }
            return new Event(type, intentId, payload);
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            throw ApiException.badRequest("Unreadable simulated webhook");
        }
    }

    @Override
    public boolean isReal() {
        return false;
    }
}
