package it.commonera.backend.services;

import it.commonera.backend.entities.Order;
import it.commonera.backend.entities.OrderStatus;
import it.commonera.backend.entities.OrderStatusMachine;
import it.commonera.backend.exceptions.ApiException;
import it.commonera.backend.repositories.OrderRepository;
import it.commonera.backend.repositories.PaymentRepository;
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
    static final Set<OrderStatus> CANCELLABLE = OrderStatusMachine.cancellableFrom();

    private final OrderRepository orders;
    private final PaymentRepository payments;
    private final OrderCompensationService compensation;
    private final CoverImageService covers;

    public OrderService(OrderRepository orders, PaymentRepository payments,
                        OrderCompensationService compensation, CoverImageService covers) {
        this.orders = orders;
        this.payments = payments;
        this.compensation = compensation;
        this.covers = covers;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> findAll(UUID userId, int page, int limit) {
        int capped = Math.min(Math.max(limit, 1), 50);
        var result = orders.findByUserIdOrderByCreatedAtDesc(userId, PageRequest.of(Math.max(0, page - 1), capped));

        // Una sola interrogazione per l'intera pagina: prima ne partiva una per
        // ordine dentro `view`, che con 50 ordini in pagina significava 50 query
        // identiche nella forma e diverse solo per gli id cercati.
        var content = result.getContent();
        var coverByVariant = covers.coverByVariant(content.stream().flatMap(o -> o.getItems().stream()).toList());

        return Map.of(
                "data", content.stream().map(o -> view(o, coverByVariant)).toList(),
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

        // Tutta la compensazione — stato, giacenza, buono, punti — sta in
        // OrderCompensationService, perche' la fanno identica anche il webhook del
        // pagamento fallito e il raccoglitore degli ordini abbandonati. Il falso
        // significa che un'altra richiesta ha gia' chiuso questo ordine.
        if (!compensation.releaseAndCancel(order, CANCELLABLE, userId, "Cancelled by customer")) {
            throw ApiException.badRequest("Order can no longer be cancelled");
        }

        return view(order);
    }

    private Order load(UUID userId, UUID orderId) {
        return orders.findByIdAndUserId(orderId, userId)
                .orElseThrow(() -> ApiException.notFound("Order not found"));
    }

    /** Conversione dentro la transazione: `open-in-view` e' spento. */
    Map<String, Object> view(Order order) {
        return view(order, covers.coverByVariant(order.getItems()));
    }

    /**
     * Come sopra, ma con la copertina gia' risolta da chi chiama: usato da
     * {@link #findAll} per risolvere l'intera pagina in una query sola invece di
     * una per ordine.
     */
    private Map<String, Object> view(Order order, Map<UUID, String> coverByVariant) {
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
        map.put("items", order.getItems().stream().map(item -> {
            // `LinkedHashMap` e non `Map.of`: l'immagine puo' mancare, e `Map.of`
            // con un null esplode.
            var row = new LinkedHashMap<String, Object>();
            // Serve al cliente per richiedere un reso su questa riga precisa
            // (vedi ReturnsController): senza l'id, "restituisci questo articolo"
            // non ha un bersaglio univoco quando l'ordine ha piu' righe uguali.
            row.put("id", item.getId());
            row.put("productName", item.getProductName());
            row.put("variantLabel", String.valueOf(item.getVariantLabel()));
            row.put("quantity", item.getQuantity());
            row.put("unitPrice", item.getUnitPrice());
            row.put("lineTotal", item.getLineTotal());
            row.put("imageUrl", coverByVariant.get(item.getVariantId()));
            return row;
        }).toList());
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
