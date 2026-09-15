package it.commonera.backend.repositories;

import it.commonera.backend.entities.Wishlist;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WishlistRepository extends JpaRepository<Wishlist, UUID> {
    List<Wishlist> findByUserId(UUID userId);
    Optional<Wishlist> findByUserIdAndProductId(UUID userId, UUID productId);

    /** Cancellazione dell'account: i desideri di qualcuno non sono un documento fiscale. */
    void deleteByUserId(UUID userId);
}
