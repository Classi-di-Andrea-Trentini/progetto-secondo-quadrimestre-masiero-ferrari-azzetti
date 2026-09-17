package it.commonera.backend.services;

import it.commonera.backend.entities.Cart;
import it.commonera.backend.entities.CartItem;
import it.commonera.backend.entities.ProductVariant;
import it.commonera.backend.exceptions.ApiException;
import it.commonera.backend.repositories.CartRepository;
import it.commonera.backend.repositories.ProductVariantRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Carrello lato server.
 *
 * I prezzi si rileggono dal database a ogni lettura del carrello, non si salvano
 * nella riga: uno sconto scaduto o un rincaro devono vedersi subito, invece di
 * saltare fuori al momento di pagare.
 */
@Service
public class CartService {

    /** Tetto per riga: oltre non e' un acquisto, e' un errore di battitura o un abuso. */
    public static final int MAX_QUANTITY = 99;

    private final CartRepository carts;
    private final ProductVariantRepository variants;
    private final PricingService pricing;

    public CartService(CartRepository carts, ProductVariantRepository variants, PricingService pricing) {
        this.carts = carts;
        this.variants = variants;
        this.pricing = pricing;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> view(UUID userId) {
        var cart = carts.findByUserId(userId).orElse(null);
        if (cart == null) return empty();

        List<Map<String, Object>> items = new ArrayList<>();
        BigDecimal subtotal = BigDecimal.ZERO;
        BigDecimal savings = BigDecimal.ZERO;
        int count = 0;
        boolean issues = false;

        for (CartItem item : cart.getItems()) {
            var variant = item.getVariant();
            var price = pricing.of(variant);
            var lineTotal = price.lineTotal(item.getQuantity());

            boolean inStock = Boolean.TRUE.equals(variant.getIsActive())
                    && variant.getStockQty() >= item.getQuantity();
            if (!inStock) issues = true;

            subtotal = subtotal.add(lineTotal);
            savings = savings.add(price.original().subtract(price.unit())
                    .multiply(BigDecimal.valueOf(item.getQuantity())));
            count += item.getQuantity();

            var product = variant.getProduct();
            var row = new java.util.LinkedHashMap<String, Object>();
            row.put("variantId", variant.getId());
            row.put("productId", product.getId());
            row.put("productName", product.getName());
            row.put("slug", product.getSlug());
            row.put("variantLabel", variant.label());
            row.put("size", variant.getSize());
            row.put("color", variant.getColor());
            row.put("colorHex", variant.getColorHex());
            row.put("imageUrl", product.getImages().isEmpty() ? null : product.getImages().get(0).getUrl());
            row.put("unitPrice", price.unit());
            row.put("originalPrice", price.original());
            row.put("discountLabel", price.discountLabel());
            row.put("quantity", item.getQuantity());
            row.put("stockQty", variant.getStockQty());
            row.put("inStock", inStock);
            row.put("lineTotal", lineTotal);
            items.add(row);
        }

        return Map.of(
                "items", items,
                "itemCount", count,
                "subtotal", subtotal,
                "savings", savings,
                "hasIssues", issues,
                "updatedAt", cart.getUpdatedAt());
    }

    @Transactional
    public Map<String, Object> addItem(UUID userId, UUID variantId, int quantity) {
        var variant = loadVariant(variantId);
        var cart = ensureCart(userId);

        var existing = cart.getItems().stream()
                .filter(i -> i.getVariant().getId().equals(variantId))
                .findFirst();

        // Aggiungere due volte lo stesso articolo somma le quantita' invece di creare
        // una seconda riga: il vincolo unico su (cart, variant) non lo permetterebbe.
        int wanted = Math.min(existing.map(CartItem::getQuantity).orElse(0) + quantity, MAX_QUANTITY);
        assertStock(variant, wanted);

        if (existing.isPresent()) {
            existing.get().setQuantity(wanted);
        } else {
            var item = new CartItem();
            item.setCart(cart);
            item.setVariant(variant);
            item.setQuantity(wanted);
            cart.getItems().add(item);
        }

        touch(cart);
        return view(userId);
    }

    @Transactional
    public Map<String, Object> updateItem(UUID userId, UUID variantId, int quantity) {
        if (quantity <= 0) return removeItem(userId, variantId);

        var cart = carts.findByUserId(userId).orElseThrow(() -> ApiException.notFound("Cart not found"));
        var item = cart.getItems().stream()
                .filter(i -> i.getVariant().getId().equals(variantId))
                .findFirst()
                .orElseThrow(() -> ApiException.notFound("Item not in cart"));

        assertStock(item.getVariant(), quantity);
        item.setQuantity(Math.min(quantity, MAX_QUANTITY));
        touch(cart);
        return view(userId);
    }

    @Transactional
    public Map<String, Object> removeItem(UUID userId, UUID variantId) {
        var cart = carts.findByUserId(userId).orElseThrow(() -> ApiException.notFound("Cart not found"));
        cart.getItems().removeIf(i -> i.getVariant().getId().equals(variantId));
        touch(cart);
        return view(userId);
    }

    @Transactional
    public Map<String, Object> clear(UUID userId) {
        carts.findByUserId(userId).ifPresent(cart -> {
            cart.getItems().clear();
            touch(cart);
        });
        return view(userId);
    }

    /**
     * Fonde il carrello riempito da sloggati con quello sul server.
     *
     * Le righe non valide vengono **saltate**, non fanno fallire tutta la fusione:
     * al login non si puo' chiedere all'utente di sistemare un carrello che non vede.
     */
    @Transactional
    public Map<String, Object> merge(UUID userId, List<Line> lines) {
        var cart = ensureCart(userId);

        for (Line line : lines) {
            try {
                var variant = loadVariant(line.variantId());
                var existing = cart.getItems().stream()
                        .filter(i -> i.getVariant().getId().equals(line.variantId()))
                        .findFirst();

                int wanted = Math.min(existing.map(CartItem::getQuantity).orElse(0) + line.quantity(), MAX_QUANTITY);
                // Se la giacenza non copre la somma si prende quello che c'e', invece
                // di scartare la riga: meglio un pezzo nel carrello che niente.
                int usable = Math.min(wanted, variant.getStockQty());
                if (usable <= 0) continue;

                if (existing.isPresent()) {
                    existing.get().setQuantity(usable);
                } else {
                    var item = new CartItem();
                    item.setCart(cart);
                    item.setVariant(variant);
                    item.setQuantity(usable);
                    cart.getItems().add(item);
                }
            } catch (RuntimeException ignored) {
                // Variante sparita dal catalogo: si salta e si va avanti.
            }
        }

        touch(cart);
        return view(userId);
    }

    private Cart ensureCart(UUID userId) {
        return carts.findByUserId(userId).orElseGet(() -> {
            var cart = new Cart();
            cart.setUserId(userId);
            return carts.save(cart);
        });
    }

    private ProductVariant loadVariant(UUID id) {
        var variant = variants.findById(id)
                .orElseThrow(() -> ApiException.notFound("Variant not available"));
        if (!Boolean.TRUE.equals(variant.getIsActive()) || variant.getProduct().getDeletedAt() != null) {
            throw ApiException.notFound("Variant not available");
        }
        return variant;
    }

    private void assertStock(ProductVariant variant, int quantity) {
        if (variant.getStockQty() < quantity) {
            throw ApiException.badRequest(
                    "Only " + variant.getStockQty() + " left of " + variant.getProduct().getName());
        }
    }

    private void touch(Cart cart) {
        cart.setUpdatedAt(LocalDateTime.now());
        carts.save(cart);
    }

    private Map<String, Object> empty() {
        var map = new java.util.LinkedHashMap<String, Object>();
        map.put("items", List.of());
        map.put("itemCount", 0);
        map.put("subtotal", BigDecimal.ZERO);
        map.put("savings", BigDecimal.ZERO);
        map.put("hasIssues", false);
        map.put("updatedAt", null);
        return map;
    }

    public record Line(UUID variantId, int quantity) {}
}
