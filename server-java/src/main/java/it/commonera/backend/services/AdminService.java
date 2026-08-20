package it.commonera.backend.services;

import it.commonera.backend.entities.*;
import it.commonera.backend.exceptions.ApiException;
import it.commonera.backend.repositories.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

/**
 * Area amministrativa: numeri di vendita, magazzino e moderazione.
 *
 * Il magazzino usa `low_stock_alert`, la soglia che nel backend Node era rimasta
 * inutilizzata per tutto il progetto — c'era su ogni variante e non avvisava nessuno.
 */
@Service
public class AdminService {

    private final OrderRepository orders;
    private final UserRepository users;
    private final ProductRepository products;
    private final ProductVariantRepository variants;
    private final ReviewRepository reviews;
    private final StockAlertRepository stockAlerts;
    private final MailService mail;

    public AdminService(OrderRepository orders, UserRepository users, ProductRepository products,
                        ProductVariantRepository variants, ReviewRepository reviews,
                        StockAlertRepository stockAlerts, MailService mail) {
        this.orders = orders;
        this.users = users;
        this.products = products;
        this.variants = variants;
        this.reviews = reviews;
        this.stockAlerts = stockAlerts;
        this.mail = mail;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> dashboard() {
        var all = orders.findAll();
        var paid = all.stream()
                .filter(o -> EnumSet.of(OrderStatus.paid, OrderStatus.processing, OrderStatus.shipped,
                        OrderStatus.delivered, OrderStatus.completed).contains(o.getStatus()))
                .toList();

        BigDecimal revenue = paid.stream()
                .map(Order::getTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        var byStatus = new LinkedHashMap<String, Long>();
        for (var order : all) {
            byStatus.merge(order.getStatus().name(), 1L, Long::sum);
        }

        var low = lowStock(null);

        return Map.of(
                "totalUsers", users.count(),
                "totalOrders", all.size(),
                "totalProducts", products.count(),
                "totalRevenue", revenue,
                // Scontrino medio sui **soli ordini incassati**: annullati e pendenti
                // abbasserebbero un numero che serve a leggere le vendite vere.
                "averageOrderValue", paid.isEmpty()
                        ? BigDecimal.ZERO
                        : revenue.divide(BigDecimal.valueOf(paid.size()), 2, RoundingMode.HALF_UP),
                "ordersByStatus", byStatus,
                "inventory", Map.of(
                        "outOfStock", low.get("outOfStock"),
                        "lowStock", low.get("lowStock")));
    }

    /** Varianti esaurite o sotto soglia, le esaurite per prime. */
    @Transactional(readOnly = true)
    public Map<String, Object> lowStock(Integer threshold) {
        List<Map<String, Object>> rows = new ArrayList<>();
        long out = 0;
        long low = 0;

        for (var variant : variants.findAll()) {
            if (!Boolean.TRUE.equals(variant.getIsActive())) continue;
            var product = variant.getProduct();
            if (!Boolean.TRUE.equals(product.getIsActive()) || product.getDeletedAt() != null) continue;

            // La soglia del prodotto ha la precedenza; `threshold` serve a guardare
            // piu' in la' di quanto impostato, non a sovrascriverlo.
            int limit = threshold != null ? threshold
                    : (variant.getLowStockAlert() == null ? 0 : variant.getLowStockAlert());

            String level = variant.getStockQty() <= 0 ? "out"
                    : variant.getStockQty() <= limit ? "low" : "ok";
            if ("ok".equals(level)) continue;

            if ("out".equals(level)) out++; else low++;

            rows.add(Map.of(
                    "variantId", variant.getId(),
                    "sku", variant.getSku(),
                    "productName", product.getName(),
                    "label", String.valueOf(variant.label()),
                    "stockQty", variant.getStockQty(),
                    "level", level));
        }

        rows.sort(Comparator.comparingInt(r -> (Integer) r.get("stockQty")));
        return Map.of("rows", rows, "outOfStock", out, "lowStock", low);
    }

    /**
     * Rettifica di giacenza.
     *
     * `delta` somma, `set` fissa il valore contato: sono due gesti diversi — "ne sono
     * arrivati 20" e "contati, sono 3" — e confonderli sballa l'inventario.
     */
    @Transactional
    public Map<String, Object> adjustStock(UUID variantId, Integer delta, Integer set) {
        if (delta == null && set == null) throw ApiException.badRequest("Provide either delta or set");
        if (delta != null && set != null) throw ApiException.badRequest("Provide only one of delta or set");

        var variant = variants.findById(variantId)
                .orElseThrow(() -> ApiException.notFound("Variant not found"));

        int previous = variant.getStockQty();
        int next = set != null ? set : previous + delta;
        if (next < 0) throw ApiException.badRequest("Stock cannot go below zero (current " + previous + ")");

        variant.setStockQty(next);
        variants.save(variant);

        // Se era esaurita e ora c'e', partono gli avvisi. **Dopo** la scrittura,
        // altrimenti si invita a comprare qualcosa che non c'e' ancora.
        int notified = 0;
        if (previous <= 0 && next > 0) notified = notifyBackInStock(variant);

        return Map.of("variantId", variantId, "stockQty", next, "previous", previous, "notified", notified);
    }

    private int notifyBackInStock(ProductVariant variant) {
        var pending = stockAlerts.findByVariantIdAndNotifiedAtIsNull(variant.getId());
        for (var alert : pending) {
            users.findById(alert.getUserId()).ifPresent(user ->
                    mail.sendBackInStock(user.getEmail(), user.getFullName(),
                            variant.getProduct().getName(), String.valueOf(variant.label()),
                            variant.getProduct().getSlug()));
            // Segnato comunque: riprovare all'infinito su un indirizzo morto significa
            // rimandare l'email a ogni carico di magazzino, per sempre.
            alert.setNotifiedAt(java.time.LocalDateTime.now());
            stockAlerts.save(alert);
        }
        return pending.size();
    }

    @Transactional
    public Map<String, Object> moderateReview(UUID reviewId, String status) {
        var review = reviews.findById(reviewId)
                .orElseThrow(() -> ApiException.notFound("Review not found"));
        review.setStatus(parseReviewStatus(status));
        reviews.save(review);
        return Map.of("id", review.getId(), "status", review.getStatus().name());
    }

    @Transactional
    public Map<String, Object> updateOrderStatus(UUID adminId, UUID orderId, String status, String trackingNumber) {
        var order = orders.findById(orderId)
                .orElseThrow(() -> ApiException.notFound("Order not found"));

        var next = parseOrderStatus(status);
        order.setStatus(next);
        if (trackingNumber != null) order.setTrackingNumber(trackingNumber);

        var entry = new OrderStatusHistory();
        entry.setOrder(order);
        entry.setStatus(next);
        entry.setChangedBy(adminId);
        entry.setNote("Aggiornato dall'amministratore");
        order.getStatusHistory().add(entry);

        orders.save(order);
        return Map.of("id", order.getId(), "status", next.name());
    }

    private Review.ReviewStatus parseReviewStatus(String status) {
        try {
            return Review.ReviewStatus.valueOf(status);
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest("Invalid review status: " + status);
        }
    }

    private OrderStatus parseOrderStatus(String status) {
        try {
            return OrderStatus.valueOf(status);
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest("Invalid order status: " + status);
        }
    }
}
