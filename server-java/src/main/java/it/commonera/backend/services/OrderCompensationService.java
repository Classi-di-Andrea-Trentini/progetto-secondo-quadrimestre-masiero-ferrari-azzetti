package it.commonera.backend.services;

import it.commonera.backend.entities.Order;
import it.commonera.backend.entities.OrderStatus;
import it.commonera.backend.entities.OrderStatusHistory;
import it.commonera.backend.entities.OrderStatusMachine;
import it.commonera.backend.entities.Payment;
import it.commonera.backend.exceptions.ApiException;
import it.commonera.backend.repositories.OrderRepository;
import it.commonera.backend.repositories.PaymentRepository;
import it.commonera.backend.repositories.ProductVariantRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.UUID;

/**
 * Disfa un ordine che non e' andato a buon fine, restituendo tutto cio' che il
 * checkout aveva impegnato: giacenza riservata, buono scalato, punti spesi e
 * accreditati.
 *
 * Esiste una volta sola apposta. Lo chiamano tre strade diverse — l'annullamento
 * chiesto dal cliente, il webhook del pagamento fallito e il raccoglitore degli
 * ordini abbandonati — e tre copie della stessa logica divergerebbero al primo
 * cambiamento delle formule, lasciando un percorso che rimborsa e un altro che no.
 *
 * L'ordine dei passi non e' negoziabile: **prima** la transizione atomica di stato,
 * poi tutto il resto. Senza `@Version` sull'ordine, due compensazioni concorrenti
 * leggerebbero entrambe uno stato compensabile e rimborserebbero entrambe. Se la
 * transizione non tocca nessuna riga, qualcun altro e' arrivato prima e qui non si
 * tocca piu' niente.
 */
@Service
public class OrderCompensationService {

    private final OrderRepository orders;
    private final ProductVariantRepository variants;
    private final GiftCardService giftCards;
    private final LoyaltyService loyalty;
    private final PaymentRepository payments;
    private final PaymentGateway gateway;

    public OrderCompensationService(OrderRepository orders, ProductVariantRepository variants,
                                    GiftCardService giftCards, LoyaltyService loyalty,
                                    PaymentRepository payments, PaymentGateway gateway) {
        this.orders = orders;
        this.variants = variants;
        this.giftCards = giftCards;
        this.loyalty = loyalty;
        this.payments = payments;
        this.gateway = gateway;
    }

    /**
     * @param allowedFrom stati dai quali l'ordine puo' essere compensato; la
     *                    transizione avviene solo se lo stato attuale e' fra questi
     * @param actorId     chi ha chiesto l'annullamento, {@code null} se e' stato il
     *                    sistema (webhook o raccoglitore)
     * @return {@code false} se nessuna riga e' stata toccata, cioe' se l'ordine era
     *         gia' stato chiuso da qualcun altro. In quel caso non viene rimborsato
     *         nulla: e' la difesa dal doppio rimborso.
     */
    @Transactional
    public boolean releaseAndCancel(Order order, Collection<OrderStatus> allowedFrom,
                                    UUID actorId, String note) {
        // Va letto **prima** della transizione: dopo, lo stato e' `cancelled` per
        // tutti e non si saprebbe piu' se c'era un incasso da restituire.
        var previous = order.getStatus();

        if (orders.updateStatusIfCurrentIn(order.getId(), OrderStatus.cancelled, allowedFrom) == 0) {
            return false;
        }
        order.setStatus(OrderStatus.cancelled);

        // Solo se qualcuno aveva davvero pagato. Un ordine annullato mentre era
        // ancora `pending` non ha incassi da restituire: rimborsarlo lo stesso
        // sarebbe denaro regalato.
        if (previous == OrderStatus.paid) {
            payments.findByOrderId(order.getId())
                    // Solo un incasso davvero riuscito si rimborsa. Un ordine
                    // portato a `paid` senza conferma del fornitore non deve far
                    // fallire l'annullamento: qui si sta gia' disfacendo tutto, e
                    // rifiutarsi lascerebbe merce e buono bloccati per un difetto
                    // di stato che il cliente non ha causato.
                    .filter(payment -> payment.getStatus() == Payment.PaymentStatus.succeeded
                            || payment.getStatus() == Payment.PaymentStatus.partially_refunded)
                    .ifPresent(payment ->
                            refundCharge(order, outstanding(payment), "Ordine annullato"));
        }

        // La merce torna a magazzino: compensare senza ripristinare la giacenza
        // significa perdere pezzi che nessuno ha mai comprato.
        for (var item : order.getItems()) {
            variants.incrementStock(item.getVariantId(), item.getQuantity());
        }

        // Stesso principio per buono e punti: quello che il checkout ha scalato o
        // accreditato per questo ordine deve tornare indietro, nella stessa
        // transazione dello scalo di magazzino qui sopra.
        if (order.getGiftCardId() != null && order.getGiftCardAmount() != null
                && order.getGiftCardAmount().signum() > 0) {
            giftCards.refund(order.getGiftCardId(), order.getGiftCardAmount(), order.getId());
        }
        loyalty.reverseForOrder(order.getUserId(), order.getId());

        var entry = new OrderStatusHistory();
        entry.setOrder(order);
        entry.setStatus(OrderStatus.cancelled);
        entry.setChangedBy(actorId);
        entry.setNote(note);
        order.getStatusHistory().add(entry);
        return true;
    }

