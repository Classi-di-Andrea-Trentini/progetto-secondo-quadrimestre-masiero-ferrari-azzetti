package it.commonera.backend.controllers;

import it.commonera.backend.security.CurrentUser;
import it.commonera.backend.services.ReviewService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/reviews")
public class ReviewsController {

    private final ReviewService reviews;

    public ReviewsController(ReviewService reviews) {
        this.reviews = reviews;
    }

    /** Pubblico: sono le recensioni che fanno decidere chi non ha ancora comprato. */
    @GetMapping("/product/{productId}")
    public Map<String, Object> byProduct(@PathVariable UUID productId,
                                         @RequestParam(defaultValue = "1") int page,
                                         @RequestParam(defaultValue = "10") int limit) {
        return reviews.findByProduct(productId, page, limit);
    }

    @PostMapping
    public Map<String, Object> create(@AuthenticationPrincipal CurrentUser user,
                                      @RequestBody CreateRequest body) {
        return reviews.create(user.id(), body.productId(), body.rating(), body.title(), body.body());
    }

    /** "Utile": lo puo' cliccare solo chi e' collegato, una volta sola. */
    @PostMapping("/{id}/helpful")
    public Map<String, Object> voteHelpful(@AuthenticationPrincipal CurrentUser user, @PathVariable UUID id) {
        return reviews.voteHelpful(user.id(), id);
    }

    @DeleteMapping("/{id}")
    public Map<String, String> delete(@AuthenticationPrincipal CurrentUser user, @PathVariable UUID id) {
        reviews.delete(user.id(), id);
        return Map.of("message", "Review deleted");
    }

    public record CreateRequest(UUID productId, short rating, String title, String body) {}
}
