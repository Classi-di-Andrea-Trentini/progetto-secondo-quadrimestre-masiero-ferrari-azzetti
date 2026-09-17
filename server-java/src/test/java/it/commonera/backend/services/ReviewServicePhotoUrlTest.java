package it.commonera.backend.services;

import it.commonera.backend.entities.Review;
import it.commonera.backend.exceptions.ApiException;
import it.commonera.backend.repositories.ReviewRepository;
import it.commonera.backend.repositories.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

/**
 * Fix 4: `addPhoto` accettava qualunque stringa come URL, `javascript:`/`data:`
 * compresi, e la restituiva cosi' com'e' — uno XSS memorizzato pronto all'uso.
 * Test unitario con repository finti: la regola e' sullo schema dell'URL, non
 * serve un database vero per verificarla.
 */
@ExtendWith(MockitoExtension.class)
class ReviewServicePhotoUrlTest {

    @Mock
    private ReviewRepository reviews;
    @Mock
    private UserRepository users;

    private ReviewService service;
    private UUID userId;
    private UUID reviewId;
    private Review review;

    @BeforeEach
    void setUp() {
        service = new ReviewService(reviews, users);
        userId = UUID.randomUUID();
        reviewId = UUID.randomUUID();

        review = new Review();
        review.setId(reviewId);
        review.setUserId(userId);

        when(reviews.findById(reviewId)).thenReturn(Optional.of(review));
        lenient().when(reviews.save(any(Review.class))).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(users.findById(any())).thenReturn(Optional.empty());
    }

    @Test
    void rejectsJavascriptUrl() {
        assertThatThrownBy(() -> service.addPhoto(userId, reviewId, "javascript:alert(1)"))
                .isInstanceOf(ApiException.class);
        assertThat(review.getPhotos()).isEmpty();
    }

    @Test
    void rejectsDataUrl() {
        assertThatThrownBy(() -> service.addPhoto(userId, reviewId, "data:text/html,<script>alert(1)</script>"))
                .isInstanceOf(ApiException.class);
        assertThat(review.getPhotos()).isEmpty();
    }

    @Test
    void acceptsRealHttpsUrl() {
        service.addPhoto(userId, reviewId, "https://cdn.example.com/photo.jpg");
        assertThat(review.getPhotos()).containsExactly("https://cdn.example.com/photo.jpg");
    }

    @Test
    void acceptsPlainHttpUrl() {
        service.addPhoto(userId, reviewId, "http://cdn.example.com/photo.jpg");
        assertThat(review.getPhotos()).containsExactly("http://cdn.example.com/photo.jpg");
    }
}
