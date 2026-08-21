package it.commonera.backend.controllers;

import it.commonera.backend.dtos.AdminDtos;
import it.commonera.backend.entities.GiftCard;
import it.commonera.backend.security.CurrentUser;
import it.commonera.backend.services.AdminService;
import it.commonera.backend.services.GiftCardService;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
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

    @GetMapping("/gift-cards")
    public List<GiftCard> giftCards() {
        return giftCards.list();
    }

    @PostMapping("/gift-cards")
    public GiftCard issueGiftCard(@AuthenticationPrincipal CurrentUser user, @RequestBody IssueGiftCard body) {
        return giftCards.issue(user.id(), body.amount(), body.note(), null);
    }

    // ─── Utenti ─────────────────────────────────────────────────────────────

    @GetMapping("/users")
    public Map<String, Object> getUsers(@RequestParam(required = false) String role,
                                        @RequestParam(required = false) String search,
                                        @RequestParam(defaultValue = "1") int page,
                                        @RequestParam(defaultValue = "20") int limit) {
        return admin.getUsers(role, search, page, limit);
    }

    @GetMapping("/users/export")
    public void exportUsers(HttpServletResponse response) throws IOException {
        writeCsv(response, "users.csv", admin.exportUsers());
    }

    @PatchMapping("/users/{id}/role")
    public Map<String, Object> updateUserRole(@AuthenticationPrincipal CurrentUser user,
                                              @PathVariable UUID id, @RequestBody AdminDtos.UpdateUserRoleRequest body) {
        return admin.updateUserRole(id, body.role(), user.id());
    }

    @DeleteMapping("/users/{id}")
    public Map<String, String> deleteUser(@AuthenticationPrincipal CurrentUser user, @PathVariable UUID id) {
        return admin.deleteUser(id, user.id());
    }

    // ─── Prodotti ───────────────────────────────────────────────────────────

    @GetMapping("/products")
    public Map<String, Object> getProducts(@RequestParam(required = false) Boolean isActive,
                                           @RequestParam(required = false) String search,
                                           @RequestParam(defaultValue = "1") int page,
                                           @RequestParam(defaultValue = "20") int limit) {
        return admin.getProducts(isActive, search, page, limit);
    }

    @GetMapping("/products/export")
    public void exportProducts(HttpServletResponse response) throws IOException {
        writeCsv(response, "products.csv", admin.exportProducts());
    }

    @GetMapping("/products/{id}")
    public Map<String, Object> getProductDetail(@PathVariable UUID id) {
        return admin.getProductDetail(id);
    }

    @PostMapping("/products")
    public Map<String, Object> createProduct(@RequestBody AdminDtos.CreateProductRequest body) {
        return admin.createProduct(body);
    }

    @PatchMapping("/products/{id}")
    public Map<String, Object> updateProduct(@PathVariable UUID id, @RequestBody AdminDtos.UpdateProductRequest body) {
        return admin.updateProduct(id, body);
    }

    @DeleteMapping("/products/{id}")
    public Map<String, String> deleteProduct(@PathVariable UUID id) {
        return admin.deleteProduct(id);
    }

    // ─── Varianti ───────────────────────────────────────────────────────────

    @PostMapping("/products/{id}/variants")
    public Map<String, Object> createVariant(@PathVariable UUID id, @RequestBody AdminDtos.CreateVariantRequest body) {
        return admin.createVariant(id, body);
    }

    @PatchMapping("/products/{id}/variants/{variantId}")
    public Map<String, Object> updateVariant(@PathVariable UUID id, @PathVariable UUID variantId,
                                             @RequestBody AdminDtos.UpdateVariantRequest body) {
        return admin.updateVariant(id, variantId, body);
    }

    @DeleteMapping("/products/{id}/variants/{variantId}")
    public Map<String, String> deleteVariant(@PathVariable UUID id, @PathVariable UUID variantId) {
        return admin.deleteVariant(id, variantId);
    }

    // ─── Immagini ───────────────────────────────────────────────────────────
    // Solo per URL: niente upload multipart (niente storage su disco/servizio
    // esterno configurato in questo backend). Un amministratore incolla l'URL
    // dell'immagine gia' ospitata altrove.

    @PostMapping("/products/{id}/images")
    public Map<String, Object> addImage(@PathVariable UUID id, @RequestBody AdminDtos.CreateImageRequest body) {
        return admin.addImage(id, body.url(), body.altText(), body.sortOrder(), body.isCover());
    }

    @DeleteMapping("/products/{id}/images/{imageId}")
    public Map<String, String> deleteImage(@PathVariable UUID id, @PathVariable UUID imageId) {
        return admin.deleteImage(id, imageId);
    }

    @PatchMapping("/products/{id}/images/{imageId}/cover")
    public Map<String, String> setCoverImage(@PathVariable UUID id, @PathVariable UUID imageId) {
        return admin.setCoverImage(id, imageId);
    }

    // ─── Ordini ─────────────────────────────────────────────────────────────

    @GetMapping("/orders")
    public Map<String, Object> getOrders(@RequestParam(required = false) String status,
                                         @RequestParam(required = false) String search,
                                         @RequestParam(defaultValue = "1") int page,
                                         @RequestParam(defaultValue = "20") int limit) {
        return admin.getOrders(status, search, page, limit);
    }

    @GetMapping("/orders/export")
    public void exportOrders(@RequestParam(required = false) String status,
                             @RequestParam(required = false) String dateFrom,
                             @RequestParam(required = false) String dateTo,
                             HttpServletResponse response) throws IOException {
        writeCsv(response, "orders.csv", admin.exportOrders(status, dateFrom, dateTo));
    }

    @GetMapping("/orders/{id}")
    public Map<String, Object> getOrderDetail(@PathVariable UUID id) {
        return admin.getOrderDetail(id);
    }

    // ─── Recensioni ─────────────────────────────────────────────────────────

    @GetMapping("/reviews")
    public Map<String, Object> getReviews(@RequestParam(required = false) String status,
                                          @RequestParam(required = false) String search,
                                          @RequestParam(defaultValue = "1") int page,
                                          @RequestParam(defaultValue = "20") int limit) {
        return admin.getReviews(status, search, page, limit);
    }

    @PatchMapping("/reviews/{id}/status")
    public Map<String, Object> reviewStatus(@PathVariable UUID id, @RequestBody ReviewStatusUpdate body) {
        return admin.moderateReview(id, body.status());
    }

    @DeleteMapping("/reviews/{id}")
    public Map<String, String> deleteReview(@PathVariable UUID id) {
        return admin.deleteReview(id);
    }

    private void writeCsv(HttpServletResponse response, String filename, String csv) throws IOException {
        response.setContentType(MediaType.valueOf("text/csv;charset=UTF-8").toString());
        response.setHeader("Content-Disposition", "attachment; filename=\"" + filename + "\"");
        response.getWriter().write(csv);
    }

    public record StockAdjustment(Integer delta, Integer set, String reason) {}

    public record OrderStatusUpdate(String status, String trackingNumber) {}

    public record ReviewStatusUpdate(String status) {}

    public record IssueGiftCard(BigDecimal amount, String note) {}
}
