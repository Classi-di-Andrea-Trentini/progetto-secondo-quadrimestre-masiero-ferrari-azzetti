package it.commonera.backend.services;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Il fornitore di pagamento, dietro un'interfaccia. Non e' astrazione per il
 * gusto di astrarre: senza, la suite di test dovrebbe parlare con Stripe per
 * poter provare il percorso dei soldi, e il progetto scolastico non
 * funzionerebbe piu' senza chiavi.
 */
public interface PaymentGateway {

    record Intent(String id, String clientSecret) {}

    record Event(String type, String intentId, String rawJson) {}

    Intent createIntent(BigDecimal amount, String currency, UUID orderId);

    void cancelIntent(String intentId);

    /** @return id del rimborso presso il fornitore. */
    String refund(String intentId, BigDecimal amount);

    /** Verifica la firma e traduce l'evento. Lancia se la firma non torna. */
    Event parseWebhook(String payload, String signatureHeader);

    /** Falso quando l'incasso non e' reale: va detto, non nascosto. */
    boolean isReal();
}
