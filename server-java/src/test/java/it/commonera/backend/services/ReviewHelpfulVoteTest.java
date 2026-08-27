package it.commonera.backend.services;

import it.commonera.backend.AbstractIntegrationTest;
import it.commonera.backend.entities.Category;
import it.commonera.backend.entities.Product;
import it.commonera.backend.entities.Review;
import it.commonera.backend.entities.User;
import it.commonera.backend.exceptions.ApiException;
import it.commonera.backend.repositories.ReviewRepository;
import it.commonera.backend.repositories.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Il pulsante "utile" sotto le recensioni: il frontend lo chiamava da sempre, il
 * backend Java non aveva la rotta.
 *
 * Una persona, un voto — garantito dalla chiave primaria di
 * `review_helpful_votes`, non da un controllo letto prima e sperando in bene.
 */
class ReviewHelpfulVoteTest extends AbstractIntegrationTest {

    @Autowired
    private ReviewService reviews;
    @Autowired
    private ReviewRepository reviewRepo;
    @Autowired
    private UserRepository users;
    @PersistenceContext
    private EntityManager em;

    @Test
    void oneVotePerPersonAndTheCounterGoesUpOnlyOnce() {
        var voter = user("votante");
        var review = review(user("autore"));

        var first = reviews.voteHelpful(voter.getId(), review.getId());
        assertThat(first.get("helpful")).isEqualTo(true);

        assertThatThrownBy(() -> reviews.voteHelpful(voter.getId(), review.getId()))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("gia' votato");

        em.flush();
        em.clear();
        assertThat(reviewRepo.findById(review.getId()).orElseThrow().getHelpfulCount()).isEqualTo(1);
    }

    @Test
    void votingOnAReviewThatDoesNotExistIsANotFound() {
        var voter = user("votante");
        assertThatThrownBy(() -> reviews.voteHelpful(voter.getId(), UUID.randomUUID()))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("not found");
    }

    private User user(String prefix) {
        var user = new User();
        user.setEmail(prefix + "." + UUID.randomUUID() + "@example.com");
        user.setPasswordHash("unused-in-this-test");
        user.setFullName("Utente " + prefix);
        var saved = users.save(user);
        em.flush();
        return saved;
    }

    private Review review(User author) {
        var category = new Category();
        category.setName("Recensiti");
        category.setSlug("recensiti-" + UUID.randomUUID());
        em.persist(category);

        var product = new Product();
        product.setName("Prodotto recensito");
        product.setSlug("prodotto-recensito-" + UUID.randomUUID());
        product.setCategory(category);
        product.setBasePrice(new BigDecimal("15.00"));
        em.persist(product);

        var review = new Review();
        review.setUserId(author.getId());
        review.setProductId(product.getId());
        review.setRating((short) 5);
        review.setStatus(Review.ReviewStatus.approved);
        em.persist(review);
        em.flush();
        return review;
    }
}
