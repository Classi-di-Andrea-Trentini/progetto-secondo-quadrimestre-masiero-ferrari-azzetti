package it.commonera.backend.services;

import it.commonera.backend.entities.Order;
import it.commonera.backend.entities.OrderStatus;
import it.commonera.backend.entities.OrderStatusHistory;
import it.commonera.backend.repositories.OrderRepository;
import it.commonera.backend.repositories.ProductVariantRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    public OrderCompensationService(OrderRepository orders, ProductVariantRepository variants,
                                    GiftCardService giftCards, LoyaltyService loyalty) {
        this.orders = orders;
        this.variants = variants;
        this.giftCards = giftCards;
        this.loyalty = loyalty;
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
        if (orders.updateStatusIfCurrentIn(order.getId(), OrderStatus.cancelled, allowedFrom) == 0) {
            return false;
        }
        order.setStatus(OrderStatus.cancelled);

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
}
