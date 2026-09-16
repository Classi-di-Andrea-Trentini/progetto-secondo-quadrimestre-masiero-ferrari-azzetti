package it.commonera.backend.controllers;

import it.commonera.backend.services.PaymentWebhookService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/payments")
public class PaymentWebhookController {

    private final PaymentWebhookService service;

    public PaymentWebhookController(PaymentWebhookService service) {
        this.service = service;
    }

    /**
     * Il corpo si legge **grezzo**. Deserializzarlo in un DTO e riserializzarlo
     * cambia i byte, e la firma, che e' calcolata su quelli originali, non torna
     * piu': il webhook verrebbe rifiutato sempre.
     */
    @PostMapping("/webhook")
    public ResponseEntity<Void> webhook(@RequestBody String payload,
                                        @RequestHeader(value = "Stripe-Signature", required = false) String signature) {
        service.handle(payload, signature);
        return ResponseEntity.ok().build();
    }
}
