package it.commonera.backend.repositories;

import it.commonera.backend.entities.Review;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface ReviewRepository extends JpaRepository<Review, UUID>, JpaSpecificationExecutor<Review> {
    Page<Review> findByProductIdAndStatus(UUID productId, Review.ReviewStatus status, Pageable pageable);
    Optional<Review> findByUserIdAndProductId(UUID userId, UUID productId);
    boolean existsByUserIdAndProductId(UUID userId, UUID productId);

    /**
     * Registra il voto "utile".
     *
     * `on conflict do nothing` invece di un controllo letto prima: due click veloci
     * sullo stesso bottone passerebbero entrambi il controllo e il conteggio salirebbe
     * di due per una persona sola. Qui e' la chiave primaria della tabella a decidere,
     * e un risultato `0` significa "aveva gia' votato".
     */
    @Modifying
    @Query(value = "insert into review_helpful_votes (review_id, user_id) values (:reviewId, :userId) "
            + "on conflict (review_id, user_id) do nothing", nativeQuery = true)
    int insertHelpfulVote(@Param("reviewId") UUID reviewId, @Param("userId") UUID userId);

    @Modifying
    @Query("update Review r set r.helpfulCount = r.helpfulCount + 1 where r.id = :id")
    int incrementHelpfulCount(@Param("id") UUID id);
}
