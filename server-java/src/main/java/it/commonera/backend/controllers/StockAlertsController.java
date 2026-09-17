package it.commonera.backend.controllers;

import it.commonera.backend.entities.StockAlert;
import it.commonera.backend.exceptions.ApiException;
import it.commonera.backend.repositories.ProductVariantRepository;
import it.commonera.backend.repositories.StockAlertRepository;
import it.commonera.backend.security.CurrentUser;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/** "Avvisami quando torna disponibile". */
@RestController
@RequestMapping("/stock-alerts")
public class StockAlertsController {

    private final StockAlertRepository alerts;
    private final ProductVariantRepository variants;

    public StockAlertsController(StockAlertRepository alerts, ProductVariantRepository variants) {
        this.alerts = alerts;
        this.variants = variants;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public List<Map<String, Object>> mine(@AuthenticationPrincipal CurrentUser user) {
        return alerts.findByUserIdAndNotifiedAtIsNull(user.id()).stream()
                .map(alert -> variants.findById(alert.getVariantId())
                        .map(variant -> Map.<String, Object>of(
                                "variantId", variant.getId(),
                                "productName", variant.getProduct().getName(),
                                "slug", variant.getProduct().getSlug(),
                                "label", String.valueOf(variant.label()),
                                "stockQty", variant.getStockQty()))
                        .orElse(Map.of()))
                .filter(map -> !map.isEmpty())
                .toList();
    }

    @PostMapping
    @Transactional
    public Map<String, Object> subscribe(@AuthenticationPrincipal CurrentUser user, @RequestBody Request body) {
        var variant = variants.findById(body.variantId())
                .orElseThrow(() -> ApiException.notFound("Variant not available"));
        // Iscriversi a qualcosa che c'e' gia' lascerebbe una riga che non partira' mai.
        if (variant.getStockQty() > 0) throw ApiException.badRequest("This item is already in stock");

        // Chi clicca due volte non deve ricevere due email ne' vedere un errore.
        var existing = alerts.findByUserIdAndVariantId(user.id(), body.variantId());
        var alert = existing.orElseGet(StockAlert::new);
        alert.setUserId(user.id());
        alert.setVariantId(body.variantId());
        alert.setNotifiedAt(null);
        alerts.save(alert);

        return Map.of("subscribed", true);
    }

    @DeleteMapping
    @Transactional
    public Map<String, Object> unsubscribe(@AuthenticationPrincipal CurrentUser user, @RequestBody Request body) {
        alerts.findByUserIdAndVariantId(user.id(), body.variantId()).ifPresent(alerts::delete);
        return Map.of("subscribed", false);
    }

    public record Request(UUID variantId) {}
}
