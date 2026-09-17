package it.commonera.backend.controllers;

import it.commonera.backend.security.CurrentUser;
import it.commonera.backend.services.WishlistService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/wishlist")
public class WishlistController {

    private final WishlistService wishlist;

    public WishlistController(WishlistService wishlist) {
        this.wishlist = wishlist;
    }

    @GetMapping
    public List<Map<String, Object>> items(@AuthenticationPrincipal CurrentUser user) {
        return wishlist.items(user.id());
    }

    @GetMapping("/ids")
    public List<UUID> ids(@AuthenticationPrincipal CurrentUser user) {
        return wishlist.ids(user.id());
    }

    @PostMapping("/{productId}/toggle")
    public Map<String, Object> toggle(@AuthenticationPrincipal CurrentUser user, @PathVariable UUID productId) {
        return wishlist.toggle(user.id(), productId);
    }
}
