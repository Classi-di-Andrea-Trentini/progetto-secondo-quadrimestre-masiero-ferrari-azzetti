package it.commonera.backend.controllers;

import it.commonera.backend.config.StripeProperties;
import it.commonera.backend.exceptions.ApiException;
import it.commonera.backend.repositories.OrderRepository;
import it.commonera.backend.repositories.PaymentRepository;
import it.commonera.backend.security.CurrentUser;
import it.commonera.backend.services.PaymentGateway;
import it.commonera.backend.services.PaymentWebhookService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/payments")
public class PaymentsController {

    private final StripeProperties stripe;
    private final PaymentGateway gateway;
    private final PaymentRepository payments;
    private final OrderRepository orders;
    private final PaymentWebhookService webhook;

    public PaymentsController(StripeProperties stripe, PaymentGateway gateway,
                              PaymentRepository payments, OrderRepository orders,
                              PaymentWebhookService webhook) {
        this.stripe = stripe;
        this.gateway = gateway;
        this.payments = payments;
        this.orders = orders;
        this.webhook = webhook;
    }

    /**
     * Quel poco che il browser deve sapere: se l'incasso e' reale e con quale
     * chiave **pubblicabile** parlare con Stripe. La chiave segreta non esce di
     * qui, e senza questa risposta il frontend non saprebbe se mostrare il
     * modulo della carta o il percorso simulato.
     */
    @GetMapping("/config")
    public Map<String, Object> config() {
        return Map.of(
                "enabled", gateway.isReal(),
                "publishableKey", stripe.publishableKey() == null ? "" : stripe.publishableKey());
    }

    /**
     * Conferma un ordine **quando il fornitore non e' reale**.
     *
     * Non e' una scorciatoia per saltare il pagamento: passa dallo stesso
     * {@link PaymentWebhookService} del percorso vero, quindi l'ordine diventa
     * `paid` per la stessa strada, con la stessa idempotenza, gli stessi punti e
     * la stessa email. Con Stripe configurato risponde 404: non deve esistere un
     * modo di dichiarare pagato un ordine senza pagarlo.
     */
    @PostMapping("/simulate/{orderId}")
    public ResponseEntity<Void> simulate(@AuthenticationPrincipal CurrentUser user,
                                         @PathVariable UUID orderId) {
        if (gateway.isReal()) {
            throw ApiException.notFound("Not found");
        }
        // L'ordine dev'essere di chi chiama: altrimenti basterebbe conoscere un
        // id per confermare l'ordine di qualcun altro.
        var order = orders.findByIdAndUserId(orderId, user.id())
                .orElseThrow(() -> ApiException.notFound("Ordine non trovato"));
        var payment = payments.findByOrderId(order.getId())
                .orElseThrow(() -> ApiException.badRequest("Nessun pagamento da confermare"));
        if (payment.getProviderTxId() == null) {
            throw ApiException.badRequest("Questo ordine non aspetta nessun incasso");
        }

        webhook.handle("{\"type\":\"payment_intent.succeeded\",\"intent\":\""
                + payment.getProviderTxId() + "\"}", null);
        return ResponseEntity.ok().build();
    }
}
