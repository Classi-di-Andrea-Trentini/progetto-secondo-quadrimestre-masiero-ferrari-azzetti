package it.commonera.backend.services;

import it.commonera.backend.entities.Order;
import it.commonera.backend.entities.OrderStatus;
import it.commonera.backend.entities.OrderStatusHistory;
import it.commonera.backend.entities.Payment;
import it.commonera.backend.repositories.CartRepository;
import it.commonera.backend.repositories.OrderRepository;
import it.commonera.backend.repositories.PaymentRepository;
import it.commonera.backend.repositories.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Fase B del checkout: la conferma del fornitore.
 *
 * E' l'**unico** posto che puo' dichiarare pagato un ordine. Non si fida di chi
 * chiama: l'autenticazione e' la firma dell'evento, verificata dentro
 * {@link PaymentGateway#parseWebhook} prima ancora di guardarne il contenuto.
 *
 * Deve essere idempotente perche' Stripe **ripete** gli eventi — e' documentato,
 * non e' un caso limite. La guardia e' la transizione atomica `pending → paid`:
 * se non tocca nessuna riga, qualcun altro (o lo stesso evento consegnato due
 * volte) e' gia' passato di qui, e si esce **prima** di accreditare i punti.
 */
@Service
public class PaymentWebhookService {

    private static final Logger log = LoggerFactory.getLogger(PaymentWebhookService.class);

    private final PaymentGateway gateway;
    private final PaymentRepository payments;
    private final OrderRepository orders;
    private final CartRepository carts;
    private final LoyaltyService loyalty;
    private final OrderCompensationService compensation;
    private final UserRepository users;
    private final MailService mail;

    public PaymentWebhookService(PaymentGateway gateway, PaymentRepository payments,
                                 OrderRepository orders, CartRepository carts,
                                 LoyaltyService loyalty, OrderCompensationService compensation,
                                 UserRepository users, MailService mail) {
        this.gateway = gateway;
        this.payments = payments;
        this.orders = orders;
        this.carts = carts;
        this.loyalty = loyalty;
        this.compensation = compensation;
        this.users = users;
        this.mail = mail;
    }

    @Transactional
    public void handle(String payload, String signatureHeader) {
        var event = gateway.parseWebhook(payload, signatureHeader);

        var payment = payments.findByProviderTxId(event.intentId()).orElse(null);
        if (payment == null) {
            // Evento di un altro ambiente, o di un ordine gia' ripulito. Non e'
            // un errore: rispondere male farebbe ritentare il fornitore
            // all'infinito su qualcosa che qui non esiste.
            log.info("Evento per un pagamento sconosciuto ({}), ignorato", event.intentId());
            return;
        }

        switch (event.type()) {
            case "payment_intent.succeeded" -> confirm(payment, event);
            case "payment_intent.payment_failed", "payment_intent.canceled" -> fail(payment, event);
            default -> log.debug("Evento {} ignorato", event.type());
        }
    }

    private void confirm(Payment payment, PaymentGateway.Event event) {
        var order = orders.findById(payment.getOrderId()).orElse(null);
        if (order == null) return;

        // Qui sta tutta l'idempotenza: la seconda consegna dello stesso evento
        // trova l'ordine gia' `paid` e non tocca nessuna riga, quindi non arriva
        // mai ad accreditare i punti una seconda volta.
        if (orders.updateStatusIfCurrentIn(order.getId(), OrderStatus.paid, List.of(OrderStatus.pending)) == 0) {
            log.info("Ordine {} gia' confermato: evento ripetuto, ignorato", order.getId());
            return;
        }
        order.setStatus(OrderStatus.paid);

        payment.setStatus(Payment.PaymentStatus.succeeded);
        payment.setPaidAt(LocalDateTime.now());
        payment.setProviderPayload(event.rawJson());
        payments.save(payment);

        addHistory(order, OrderStatus.paid, "Pagamento confermato dal fornitore");

        // Punti sull'imponibile davvero scontato, e carrello svuotato: le due
        // cose che seguono l'incasso, non la prenotazione.
        loyalty.award(order.getUserId(), order.getId(),
                order.getSubtotal().subtract(order.getDiscountTotal()));
        emptyCart(order);
        sendConfirmation(order);
    }

    /**
     * La conferma parte da qui, a incasso avvenuto: annunciare un ordine che
     * potrebbe ancora essere annullato per mancato pagamento sarebbe peggio del
     * silenzio. Un'email fallita non fa fallire l'incasso — `send` cattura e
     * registra da solo.
     */
    private void sendConfirmation(Order order) {
        users.findById(order.getUserId()).ifPresent(user -> {
            var lines = order.getItems().stream()
                    .map(item -> new MailService.Line(item.getProductName(), item.getVariantLabel(),
                            item.getQuantity(), item.getUnitPrice()))
                    .toList();
            var number = order.getInvoiceNumber() != null
                    ? order.getInvoiceNumber() : order.getId().toString();
            mail.sendOrderConfirmation(user.getEmail(), user.getFullName(), number,
                    order.getTotal(), lines);
        });
    }

    private void fail(Payment payment, PaymentGateway.Event event) {
        payment.setStatus(Payment.PaymentStatus.failed);
        payment.setFailedReason(event.type());
        payment.setProviderPayload(event.rawJson());
        payments.save(payment);

        orders.findById(payment.getOrderId()).ifPresent(order ->
                compensation.releaseAndCancel(order, List.of(OrderStatus.pending), null,
                        "Pagamento non riuscito"));
    }

    /**
     * Svuota il carrello delle righe che sono finite nell'ordine. Si guarda
     * l'ordine, non la richiesta originale: quando arriva la conferma la
     * richiesta di checkout e' finita da un pezzo.
     */
    private void emptyCart(Order order) {
        carts.findByUserId(order.getUserId()).ifPresent(cart -> {
            for (var orderItem : order.getItems()) {
                cart.getItems().stream()
                        .filter(i -> i.getVariant().getId().equals(orderItem.getVariantId()))
                        .findFirst()
                        .ifPresent(item -> {
                            // Chi ne aveva tre e ne ordina uno deve ritrovarsi gli altri due.
                            if (item.getQuantity() > orderItem.getQuantity()) {
                                item.setQuantity(item.getQuantity() - orderItem.getQuantity());
                            } else {
                                cart.getItems().remove(item);
                            }
                        });
            }
            // Niente `save()`: il carrello e' gia' gestito dalla sessione e le
            // modifiche vengono scritte al flush. Chiamarlo farebbe un merge, e
            // il merge prova a cancellare la riga **staccata** appena rimossa
            // dalla collezione, andando in DetachedObjectException.
        });
    }

    private void addHistory(Order order, OrderStatus status, String note) {
        var entry = new OrderStatusHistory();
        entry.setOrder(order);
        entry.setStatus(status);
        // Nessun attore: non e' stata una persona, e' stato il fornitore.
        entry.setChangedBy(null);
        entry.setNote(note);
        order.getStatusHistory().add(entry);
    }
}
