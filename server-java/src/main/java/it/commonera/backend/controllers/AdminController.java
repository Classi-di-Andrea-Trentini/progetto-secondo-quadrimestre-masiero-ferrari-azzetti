package it.commonera.backend.controllers;

import it.commonera.backend.entities.GiftCard;
import it.commonera.backend.security.CurrentUser;
import it.commonera.backend.services.AdminService;
import it.commonera.backend.services.GiftCardService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Tutto qui sotto e' riservato agli amministratori: il vincolo e' dichiarato una
 * volta sola in `SecurityConfig` (`/admin/**` richiede il ruolo), invece di essere
 * ripetuto su ogni metodo dove prima o poi qualcuno se lo dimentica.
 */
@RestController
@RequestMapping("/admin")
public class AdminController {

    private final AdminService admin;
    private final GiftCardService giftCards;

    public AdminController(AdminService admin, GiftCardService giftCards) {
        this.admin = admin;
        this.giftCards = giftCards;
    }

    @GetMapping("/dashboard/stats")
    public Map<String, Object> dashboard() {
        return admin.dashboard();
    }

    @GetMapping("/inventory")
    public Map<String, Object> inventory(@RequestParam(required = false) Integer threshold) {
        return admin.lowStock(threshold);
    }

    @PatchMapping("/inventory/{variantId}/stock")
    public Map<String, Object> adjustStock(@PathVariable UUID variantId, @RequestBody StockAdjustment body) {
        return admin.adjustStock(variantId, body.delta(), body.set());
    }

    @PatchMapping("/orders/{id}/status")
    public Map<String, Object> orderStatus(@AuthenticationPrincipal CurrentUser user,
                                           @PathVariable UUID id,
                                           @RequestBody OrderStatusUpdate body) {
        return admin.updateOrderStatus(user.id(), id, body.status(), body.trackingNumber());
    }

    @PatchMapping("/reviews/{id}/status")
    public Map<String, Object> reviewStatus(@PathVariable UUID id, @RequestBody ReviewStatusUpdate body) {
        return admin.moderateReview(id, body.status());
    }

    @GetMapping("/gift-cards")
    public List<GiftCard> giftCards() {
        return giftCards.list();
    }

    @PostMapping("/gift-cards")
    public GiftCard issueGiftCard(@AuthenticationPrincipal CurrentUser user, @RequestBody IssueGiftCard body) {
        return giftCards.issue(user.id(), body.amount(), body.note(), null);
    }

    public record StockAdjustment(Integer delta, Integer set, String reason) {}

    public record OrderStatusUpdate(String status, String trackingNumber) {}

    public record ReviewStatusUpdate(String status) {}

    public record IssueGiftCard(BigDecimal amount, String note) {}
}
