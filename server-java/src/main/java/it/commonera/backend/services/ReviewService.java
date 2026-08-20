package it.commonera.backend.services;

import it.commonera.backend.entities.Review;
import it.commonera.backend.exceptions.ApiException;
import it.commonera.backend.repositories.ReviewRepository;
import it.commonera.backend.repositories.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class ReviewService {

    /** Tetto per recensione: sopra e' spazio disco regalato a chi vuole abusarne. */
    private static final int MAX_PHOTOS = 4;

    private final ReviewRepository reviews;
    private final UserRepository users;

    public ReviewService(ReviewRepository reviews, UserRepository users) {
        this.reviews = reviews;
        this.users = users;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> findByProduct(UUID productId, int page, int limit) {
        int capped = Math.min(Math.max(limit, 1), 50);
        var result = reviews.findByProductIdAndStatus(
                productId, Review.ReviewStatus.approved,
                PageRequest.of(Math.max(0, page - 1), capped, Sort.by("createdAt").descending()));

        return Map.of(
                "data", result.getContent().stream().map(this::view).toList(),
                "meta", Map.of(
                        "total", result.getTotalElements(),
                        "page", result.getNumber() + 1,
                        "limit", capped,
                        "totalPages", result.getTotalPages()));
    }

    @Transactional
    public Map<String, Object> create(UUID userId, UUID productId, short rating, String title, String body) {
        if (rating < 1 || rating > 5) throw ApiException.badRequest("Rating must be between 1 and 5");
        // Una recensione per prodotto e per persona: il vincolo unico c'e' anche sul
        // database, ma dirlo qui da' un messaggio comprensibile invece di un 500.
        if (reviews.existsByUserIdAndProductId(userId, productId)) {
            throw ApiException.badRequest("Hai gia' recensito questo prodotto");
        }

        var review = new Review();
        review.setUserId(userId);
        review.setProductId(productId);
        review.setRating(rating);
        review.setTitle(title);
        review.setBody(body);
        // Nasce `pending`: diventa pubblica solo dopo l'approvazione.
        review.setStatus(Review.ReviewStatus.pending);
        return view(reviews.save(review));
    }

    @Transactional
    public Map<String, Object> addPhoto(UUID userId, UUID reviewId, String url) {
        var review = own(userId, reviewId);
        if (review.getPhotos().size() >= MAX_PHOTOS) {
            throw ApiException.badRequest("At most " + MAX_PHOTOS + " photos per review");
        }
        review.getPhotos().add(requireHttpUrl(url));
        return view(reviews.save(review));
    }

    /**
     * L'URL torna cosi' com'e' in ogni pagina che mostra la recensione: senza
     * limitare lo schema a http/https, un `javascript:` o `data:` salvato qui
     * diventerebbe uno XSS memorizzato la prima volta che qualcuno apre la foto.
     */
    private String requireHttpUrl(String url) {
        if (url == null) throw ApiException.badRequest("Photo URL is required");
        String trimmed = url.trim();
        String lower = trimmed.toLowerCase();
        if (!lower.startsWith("http://") && !lower.startsWith("https://")) {
            throw ApiException.badRequest("Photo URL must start with http:// or https://");
        }
        return trimmed;
    }

    @Transactional
    public Map<String, Object> removePhoto(UUID userId, UUID reviewId, String url) {
        var review = own(userId, reviewId);
        review.getPhotos().remove(url);
        return view(reviews.save(review));
    }

    @Transactional
    public void delete(UUID userId, UUID reviewId) {
        reviews.delete(own(userId, reviewId));
    }

    /** Solo l'autore puo' toccare la propria recensione. */
    private Review own(UUID userId, UUID reviewId) {
        var review = reviews.findById(reviewId)
                .orElseThrow(() -> ApiException.notFound("Review not found"));
        if (!review.getUserId().equals(userId)) throw ApiException.forbidden();
        return review;
    }

    private Map<String, Object> view(Review review) {
        var map = new LinkedHashMap<String, Object>();
        map.put("id", review.getId());
        map.put("rating", review.getRating());
        map.put("title", review.getTitle());
        map.put("body", review.getBody());
        map.put("status", review.getStatus().name());
        map.put("isVerified", review.getIsVerified());
        map.put("helpfulCount", review.getHelpfulCount());
        map.put("photos", new ArrayList<>(review.getPhotos()));
        map.put("createdAt", review.getCreatedAt());
        map.put("user", users.findById(review.getUserId())
                .map(u -> Map.of("fullName", (Object) u.getFullName(),
                        "avatarUrl", String.valueOf(u.getAvatarUrl())))
                .orElse(Map.of()));
        return map;
    }
}
