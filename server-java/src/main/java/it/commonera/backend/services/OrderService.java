package it.commonera.backend.services;

import it.commonera.backend.entities.Order;
import it.commonera.backend.entities.OrderStatus;
import it.commonera.backend.entities.OrderStatusHistory;
import it.commonera.backend.exceptions.ApiException;
import it.commonera.backend.repositories.OrderRepository;
import it.commonera.backend.repositories.PaymentRepository;
import it.commonera.backend.repositories.ProductVariantRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class OrderService {

    /**
     * Oltre questi stati la merce e' gia' partita: annullare non ha piu' senso.
     * Non {@code private}: riusata dal test che esercita direttamente
     * {@link OrderRepository#updateStatusIfCurrentIn} per provare che la
     * seconda transizione concorrente su uno stesso ordine tocca zero righe.
     */
    static final Set<OrderStatus> CANCELLABLE =
            Set.of(OrderStatus.pending, OrderStatus.paid, OrderStatus.processing);

    private final OrderRepository orders;
    private final PaymentRepository payments;
    private final ProductVariantRepository variants;
    private final GiftCardService giftCards;
    private final LoyaltyService loyalty;

    public OrderService(OrderRepository orders, PaymentRepository payments, ProductVariantRepository variants,
                        GiftCardService giftCards, LoyaltyService loyalty) {
        this.orders = orders;
        this.payments = payments;
        this.variants = variants;
        this.giftCards = giftCards;
        this.loyalty = loyalty;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> findAll(UUID userId, int page, int limit) {
        int capped = Math.min(Math.max(limit, 1), 50);
        var result = orders.findByUserIdOrderByCreatedAtDesc(userId, PageRequest.of(Math.max(0, page - 1), capped));

        return Map.of(
                "data", result.getContent().stream().map(this::view).toList(),
                "meta", Map.of(
                        "total", result.getTotalElements(),
                        "page", result.getNumber() + 1,
                        "limit", capped,
                        "totalPages", result.getTotalPages()));
    }

    @Transactional(readOnly = true)
    public Map<String, Object> findOne(UUID userId, UUID orderId) {
        return view(load(userId, orderId));
    }

    @Transactional
    public Map<String, Object> cancel(UUID userId, UUID orderId) {
        var order = load(userId, orderId);

        if (!CANCELLABLE.contains(order.getStatus())) {
            throw ApiException.badRequest("Order can no longer be cancelled");
        }

        // Transizione atomica **come primo scalo**, prima di toccare buono e punti:
        // senza `@Version` sull'ordine, due `cancel()` concorrenti leggerebbero
        // entrambi lo stato annullabile controllato qui sopra e rimborserebbero
        // entrambi. Se qui non viene toccata nessuna riga, l'altra richiesta e'
        // arrivata prima — niente rimborso doppio, a prescindere da cos'altro
        // protegga (o non protegga) la parte punti/buono piu' sotto.
        if (orders.updateStatusIfCurrentIn(order.getId(), OrderStatus.cancelled, CANCELLABLE) == 0) {
            throw ApiException.badRequest("Order can no longer be cancelled");
        }
        order.setStatus(OrderStatus.cancelled);

        // La merce torna a magazzino: annullare senza ripristinare la giacenza
        // significa perdere pezzi che nessuno ha mai comprato.
        for (var item : order.getItems()) {
            variants.findById(item.getVariantId()).ifPresent(variant -> {
                variant.setStockQty(variant.getStockQty() + item.getQuantity());
                variants.save(variant);
            });
        }

        // Stesso principio per buono e punti: quello che il checkout ha scalato o
        // accreditato per questo ordine deve tornare indietro, nella stessa
        // transazione dello scalo di magazzino qui sopra — se una delle due cose
        // fallisse, l'annullamento non deve restare a meta'.
        if (order.getGiftCardId() != null && order.getGiftCardAmount() != null
                && order.getGiftCardAmount().signum() > 0) {
            giftCards.refund(order.getGiftCardId(), order.getGiftCardAmount(), order.getId());
        }
        loyalty.reverseForOrder(order.getUserId(), order.getId());

        var entry = new OrderStatusHistory();
        entry.setOrder(order);
        entry.setStatus(OrderStatus.cancelled);
        entry.setChangedBy(userId);
        entry.setNote("Annullato dal cliente");
        order.getStatusHistory().add(entry);

        return view(order);
    }

    private Order load(UUID userId, UUID orderId) {
        return orders.findByIdAndUserId(orderId, userId)
                .orElseThrow(() -> ApiException.notFound("Order not found"));
    }

    /** Conversione dentro la transazione: `open-in-view` e' spento. */
    Map<String, Object> view(Order order) {
        var map = new LinkedHashMap<String, Object>();
        map.put("id", order.getId());
        map.put("status", order.getStatus().name());
        map.put("subtotal", order.getSubtotal());
        map.put("discountTotal", order.getDiscountTotal());
        map.put("shippingCost", order.getShippingCost());
        map.put("total", order.getTotal());
        map.put("giftCardAmount", order.getGiftCardAmount());
        map.put("trackingNumber", order.getTrackingNumber());
        map.put("trackingUrl", order.getTrackingUrl());
        map.put("invoiceNumber", order.getInvoiceNumber());
        map.put("createdAt", order.getCreatedAt());
        map.put("items", order.getItems().stream().map(item -> Map.of(
                // Serve al cliente per richiedere un reso su questa riga precisa
                // (vedi ReturnsController): senza l'id, "restituisci questo articolo"
                // non ha un bersaglio univoco quando l'ordine ha piu' righe uguali.
                "id", item.getId(),
                "productName", item.getProductName(),
                "variantLabel", String.valueOf(item.getVariantLabel()),
                "quantity", item.getQuantity(),
                "unitPrice", item.getUnitPrice(),
                "lineTotal", item.getLineTotal())).toList());
        // La cronologia serve anche in elenco: la pagina account espande l'ordine li'
        // dentro e non chiama il dettaglio.
        map.put("statusHistory", order.getStatusHistory().stream().map(h -> {
            var step = new LinkedHashMap<String, Object>();
            step.put("status", h.getStatus().name());
            step.put("note", h.getNote());
            step.put("createdAt", h.getCreatedAt());
            return step;
        }).toList());
        map.put("payments", payments.findByOrderIdOrderByCreatedAtDesc(order.getId()).stream()
                .map(p -> Map.of("status", p.getStatus().name(), "method", p.getMethod().name()))
                .toList());
        return map;
    }
}
