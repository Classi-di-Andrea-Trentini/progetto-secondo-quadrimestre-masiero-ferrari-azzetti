package it.commonera.backend.controllers;

import it.commonera.backend.security.CurrentUser;
import it.commonera.backend.services.CartService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/cart")
public class CartController {

    private final CartService cart;

    public CartController(CartService cart) {
        this.cart = cart;
    }

    @GetMapping
    public Map<String, Object> view(@AuthenticationPrincipal CurrentUser user) {
        return cart.view(user.id());
    }

    @PostMapping("/items")
    public Map<String, Object> add(@AuthenticationPrincipal CurrentUser user, @Valid @RequestBody AddItem body) {
        return cart.addItem(user.id(), body.variantId(), body.quantity());
    }

    @PatchMapping("/items/{variantId}")
    public Map<String, Object> update(@AuthenticationPrincipal CurrentUser user,
                                      @PathVariable UUID variantId,
                                      @Valid @RequestBody UpdateItem body) {
        return cart.updateItem(user.id(), variantId, body.quantity());
    }

    @DeleteMapping("/items/{variantId}")
    public Map<String, Object> remove(@AuthenticationPrincipal CurrentUser user, @PathVariable UUID variantId) {
        return cart.removeItem(user.id(), variantId);
    }

    @DeleteMapping
    public Map<String, Object> clear(@AuthenticationPrincipal CurrentUser user) {
        return cart.clear(user.id());
    }

    /** Chiamata subito dopo il login, col carrello che l'utente aveva da sloggato. */
    @PostMapping("/merge")
    public Map<String, Object> merge(@AuthenticationPrincipal CurrentUser user, @Valid @RequestBody MergeRequest body) {
        return cart.merge(user.id(), body.items());
    }

    public record AddItem(@NotNull UUID variantId, @Min(1) @Max(CartService.MAX_QUANTITY) int quantity) {}

    public record UpdateItem(@Min(0) @Max(CartService.MAX_QUANTITY) int quantity) {}

    public record MergeRequest(List<CartService.Line> items) {}
}
