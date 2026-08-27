package it.commonera.backend.controllers;

import it.commonera.backend.dtos.AdminDtos;
import it.commonera.backend.dtos.PromoCodeDtos;
import it.commonera.backend.dtos.ReturnDtos;
import it.commonera.backend.entities.GiftCard;
import it.commonera.backend.entities.OrderReturn;
import it.commonera.backend.entities.PromoCode;
import it.commonera.backend.exceptions.ApiException;
import it.commonera.backend.security.CurrentUser;
import it.commonera.backend.services.AdminService;
import it.commonera.backend.services.GiftCardService;
import it.commonera.backend.services.PromoCodeService;
import it.commonera.backend.services.ReturnService;
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
    private final PromoCodeService promoCodes;
    private final ReturnService returns;

    public AdminController(AdminService admin, GiftCardService giftCards,
                           PromoCodeService promoCodes, ReturnService returns) {
        this.admin = admin;
        this.giftCards = giftCards;
        this.promoCodes = promoCodes;
        this.returns = returns;
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

    // ─── Categorie ──────────────────────────────────────────────────────────

    /**
     * Le categorie esistenti: senza questa lista la scheda prodotto non poteva
     * chiedere una categoria, e `createProduct` rifiutava ogni prodotto nuovo con
     * "categoryId is required" — cioe' l'admin non poteva mettere a catalogo niente.
     */
    @GetMapping("/categories")
    public List<Map<String, Object>> getCategories() {
        return admin.getCategories();
    }

    @PostMapping("/categories")
    public Map<String, Object> createCategory(@RequestBody AdminDtos.CreateCategoryRequest body) {
        return admin.createCategory(body);
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

    @PostMapping("/products/{id}/images")
    public Map<String, Object> addImage(@PathVariable UUID id, @RequestBody AdminDtos.CreateImageRequest body) {
        return admin.addImage(id, body.url(), body.altText(), body.sortOrder(), body.isCover());
    }

    @PostMapping(value = "/products/{id}/images/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, Object> uploadImage(@PathVariable UUID id,
                                           @RequestParam("file") org.springframework.web.multipart.MultipartFile file) {
        return admin.uploadImage(id, file);
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

    // ─── Codici promo ───────────────────────────────────────────────────────
    // Endpoint dimenticati nella prima passata: il servizio esisteva già
    // (validate/CRUD), ma non era mai stato agganciato a un controller admin —
    // la pagina "Promo" del frontend chiamava un URL che non rispondeva.

    @GetMapping("/promo-codes")
    public Map<String, Object> getPromoCodes(@RequestParam(required = false) Boolean isActive,
                                             @RequestParam(required = false) String discountType,
                                             @RequestParam(required = false) String search,
                                             @RequestParam(defaultValue = "1") int page,
                                             @RequestParam(defaultValue = "20") int limit) {
        return promoCodes.adminList(isActive, parseDiscountType(discountType), search, page, limit);
    }

    @PostMapping("/promo-codes")
    public PromoCodeDtos.View createPromoCode(@RequestBody PromoCodeDtos.CreateRequest body) {
        return promoCodes.create(body);
    }

    @PatchMapping("/promo-codes/{id}")
    public PromoCodeDtos.View updatePromoCode(@PathVariable UUID id, @RequestBody PromoCodeDtos.UpdateRequest body) {
        return promoCodes.update(id, body);
    }

    @DeleteMapping("/promo-codes/{id}")
    public Map<String, String> deletePromoCode(@PathVariable UUID id) {
        return promoCodes.delete(id);
    }

    private PromoCode.DiscountType parseDiscountType(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return PromoCode.DiscountType.valueOf(value);
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest("Invalid discount type: " + value);
        }
    }

    // ─── Resi (admin) ───────────────────────────────────────────────────────
    // Stesso buco dei codici promo: il servizio c'era, il controller no.

    @GetMapping("/returns")
    public Map<String, Object> getReturns(@RequestParam(required = false) String status,
                                          @RequestParam(required = false) String search,
                                          @RequestParam(defaultValue = "1") int page,
                                          @RequestParam(defaultValue = "20") int limit) {
        return returns.adminList(parseReturnStatus(status), search, page, limit);
    }

    @PatchMapping("/returns/{id}/status")
    public ReturnDtos.View updateReturnStatus(@PathVariable UUID id, @RequestBody ReturnDtos.UpdateStatusRequest body) {
        return returns.updateStatus(id, body);
    }

    private OrderReturn.ReturnStatus parseReturnStatus(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return OrderReturn.ReturnStatus.valueOf(value);
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest("Invalid return status: " + value);
        }
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