    /**
     * Registra un rimborso su {@code payments} e, se il fornitore e' reale, lo
     * esegue davvero.
     *
     * Il tetto non e' una formalita': {@code refundAmount} arriva da un campo
     * che compila l'amministratore, e senza controllo un errore di battitura
     * restituirebbe piu' di quanto incassato.
     */
    @Transactional
    public void refundCharge(Order order, BigDecimal amount, String reason) {
        if (amount == null || amount.signum() <= 0) return;

        var payment = payments.findByOrderId(order.getId()).orElse(null);
        if (payment == null || payment.getAmount().signum() == 0) {
            // Ordine coperto interamente da buono o da punti: quello che c'era da
            // restituire lo ha gia' restituito `releaseAndCancel`.
            return;
        }
        if (payment.getStatus() == Payment.PaymentStatus.pending
                || payment.getStatus() == Payment.PaymentStatus.failed) {
            throw ApiException.badRequest("Non c'e' nessun incasso da rimborsare per questo ordine");
        }

        var alreadyRefunded = payment.getRefundedAmount() == null
                ? BigDecimal.ZERO : payment.getRefundedAmount();
        var total = alreadyRefunded.add(amount);
        if (total.compareTo(payment.getAmount()) > 0) {
            throw ApiException.badRequest("Il rimborso supera l'importo incassato");
        }

        // Verso il fornitore si va solo se l'incasso era reale. Col doppio non
        // c'e' niente da restituire fuori di qui, e chiamarlo fingerebbe un
        // movimento di denaro mai avvenuto.
        if (gateway.isReal() && payment.getProviderTxId() != null) {
            gateway.refund(payment.getProviderTxId(), amount);
        }

        boolean fullyRefunded = total.compareTo(payment.getAmount()) == 0;
        payment.setRefundedAmount(total);
        payment.setStatus(fullyRefunded
                ? Payment.PaymentStatus.refunded
                : Payment.PaymentStatus.partially_refunded);
        payments.save(payment);

        if (fullyRefunded) {
            closeAsRefunded(order);
        }
    }

    /**
     * Restituito tutto, l'ordine deve dirlo. Prima il pagamento passava a
     * `refunded` e l'ordine restava `delivered`: chi guardava l'elenco vedeva
     * merce consegnata e pagata mentre il denaro era gia' tornato indietro.
     *
     * Un ordine **annullato** resta annullato: `cancelled` e' terminale, e
     * `releaseAndCancel` arriva qui dopo averlo gia' scritto. La transizione
     * usa la stessa guardia atomica di tutte le altre, cosi' due rimborsi
     * concorrenti non se la contendono.
     */
    private void closeAsRefunded(Order order) {
        var refundable = OrderStatusMachine.refundableFrom();
        if (!refundable.contains(order.getStatus())) return;

        if (orders.updateStatusIfCurrentIn(order.getId(), OrderStatus.refunded, refundable) > 0) {
            order.setStatus(OrderStatus.refunded);
            var entry = new OrderStatusHistory();
            entry.setOrder(order);
            entry.setStatus(OrderStatus.refunded);
            entry.setNote("Rimborsato per intero");
            order.getStatusHistory().add(entry);
        }
    }

    /** Quanto resta da restituire di un incasso. */
    private BigDecimal outstanding(Payment payment) {
        var alreadyRefunded = payment.getRefundedAmount() == null
                ? BigDecimal.ZERO : payment.getRefundedAmount();
        return payment.getAmount().subtract(alreadyRefunded);
    }
}
