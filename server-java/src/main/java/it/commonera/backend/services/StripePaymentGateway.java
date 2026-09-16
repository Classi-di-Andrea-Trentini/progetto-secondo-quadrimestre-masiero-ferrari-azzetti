package it.commonera.backend.services;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import com.stripe.StripeClient;
import com.stripe.exception.StripeException;
import com.stripe.model.Charge;
import com.stripe.model.PaymentIntent;
import com.stripe.net.Webhook;
import com.stripe.param.PaymentIntentCreateParams;
import com.stripe.param.RefundCreateParams;
import it.commonera.backend.config.StripeProperties;
import it.commonera.backend.exceptions.ApiException;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Il fornitore vero. Entra in gioco solo quando {@link StripeProperties#enabled()}
 * e' vero, cioe' quando ci sono sia la chiave segreta sia il segreto del webhook.
 *
 * Gli importi verso Stripe sono in **centesimi interi**: passare un decimale
 * arrotondato vorrebbe dire incassare una cifra diversa da quella dell'ordine,
 * quindi la conversione usa {@code longValueExact()}, che lancia invece di
 * arrotondare in silenzio.
 */
public class StripePaymentGateway implements PaymentGateway {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final StripeClient client;
    private final String webhookSecret;

    public StripePaymentGateway(StripeProperties props) {
        this.client = new StripeClient(props.secretKey());
        this.webhookSecret = props.webhookSecret();
    }

    @Override
    public Intent createIntent(BigDecimal amount, String currency, UUID orderId) {
        var params = PaymentIntentCreateParams.builder()
                .setAmount(amount.movePointRight(2).longValueExact())
                .setCurrency(currency.toLowerCase())
                .putMetadata("order_id", orderId.toString())
                .setAutomaticPaymentMethods(
                        PaymentIntentCreateParams.AutomaticPaymentMethods.builder()
                                .setEnabled(true)
                                .build())
                .build();
        try {
            PaymentIntent intent = client.paymentIntents().create(params);
            return new Intent(intent.getId(), intent.getClientSecret());
        } catch (StripeException e) {
            throw ApiException.badRequest("Stripe ha rifiutato la creazione del pagamento: " + e.getMessage());
        }
    }

    @Override
    public void cancelIntent(String intentId) {
        try {
            client.paymentIntents().cancel(intentId);
        } catch (StripeException e) {
            throw ApiException.badRequest("Stripe ha rifiutato l'annullamento del pagamento: " + e.getMessage());
        }
    }

    @Override
    public String refund(String intentId, BigDecimal amount) {
        var params = RefundCreateParams.builder()
                .setPaymentIntent(intentId)
                .setAmount(amount.movePointRight(2).longValueExact())
                .build();
        try {
            return client.refunds().create(params).getId();
        } catch (StripeException e) {
            throw ApiException.badRequest("Stripe ha rifiutato il rimborso: " + e.getMessage());
        }
    }

    /**
     * Verifica la firma **prima** di guardare il contenuto: senza, chiunque
     * conosca l'indirizzo del webhook potrebbe dichiarare pagato un ordine.
     */
    @Override
    public Event parseWebhook(String payload, String signatureHeader) {
        com.stripe.model.Event event;
        try {
            event = Webhook.constructEvent(payload, signatureHeader, webhookSecret);
        } catch (Exception e) {
            throw ApiException.badRequest("Invalid webhook signature");
        }
        return new Event(event.getType(), intentIdOf(event, payload), payload);
    }

    /**
     * L'id del pagamento sta in posti diversi a seconda dell'evento: e' l'oggetto
     * stesso per {@code payment_intent.*}, un campo del {@link Charge} per
     * {@code charge.refunded}. Il deserializzatore di Stripe inoltre **non**
     * restituisce l'oggetto quando la versione di API dell'evento non combacia
     * con quella della libreria, e in quel caso l'unica fonte e' il JSON grezzo.
     */
    private String intentIdOf(com.stripe.model.Event event, String payload) {
        var object = event.getDataObjectDeserializer().getObject().orElse(null);
        if (object instanceof PaymentIntent intent) {
            return intent.getId();
        }
        if (object instanceof Charge charge) {
            return charge.getPaymentIntent();
        }
        try {
            JsonNode data = MAPPER.readTree(payload).path("data").path("object");
            String paymentIntent = data.path("payment_intent").asString(null);
            return paymentIntent != null ? paymentIntent : data.path("id").asString(null);
        } catch (Exception e) {
            return null;
        }
    }

    @Override
    public boolean isReal() {
        return true;
    }
}
